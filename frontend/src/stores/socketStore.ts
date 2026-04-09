import { io, Socket } from 'socket.io-client';
import { useGameStore } from './gameStore.js';
import type { GameState, PlayerId } from '@tic-tac-gulp/shared';
import type { ChatMessage } from './gameStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false });
    attachListeners(socket);
  }
  return socket;
}

function attachListeners(s: Socket) {
  const store = useGameStore.getState;

  s.on('connect', () => {
    store().setConnected(true);
    store().setReconnecting(false);
  });

  s.on('disconnect', () => {
    store().setConnected(false);
    store().setReconnecting(true);
  });

  s.on('room:joined', (data: { roomCode: string; yourPlayerId: PlayerId; gameState: GameState }) => {
    const { sessionId } = store();
    store().setSession(data.yourPlayerId, data.roomCode, sessionId ?? '');
    store().setGameState(data.gameState);
  });

  s.on('room:updated', (data: { gameState: GameState }) => {
    store().setGameState(data.gameState);
  });

  s.on('game:started', (data: { gameState: GameState }) => {
    store().setGameState(data.gameState);
  });

  s.on('game:state', (data: { gameState: GameState }) => {
    store().recordMove(data.gameState.moveCount - 1);
    store().setGameState(data.gameState);
    store().selectPiece(null);
  });

  s.on('game:ended', (data: { gameState: GameState }) => {
    const { yourPlayerId } = store();
    const { winner } = data.gameState;
    if (yourPlayerId) {
      if (winner === 'DRAW') store().incrementStats('draw');
      else if (winner === yourPlayerId) store().incrementStats('win');
      else store().incrementStats('loss');
    }
    store().setRematchState('idle');
    store().setGameState(data.gameState);
    store().selectPiece(null);
  });

  s.on('move:error', (data: { message: string }) => {
    store().setMoveError(data.message);
  });

  s.on('rematch:started', (data: { gameState: GameState }) => {
    store().setRematchState('idle');
    store().setGameState(data.gameState);
    store().selectPiece(null);
  });

  s.on('rematch:requested', () => {
    store().setRematchState('opponent_requested');
  });

  s.on('rematch:declined', () => {
    store().setRematchState('unavailable');
  });

  s.on('rematch:unavailable', () => {
    store().setRematchState('unavailable');
  });

  s.on('player:role', (data: { yourPlayerId: PlayerId }) => {
    const { roomCode, sessionId } = store();
    store().setSession(data.yourPlayerId, roomCode ?? '', sessionId ?? '');
  });

  s.on('player:disconnected', (data: { playerId: PlayerId; timeoutSeconds: number }) => {
    store().setDisconnectedPlayer(data.playerId);
  });

  s.on('chat:message', (data: ChatMessage) => {
    store().addChatMessage(data);
  });
}

/** Emits a move attempt to the server. */
export function emitMove(pieceSize: 1 | 2 | 3, row: number, col: number) {
  const { sessionId, roomCode } = useGameStore.getState();
  getSocket().emit('move:attempt', { sessionId, roomCode, pieceSize, row, col });
}

/** Emits a game start request (host only). */
export function emitStartGame() {
  const { sessionId, roomCode } = useGameStore.getState();
  getSocket().emit('game:start', { sessionId, roomCode });
}

/** Emits rematch acceptance and marks local state as waiting. */
export function emitRematchAccept() {
  const { sessionId, roomCode } = useGameStore.getState();
  useGameStore.getState().setRematchState('i_requested');
  getSocket().emit('rematch:accept', { sessionId, roomCode });
}

/** Emits rematch decline. */
export function emitRematchDecline() {
  const { sessionId, roomCode } = useGameStore.getState();
  getSocket().emit('rematch:decline', { sessionId, roomCode });
}

/** Emits a resign event. */
export function emitResign() {
  const { sessionId, roomCode } = useGameStore.getState();
  getSocket().emit('game:resign', { sessionId, roomCode });
}

/** Sends a chat message. */
export function emitChat(text: string) {
  const { sessionId, roomCode } = useGameStore.getState();
  getSocket().emit('chat:message', { sessionId, roomCode, text });
}
