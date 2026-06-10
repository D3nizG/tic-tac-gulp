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

  s.on('room:closed', (data: { reason: string }) => {
    localStorage.removeItem('ttg_sessionId');
    localStorage.removeItem('ttg_roomCode');
    store().closeRoom(data.reason);
    s.disconnect();
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
      const opponentId: PlayerId = yourPlayerId === 'P1' ? 'P2' : 'P1';
      const myGulps = data.gameState.gulpCounts[yourPlayerId] ?? 0;
      const opponentGulps = data.gameState.gulpCounts[opponentId] ?? 0;
      if (winner === 'DRAW') store().incrementStats('draw', myGulps, opponentGulps);
      else if (winner === yourPlayerId) store().incrementStats('win', myGulps, opponentGulps);
      else store().incrementStats('loss', myGulps, opponentGulps);
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

/** Stores a player session and connects its socket to the room. */
export function joinRoomSession(
  roomCode: string,
  playerId: PlayerId,
  sessionId: string,
  displayName: string
) {
  const previousRoomCode = useGameStore.getState().roomCode;
  useGameStore.getState().setSession(playerId, roomCode, sessionId);
  localStorage.setItem('ttg_sessionId', sessionId);
  localStorage.setItem('ttg_roomCode', roomCode);

  const socket = getSocket();
  const payload = { sessionId, roomCode, displayName, playerId };
  if (socket.connected && previousRoomCode !== roomCode) {
    socket.disconnect();
  }
  if (socket.connected) {
    socket.emit('room:join', payload);
  } else {
    socket.connect();
    socket.once('connect', () => {
      socket.emit('room:join', payload);
    });
  }
}

/** Leaves a waiting/lobby room without affecting games already in progress. */
export function leavePregameRoomIfNeeded(): boolean {
  const state = useGameStore.getState();
  const status = state.gameState?.status;
  if (status !== 'WAITING' && status !== 'LOBBY') return false;

  if (socket?.connected) socket.disconnect();
  localStorage.removeItem('ttg_sessionId');
  localStorage.removeItem('ttg_roomCode');
  state.reset();
  return true;
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
