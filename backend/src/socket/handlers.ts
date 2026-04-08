import type { Server, Socket } from 'socket.io';
import {
  applyMove,
  isLegalMove,
  getMoveError,
  resolveAfterMove,
  forfeitGame,
  addSecondPlayer,
  startGame,
  resetGameState,
} from '@tic-tac-gulp/shared';
import type { MoveEvent, PlayerId } from '@tic-tac-gulp/shared';
import { roomStore } from '../store/roomStore.js';

const FORFEIT_TIMEOUT_MS = 60_000; // 60 seconds

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

export function registerSocketHandlers(io: Server) {
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

        roomStore.set(roomCode, state);
        roomStore.bindSession(sessionId, roomCode);

        socket.join(roomCode);
        socket.data.sessionId = sessionId;
        socket.data.roomCode = roomCode;
        socket.data.playerId = playerId;

        socket.emit('room:joined', {
          roomCode,
          yourPlayerId: playerId,
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
        roomStore.set(roomCode, state);

        io.to(roomCode).emit('game:state', { gameState: sanitizeState(state) });

        if (state.status === 'ENDED') {
          io.to(roomCode).emit('game:ended', {
            gameState: sanitizeState(state),
            winner: state.winner,
            reason: state.endReason,
          });
        }
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
      if (!state || state.status === 'ENDED') return;

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
