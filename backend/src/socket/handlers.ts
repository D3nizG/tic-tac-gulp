import type { Server, Socket } from 'socket.io';
import {
  applyMove,
  getMoveError,
  getValidTargets,
  resolveAfterMove,
  forfeitGame,
  addSecondPlayer,
  startGame,
  resetGameState,
} from '@tic-tac-gulp/shared';
import type { GameState, MoveEvent, PlayerId, PieceSize } from '@tic-tac-gulp/shared';
import { roomStore } from '../store/roomStore.js';

const TURN_TIMEOUT_MS = 13_000;

/** Per-room turn timer handles. */
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Returns the best auto-move for the current player: smallest piece, random valid cell. */
function computeAutoMove(state: GameState): MoveEvent | null {
  const { currentTurn, players, moveCount } = state;
  const inv = players[currentTurn].inventory;
  const sizes: PieceSize[] = [1, 2, 3];
  for (const pieceSize of sizes) {
    const count = pieceSize === 1 ? inv.small : pieceSize === 2 ? inv.medium : inv.large;
    if (count === 0) continue;
    const targets = getValidTargets(state, currentTurn, pieceSize);
    if (targets.length > 0) {
      const [row, col] = targets[Math.floor(Math.random() * targets.length)];
      return { playerId: currentTurn, pieceSize, row, col, moveIndex: moveCount };
    }
  }
  return null;
}

function clearTurnTimer(roomCode: string) {
  const h = turnTimers.get(roomCode);
  if (h) { clearTimeout(h); turnTimers.delete(roomCode); }
}

/** Strips server-private fields before sending state to clients. */
function sanitizeState(state: ReturnType<typeof roomStore.get>) {
  if (!state) return null;
  return {
    ...state,
    players: {
      P1: { ...state.players.P1, socketId: undefined },
      P2: { ...state.players.P2, socketId: undefined },
    },
  };
}

/** Per-session timestamp of last chat message (rate limiting). */
const chatRateLimit = new Map<string, number>();

function startTurnTimer(io: Server, roomCode: string) {
  clearTurnTimer(roomCode);
  const h = setTimeout(() => {
    let state = roomStore.get(roomCode);
    if (!state || state.status !== 'IN_PROGRESS') return;
    const autoMove = computeAutoMove(state);
    if (!autoMove) return;
    state = resolveAfterMove(applyMove(state, autoMove));
    const now = Date.now();
    if (state.status === 'IN_PROGRESS') {
      state = { ...state, turnStartedAt: now };
    }
    roomStore.set(roomCode, state);
    io.to(roomCode).emit('game:state', { gameState: sanitizeState(state) });
    if (state.status === 'ENDED') {
      io.to(roomCode).emit('game:ended', {
        gameState: sanitizeState(state),
        winner: state.winner,
        reason: state.endReason,
      });
    } else {
      startTurnTimer(io, roomCode);
    }
  }, TURN_TIMEOUT_MS);
  turnTimers.set(roomCode, h);
}

export function registerSocketHandlers(
  io: Server,
  options: { forfeitTimeoutMs?: number } = {}
) {
  const FORFEIT_TIMEOUT_MS = options.forfeitTimeoutMs ?? 60_000;
  io.on('connection', (socket: Socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── room:join ──────────────────────────────────────────────────────────
    // Fired when a player first connects to a room (after HTTP create/join).
    socket.on(
      'room:join',
      (data: { sessionId: string; roomCode: string; displayName: string; playerId: PlayerId }) => {
        const { sessionId, roomCode, displayName, playerId } = data;
        let state = roomStore.get(roomCode);
        if (!state) {
          socket.emit('error', { message: 'Room not found.', code: 'ROOM_NOT_FOUND' });
          return;
        }

        if (playerId === 'P2' && state.status === 'WAITING') {
          state = addSecondPlayer(state, displayName.trim(), sessionId);
        }

        // Associate socket with player
        state = {
          ...state,
          players: {
            ...state.players,
            [playerId]: {
              ...state.players[playerId],
              socketId: socket.id,
              connected: true,
              sessionId,
            },
          },
        };

        // ── Randomise who is P1 / P2 ──────────────────────────────────────
        // When P2 joins (both players now in the room), flip a coin to decide
        // which session becomes P1 and which becomes P2.  Both players are
        // notified of their assigned role so the client stores the correct side.
        let actualPlayerId: PlayerId = playerId;
        if (playerId === 'P2' && state.status === 'WAITING') {
          const swap = Math.random() < 0.5;
          if (swap) {
            // Swap P1 ↔ P2 player data
            const origP1 = { ...state.players.P1 };
            const origP2 = { ...state.players.P2 };
            state = {
              ...state,
              players: {
                P1: origP2, // joiner (this socket) becomes P1
                P2: origP1, // creator becomes P2
              },
            };
            actualPlayerId = 'P1';

            // Update creator's socket metadata and tell them their new role
            const creatorSocketId = origP1.socketId;
            if (creatorSocketId) {
              const creatorSocket = io.sockets.sockets.get(creatorSocketId);
              if (creatorSocket) {
                creatorSocket.data.playerId = 'P2';
                creatorSocket.emit('player:role', { yourPlayerId: 'P2' });
              }
            }
          }
        }

        roomStore.set(roomCode, state);
        roomStore.bindSession(sessionId, roomCode);

        socket.join(roomCode);
        socket.data.sessionId = sessionId;
        socket.data.roomCode = roomCode;
        socket.data.playerId = actualPlayerId;

        socket.emit('room:joined', {
          roomCode,
          yourPlayerId: actualPlayerId,
          gameState: sanitizeState(state),
        });

        // Notify the other player that someone joined
        socket.to(roomCode).emit('room:updated', { gameState: sanitizeState(state) });
      }
    );

    // ── room:rejoin ────────────────────────────────────────────────────────
    // Fired on reconnect to restore session.
    socket.on('room:rejoin', (data: { sessionId: string; roomCode: string }) => {
      const { sessionId, roomCode } = data;
      let state = roomStore.get(roomCode);
      if (!state) {
        socket.emit('error', { message: 'Room not found.', code: 'ROOM_NOT_FOUND' });
        return;
      }

      // Find which player this session belongs to
      const playerId: PlayerId | null =
        state.players.P1.sessionId === sessionId
          ? 'P1'
          : state.players.P2.sessionId === sessionId
          ? 'P2'
          : null;

      if (!playerId) {
        socket.emit('error', { message: 'Invalid session.', code: 'SESSION_INVALID' });
        return;
      }

      // Cancel forfeit timer
      roomStore.clearForfeitTimer(sessionId);

      // Mark player as reconnected
      state = {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...state.players[playerId], socketId: socket.id, connected: true },
        },
      };
      roomStore.set(roomCode, state);

      socket.join(roomCode);
      socket.data.sessionId = sessionId;
      socket.data.roomCode = roomCode;
      socket.data.playerId = playerId;

      // Send full state to reconnected player
      socket.emit('room:joined', {
        roomCode,
        yourPlayerId: playerId,
        gameState: sanitizeState(state),
      });

      // Notify opponent
      socket.to(roomCode).emit('player:reconnected', { playerId });
    });

    // ── game:start ────────────────────────────────────────────────────────
    socket.on('game:start', (data: { sessionId: string; roomCode: string }) => {
      const { sessionId, roomCode } = data;
      let state = roomStore.get(roomCode);
      if (!state) return;

      if (state.players.P1.sessionId !== sessionId) {
        socket.emit('error', { message: 'Only the host can start the game.', code: 'SESSION_INVALID' });
        return;
      }
      if (state.status !== 'LOBBY') {
        socket.emit('error', { message: 'Room is not in lobby state.' });
        return;
      }
      if (!state.players.P2.connected) {
        socket.emit('error', { message: 'Cannot start — waiting for second player.' });
        return;
      }

      state = startGame(state);
      roomStore.set(roomCode, state);

      io.to(roomCode).emit('game:started', { gameState: sanitizeState(state) });
      startTurnTimer(io, roomCode);
    });

    // ── move:attempt ──────────────────────────────────────────────────────
    socket.on(
      'move:attempt',
      (data: { sessionId: string; roomCode: string; pieceSize: 1 | 2 | 3; row: number; col: number }) => {
        const { sessionId, roomCode, pieceSize, row, col } = data;
        let state = roomStore.get(roomCode);
        if (!state) {
          socket.emit('move:error', { message: 'Room not found.', code: 'ROOM_NOT_FOUND' });
          return;
        }

        const playerId: PlayerId | null =
          state.players.P1.sessionId === sessionId
            ? 'P1'
            : state.players.P2.sessionId === sessionId
            ? 'P2'
            : null;

        if (!playerId) {
          socket.emit('move:error', { message: 'Invalid session.', code: 'SESSION_INVALID' });
          return;
        }

        const moveEvent: MoveEvent = {
          playerId,
          pieceSize,
          row,
          col,
          moveIndex: state.moveCount,
        };

        const error = getMoveError(state, moveEvent);
        if (error) {
          socket.emit('move:error', { message: error, code: 'INVALID_MOVE' });
          return;
        }

        // Apply and resolve
        state = applyMove(state, moveEvent);
        state = resolveAfterMove(state);
        if (state.status === 'IN_PROGRESS') {
          state = { ...state, turnStartedAt: Date.now() };
        }
        roomStore.set(roomCode, state);

        clearTurnTimer(roomCode);
        io.to(roomCode).emit('game:state', { gameState: sanitizeState(state) });

        if (state.status === 'ENDED') {
          io.to(roomCode).emit('game:ended', {
            gameState: sanitizeState(state),
            winner: state.winner,
            reason: state.endReason,
          });
        } else {
          startTurnTimer(io, roomCode);
        }
      }
    );

    // ── game:resign ───────────────────────────────────────────────────────
    socket.on('game:resign', (data: { sessionId: string; roomCode: string }) => {
      const { sessionId, roomCode } = data;
      let state = roomStore.get(roomCode);
      if (!state || state.status !== 'IN_PROGRESS') return;

      const playerId: PlayerId | null =
        state.players.P1.sessionId === sessionId ? 'P1' :
        state.players.P2.sessionId === sessionId ? 'P2' : null;
      if (!playerId) return;

      const winner: PlayerId = playerId === 'P1' ? 'P2' : 'P1';
      state = {
        ...state,
        status: 'ENDED',
        winner,
        winLine: null,
        endReason: 'resign',
        updatedAt: Date.now(),
      };
      roomStore.set(roomCode, state);
      clearTurnTimer(roomCode);
      io.to(roomCode).emit('game:ended', {
        gameState: sanitizeState(state),
        winner: state.winner,
        reason: 'resign',
      });
    });

    // ── chat:message ──────────────────────────────────────────────────────
    socket.on(
      'chat:message',
      (data: { sessionId: string; roomCode: string; text: string }) => {
        const { sessionId, roomCode, text } = data;
        const state = roomStore.get(roomCode);
        if (!state || (state.status !== 'IN_PROGRESS' && state.status !== 'ENDED')) return;

        const playerId: PlayerId | null =
          state.players.P1.sessionId === sessionId ? 'P1' :
          state.players.P2.sessionId === sessionId ? 'P2' : null;
        if (!playerId) return;

        const cleaned = text.trim().slice(0, 200);
        if (!cleaned) return;

        const now = Date.now();
        const lastSent = chatRateLimit.get(sessionId) ?? 0;
        if (now - lastSent < 1000) return; // 1 message per second
        chatRateLimit.set(sessionId, now);

        io.to(roomCode).emit('chat:message', { playerId, text: cleaned, timestamp: now });
      }
    );

    // ── rematch:accept ────────────────────────────────────────────────────
    socket.on('rematch:accept', (data: { sessionId: string; roomCode: string }) => {
      const { sessionId, roomCode } = data;
      let state = roomStore.get(roomCode);
      if (!state || state.status !== 'ENDED') return;

      const playerId: PlayerId | null =
        state.players.P1.sessionId === sessionId ? 'P1' :
        state.players.P2.sessionId === sessionId ? 'P2' : null;
      if (!playerId) return;

      // Track acceptances (simple: use metadata field on state via casting)
      const meta = (state as unknown as Record<string, unknown>);
      const accepted = (meta._rematchAccepted as Set<PlayerId>) ?? new Set<PlayerId>();
      accepted.add(playerId);
      meta._rematchAccepted = accepted;

      socket.to(roomCode).emit('rematch:requested', { byPlayerId: playerId });

      if (accepted.size === 2) {
        delete meta._rematchAccepted;
        state = resetGameState(state);
        roomStore.set(roomCode, state);
        io.to(roomCode).emit('rematch:started', { gameState: sanitizeState(state) });
        startTurnTimer(io, roomCode);
      }
    });

    // ── rematch:decline ───────────────────────────────────────────────────
    socket.on('rematch:decline', (data: { sessionId: string; roomCode: string }) => {
      const { roomCode } = data;
      socket.to(roomCode).emit('rematch:declined', {});
    });

    // ── disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      const { sessionId, roomCode, playerId } = socket.data as {
        sessionId?: string;
        roomCode?: string;
        playerId?: PlayerId;
      };
      if (!sessionId || !roomCode || !playerId) return;

      let state = roomStore.get(roomCode);
      if (!state) return;

      // If the game is already ended, notify the opponent that rematch is unavailable
      if (state.status === 'ENDED') {
        socket.to(roomCode).emit('rematch:unavailable', { playerId });
        return;
      }

      // Mark player as disconnected
      state = {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...state.players[playerId], connected: false },
        },
      };
      roomStore.set(roomCode, state);

      socket.to(roomCode).emit('player:disconnected', {
        playerId,
        timeoutSeconds: FORFEIT_TIMEOUT_MS / 1000,
      });

      // Clear turn timer while player is disconnected
      clearTurnTimer(roomCode);

      // Start forfeit timer
      roomStore.startForfeitTimer(sessionId, FORFEIT_TIMEOUT_MS, () => {
        let s = roomStore.get(roomCode);
        if (!s || s.status === 'ENDED') return;
        s = forfeitGame(s, playerId);
        roomStore.set(roomCode, s);
        io.to(roomCode).emit('game:ended', {
          gameState: sanitizeState(s),
          winner: s.winner,
          reason: 'forfeit',
        });
      });
    });
  });
}
