import type { GameState, Inventory, Player } from './types.js';
import { createEmptyBoard } from './boardEngine.js';

const FULL_INVENTORY: Inventory = { small: 3, medium: 3, large: 3 };

function makePlayer(
  id: 'P1' | 'P2',
  displayName: string,
  sessionId: string
): Player {
  return {
    id,
    displayName,
    sessionId,
    socketId: null,
    connected: false,
    inventory: { ...FULL_INVENTORY },
  };
}

/** Generates a random 6-character alphanumeric room code (uppercase). */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit O/0, I/1 for readability
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Creates a fresh game state for a new room (WAITING — P2 not yet joined). */
export function createInitialState(
  roomCode: string,
  p1Name: string,
  p1SessionId: string
): GameState {
  const now = Date.now();
  return {
    roomCode,
    status: 'WAITING',
    board: createEmptyBoard(),
    players: {
      P1: makePlayer('P1', p1Name, p1SessionId),
      P2: makePlayer('P2', '', ''),
    },
    currentTurn: 'P1',
    moveCount: 0,
    winner: null,
    winLine: null,
    endReason: null,
    createdAt: now,
    updatedAt: now,
    gameStartedAt: null,
  };
}

/**
 * Adds P2 to a WAITING state, transitioning it to LOBBY.
 * Returns a new state object.
 */
export function addSecondPlayer(
  state: GameState,
  p2Name: string,
  p2SessionId: string
): GameState {
  return {
    ...state,
    status: 'LOBBY',
    players: {
      ...state.players,
      P2: makePlayer('P2', p2Name, p2SessionId),
    },
    updatedAt: Date.now(),
  };
}

/**
 * Transitions a LOBBY state to IN_PROGRESS.
 * Returns a new state object.
 */
export function startGame(state: GameState): GameState {
  const now = Date.now();
  return {
    ...state,
    status: 'IN_PROGRESS',
    gameStartedAt: now,
    updatedAt: now,
  };
}

/**
 * Resets an ENDED game back to IN_PROGRESS for a rematch.
 * Same players, same sides; P1 goes first again.
 */
export function resetGameState(existing: GameState): GameState {
  const now = Date.now();
  return {
    ...existing,
    status: 'IN_PROGRESS',
    board: createEmptyBoard(),
    players: {
      P1: {
        ...existing.players.P1,
        inventory: { ...FULL_INVENTORY },
      },
      P2: {
        ...existing.players.P2,
        inventory: { ...FULL_INVENTORY },
      },
    },
    currentTurn: 'P1',
    moveCount: 0,
    winner: null,
    winLine: null,
    endReason: null,
    gameStartedAt: now,
    updatedAt: now,
  };
}
