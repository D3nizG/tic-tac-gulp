import type { GameState, PlayerId } from './types.js';
import { checkWin } from './winDetector.js';
import { checkDraw } from './drawDetector.js';
import { nextTurn } from './turnManager.js';

/**
 * Evaluates the board after a move and returns an updated state.
 * - Checks for a win → sets winner, winLine, status ENDED
 * - Checks for a draw → sets winner='DRAW', status ENDED
 * - Otherwise advances the turn
 */
export function resolveAfterMove(state: GameState): GameState {
  const { winner, winLine } = checkWin(state.board);

  if (winner !== null) {
    return {
      ...state,
      status: 'ENDED',
      winner,
      winLine,
      endReason: 'normal',
      updatedAt: Date.now(),
    };
  }

  if (checkDraw(state)) {
    return {
      ...state,
      status: 'ENDED',
      winner: 'DRAW',
      winLine: null,
      endReason: 'normal',
      updatedAt: Date.now(),
    };
  }

  // Game continues — advance the turn
  return {
    ...state,
    currentTurn: nextTurn(state.currentTurn),
    updatedAt: Date.now(),
  };
}

/**
 * Ends the game with a forfeit. The forfeiting player loses;
 * the opponent wins.
 */
export function forfeitGame(
  state: GameState,
  forfeitingPlayer: PlayerId
): GameState {
  const winner: PlayerId = forfeitingPlayer === 'P1' ? 'P2' : 'P1';
  return {
    ...state,
    status: 'ENDED',
    winner,
    winLine: null,
    endReason: 'forfeit',
    updatedAt: Date.now(),
  };
}
