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
import type { GameState, MoveEvent, Player, PlayerId, PieceSize } from '@tic-tac-gulp/shared';
import { roomStore } from '../store/roomStore.js';
import { recordMatch } from '../db/matchRecorder.js';

const TURN_TIMEOUT_MS = 13_000;
const PUBLIC_MATCH_START_DELAY_MS = 2_200;

/** Per-room turn timer handles. */
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
const publicMatchTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

function clearPublicMatchTimer(roomCode: string) {
  const h = publicMatchTimers.get(roomCode);
  if (h) { clearTimeout(h); publicMatchTimers.delete(roomCode); }
}

function schedulePublicMatchStart(
  io: Server,
  roomCode: string,
  delayMs: number,
  startingPlayer?: PlayerId
) {
  clearPublicMatchTimer(roomCode);
  const h = setTimeout(() => {
    let state = roomStore.get(roomCode);
    if (
      !state?.isPublic ||
      state.status !== 'LOBBY' ||
      !state.players.P1.connected ||
      !state.players.P2.connected
    ) {
      return;
    }

    state = startGame(state, startingPlayer);
    roomStore.set(roomCode, state);
    io.to(roomCode).emit('game:started', { gameState: sanitizeState(state) });
    startTurnTimer(io, roomCode);
  }, delayMs);
  publicMatchTimers.set(roomCode, h);
}

function closePregameRoom(io: Server, state: GameState, playerId: PlayerId) {
  clearPublicMatchTimer(state.roomCode);
  clearTurnTimer(state.roomCode);
  roomStore.delete(state.roomCode);
  io.to(state.roomCode).emit('room:closed', {
    playerId,
    reason: state.isPublic ? 'matchmaking_left' : 'lobby_left',
  });
}

function makeEmptyPlayer(playerId: PlayerId): Player {
  return {
    id: playerId,
    displayName: '',
    sessionId: '',
    socketId: null,
    connected: false,
    inventory: { small: 3, medium: 3, large: 3 },
    userId: null,
  };
}

function handlePregameDisconnect(io: Server, state: GameState, playerId: PlayerId) {
  clearPublicMatchTimer(state.roomCode);

  if (state.isPublic) {
    closePregameRoom(io, state, playerId);
    return;
  }

  const remainingId: PlayerId = playerId === 'P1' ? 'P2' : 'P1';
  const remaining = state.players[remainingId];
  if (!remaining.connected || !remaining.sessionId) {
    closePregameRoom(io, state, playerId);
    return;
  }

  const updatedAt = Date.now();
  let nextState: GameState;

  if (playerId === 'P2') {
    nextState = {
      ...state,
      status: 'WAITING',
      players: {
        ...state.players,
        P2: makeEmptyPlayer('P2'),
      },
      startingPlayer: 'P1',
      currentTurn: 'P1',
      updatedAt,
    };
  } else {
    const promotedSocketId = remaining.socketId;
    nextState = {
      ...state,
      status: 'WAITING',
      players: {
        P1: { ...remaining, id: 'P1' },
        P2: makeEmptyPlayer('P2'),
      },
      startingPlayer: 'P1',
      currentTurn: 'P1',
      updatedAt,
    };

    const promotedSocket = promotedSocketId ? io.sockets.sockets.get(promotedSocketId) : undefined;
    if (promotedSocket) {
      promotedSocket.data.playerId = 'P1';
      promotedSocket.emit('player:role', { yourPlayerId: 'P1' });
    }
  }

  roomStore.set(state.roomCode, nextState);
  io.to(state.roomCode).emit('room:updated', { gameState: sanitizeState(nextState) });
}

function maybeApplyDisconnectForfeit(state: GameState): GameState {
  const grace = state.disconnectGrace;
  if (!grace || state.status !== 'IN_PROGRESS') return state;
  if (state.players[grace.playerId].connected) {
    return { ...state, disconnectGrace: undefined };
  }
  if (state.moveCount >= grace.expiresAtMove) {
    return forfeitGame({ ...state, disconnectGrace: undefined }, grace.playerId);
  }
  return state;
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
    state = maybeApplyDisconnectForfeit(state);
    roomStore.set(roomCode, state);
    io.to(roomCode).emit('game:state', { gameState: sanitizeState(state) });
    if (state.status === 'ENDED') {
      io.to(roomCode).emit('game:ended', {
        gameState: sanitizeState(state),
        winner: state.winner,
        reason: state.endReason,
      });
      recordMatch(state, state.players.P1.userId ?? null, state.players.P2.userId ?? null)
        .catch((err: Error) => console.error('[handlers] recordMatch error:', err.message));
    } else {
      startTurnTimer(io, roomCode);
    }
  }, TURN_TIMEOUT_MS);
  turnTimers.set(roomCode, h);
}

export function registerSocketHandlers(
  io: Server,
  options: { forfeitTimeoutMs?: number; startingPlayer?: PlayerId; publicMatchStartDelayMs?: number } = {}
) {
  const FORFEIT_TIMEOUT_MS = options.forfeitTimeoutMs ?? 60_000;
  const PUBLIC_START_DELAY_MS = options.publicMatchStartDelayMs ?? PUBLIC_MATCH_START_DELAY_MS;
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

        if (playerId === 'P1' && state.players.P1.sessionId !== sessionId) {
          socket.emit('error', { message: 'Invalid session.', code: 'SESSION_INVALID' });
          return;
        }
        if (
          playerId === 'P2' &&
          state.players.P2.sessionId &&
          state.players.P2.sessionId !== sessionId
        ) {
          socket.emit('error', { message: 'Room is full.', code: 'ROOM_FULL' });
          return;
        }

        if (playerId === 'P2' && state.status === 'WAITING') {
          state = addSecondPlayer(
            state,
            displayName.trim(),
            sessionId,
            state.players.P2.userId ?? null
          );
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

        let actualPlayerId: PlayerId = playerId;

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

        if (
          state.isPublic &&
          state.status === 'LOBBY' &&
          state.players.P1.connected &&
          state.players.P2.connected
        ) {
          io.to(roomCode).emit('room:updated', { gameState: sanitizeState(state) });
          schedulePublicMatchStart(io, roomCode, PUBLIC_START_DELAY_MS, options.startingPlayer);
        } else {
          socket.to(roomCode).emit('room:updated', { gameState: sanitizeState(state) });
        }
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
        disconnectGrace: state.disconnectGrace?.playerId === playerId
          ? undefined
          : state.disconnectGrace,
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

      const playerId: PlayerId | null =
        state.players.P1.sessionId === sessionId ? 'P1' :
        state.players.P2.sessionId === sessionId ? 'P2' : null;

      if (!playerId) {
        socket.emit('error', { message: 'Invalid session.', code: 'SESSION_INVALID' });
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

      state = startGame(state, options.startingPlayer);
      roomStore.set(roomCode, state);
      clearPublicMatchTimer(roomCode);

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
        state = maybeApplyDisconnectForfeit(state);
        roomStore.set(roomCode, state);

        clearTurnTimer(roomCode);
        io.to(roomCode).emit('game:state', { gameState: sanitizeState(state) });

        if (state.status === 'ENDED') {
          io.to(roomCode).emit('game:ended', {
            gameState: sanitizeState(state),
            winner: state.winner,
            reason: state.endReason,
          });
          recordMatch(state, state.players.P1.userId ?? null, state.players.P2.userId ?? null)
            .catch((err: Error) => console.error('[handlers] recordMatch error:', err.message));
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
      recordMatch(state, state.players.P1.userId ?? null, state.players.P2.userId ?? null)
        .catch((err: Error) => console.error('[handlers] recordMatch error:', err.message));
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

      if (state.status === 'WAITING' || state.status === 'LOBBY') {
        handlePregameDisconnect(io, state, playerId);
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

      if (state.status === 'IN_PROGRESS' && !state.players[playerId].userId) {
        state = forfeitGame(state, playerId);
        roomStore.set(roomCode, state);
        clearTurnTimer(roomCode);
        io.to(roomCode).emit('game:ended', {
          gameState: sanitizeState(state),
          winner: state.winner,
          reason: 'forfeit',
        });
        recordMatch(state, state.players.P1.userId ?? null, state.players.P2.userId ?? null)
          .catch((err: Error) => console.error('[handlers] recordMatch error:', err.message));
        return;
      }

      if (state.status === 'IN_PROGRESS') {
        state = {
          ...state,
          disconnectGrace: {
            playerId,
            expiresAtMove: state.moveCount + 3,
          },
        };
        roomStore.set(roomCode, state);
      }

      socket.to(roomCode).emit('player:disconnected', {
        playerId,
        timeoutSeconds: FORFEIT_TIMEOUT_MS / 1000,
        graceTurns: state.status === 'IN_PROGRESS' ? 3 : undefined,
      });
    });
  });
}
