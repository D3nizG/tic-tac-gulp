import type { GameState, Inventory, Player } from './types.js';
import { createEmptyBoard } from './boardEngine.js';
import { nextTurn } from './turnManager.js';

const FULL_INVENTORY: Inventory = { small: 3, medium: 3, large: 3 };

function makePlayer(
  id: 'P1' | 'P2',
  displayName: string,
  sessionId: string,
  userId: string | null = null
): Player {
  return {
    id,
    displayName,
    sessionId,
    socketId: null,
    connected: false,
    inventory: { ...FULL_INVENTORY },
    userId,
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
  p1SessionId: string,
  p1UserId: string | null = null
): GameState {
  const now = Date.now();
  return {
    roomCode,
    status: 'WAITING',
    board: createEmptyBoard(),
    players: {
      P1: makePlayer('P1', p1Name, p1SessionId, p1UserId),
      P2: makePlayer('P2', '', ''),
    },
    startingPlayer: 'P1',
    currentTurn: 'P1',
    moveCount: 0,
    winner: null,
    winLine: null,
    endReason: null,
    gulpCounts: { P1: 0, P2: 0 },
    createdAt: now,
    updatedAt: now,
    gameStartedAt: null,
    turnStartedAt: null,
  };
}

/**
 * Adds P2 to a WAITING state, transitioning it to LOBBY.
 * Returns a new state object.
 */
export function addSecondPlayer(
  state: GameState,
  p2Name: string,
  p2SessionId: string,
  p2UserId: string | null = null
): GameState {
  return {
    ...state,
    status: 'LOBBY',
    players: {
      ...state.players,
      P2: makePlayer('P2', p2Name, p2SessionId, p2UserId),
    },
    updatedAt: Date.now(),
  };
}

/**
 * Transitions a LOBBY state to IN_PROGRESS.
 * Returns a new state object.
 */
function randomPlayer(): 'P1' | 'P2' {
  return Math.random() < 0.5 ? 'P1' : 'P2';
}

export function startGame(state: GameState, startingPlayer: 'P1' | 'P2' = randomPlayer()): GameState {
  const now = Date.now();
  return {
    ...state,
    status: 'IN_PROGRESS',
    startingPlayer,
    currentTurn: startingPlayer,
    gameStartedAt: now,
    turnStartedAt: now,
    updatedAt: now,
  };
}

/**
 * Resets an ENDED game back to IN_PROGRESS for a rematch.
 * Same players, same sides; first turn alternates from the previous game.
 */
export function resetGameState(existing: GameState): GameState {
  const now = Date.now();
  const startingPlayer = nextTurn(existing.startingPlayer ?? 'P1');
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
    startingPlayer,
    currentTurn: startingPlayer,
    moveCount: 0,
    winner: null,
    winLine: null,
    endReason: null,
    gulpCounts: { P1: 0, P2: 0 },
    disconnectGrace: undefined,
    gameStartedAt: now,
    turnStartedAt: now,
    updatedAt: now,
  };
}
