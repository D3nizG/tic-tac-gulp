import type { GameState, PlayerId } from './types.js';

/** Returns the other player's ID. */
export function nextTurn(current: PlayerId): PlayerId {
  return current === 'P1' ? 'P2' : 'P1';
}

/** Returns true if it is the given player's turn. */
export function isPlayerTurn(state: GameState, playerId: PlayerId): boolean {
  return state.status === 'IN_PROGRESS' && state.currentTurn === playerId;
}
