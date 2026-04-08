import type { GameState, PlayerId, PieceSize } from './types.js';
import { getTopPiece } from './boardEngine.js';

/** Returns true if the given player has no pieces remaining in inventory. */
function inventoryEmpty(state: GameState, playerId: PlayerId): boolean {
  const inv = state.players[playerId].inventory;
  return inv.small === 0 && inv.medium === 0 && inv.large === 0;
}

/** Returns the largest piece size in the player's inventory (or 0 if empty). */
function maxPieceSize(state: GameState, playerId: PlayerId): number {
  const inv = state.players[playerId].inventory;
  if (inv.large > 0) return 3;
  if (inv.medium > 0) return 2;
  if (inv.small > 0) return 1;
  return 0;
}

/**
 * Returns true if the active player has at least one legal placement.
 * A player can always place on an empty cell; the only edge case where
 * they're stuck is when every cell's top piece size ≥ their max piece size.
 */
export function hasLegalMoves(state: GameState, playerId: PlayerId): boolean {
  const maxSize = maxPieceSize(state, playerId);
  if (maxSize === 0) return false; // No pieces at all

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const top = getTopPiece(state.board[row][col]);
      if (top === null || top.size < maxSize) return true;
    }
  }
  return false;
}

/**
 * Returns true if the game is a draw.
 *
 * Draw conditions:
 * 1. Both players' inventories are empty AND no winner exists.
 * 2. The active player has no legal moves (all cells blocked by equal/larger tops).
 *    If BOTH players have no legal moves simultaneously, it's also a draw.
 */
export function checkDraw(state: GameState): boolean {
  const p1Empty = inventoryEmpty(state, 'P1');
  const p2Empty = inventoryEmpty(state, 'P2');

  // Condition 1: all pieces placed
  if (p1Empty && p2Empty) return true;

  // Condition 2: active player is stuck (rare)
  const activePlayer = state.currentTurn;
  if (!inventoryEmpty(state, activePlayer) && !hasLegalMoves(state, activePlayer)) {
    // Check if the other player is also stuck
    const other: PlayerId = activePlayer === 'P1' ? 'P2' : 'P1';
    if (inventoryEmpty(state, other) || !hasLegalMoves(state, other)) {
      return true;
    }
  }

  return false;
}
