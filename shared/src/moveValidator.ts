import type { GameState, MoveEvent, PlayerId, PieceSize } from './types.js';
import { getTopPiece } from './boardEngine.js';

/**
 * Returns null if the move is legal, or an error message string if it is not.
 */
export function getMoveError(state: GameState, move: MoveEvent): string | null {
  const { playerId, pieceSize, row, col, moveIndex } = move;

  // Game must be in progress
  if (state.status !== 'IN_PROGRESS') {
    return 'Game is not in progress.';
  }

  // Must be the player's turn
  if (state.currentTurn !== playerId) {
    return 'It is not your turn.';
  }

  // Idempotency: reject stale move indices
  if (moveIndex !== state.moveCount) {
    return 'Move index is stale — already received a newer move.';
  }

  // Cell bounds
  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return 'Cell coordinates are out of bounds.';
  }

  // Player must have the piece in inventory
  const inv = state.players[playerId].inventory;
  if (pieceSize === 1 && inv.small <= 0) return 'No small pieces remaining.';
  if (pieceSize === 2 && inv.medium <= 0) return 'No medium pieces remaining.';
  if (pieceSize === 3 && inv.large <= 0) return 'No large pieces remaining.';

  // Cell must be empty or have a smaller visible piece
  const cell = state.board[row][col];
  const top = getTopPiece(cell);
  if (top !== null && top.size >= pieceSize) {
    return `Cannot place size-${pieceSize} piece on a cell with a size-${top.size} piece on top.`;
  }

  return null;
}

/** Returns true if the move is legal. */
export function isLegalMove(state: GameState, move: MoveEvent): boolean {
  return getMoveError(state, move) === null;
}

/**
 * Returns all [row, col] pairs where a player could legally place a piece of
 * the given size. Used by the UI for highlighting valid targets.
 */
export function getValidTargets(
  state: GameState,
  playerId: PlayerId,
  pieceSize: PieceSize
): [number, number][] {
  if (state.status !== 'IN_PROGRESS') return [];
  if (state.currentTurn !== playerId) return [];

  const inv = state.players[playerId].inventory;
  const haspiece =
    (pieceSize === 1 && inv.small > 0) ||
    (pieceSize === 2 && inv.medium > 0) ||
    (pieceSize === 3 && inv.large > 0);
  if (!haspiece) return [];

  const targets: [number, number][] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const top = getTopPiece(state.board[row][col]);
      if (top === null || top.size < pieceSize) {
        targets.push([row, col]);
      }
    }
  }
  return targets;
}
