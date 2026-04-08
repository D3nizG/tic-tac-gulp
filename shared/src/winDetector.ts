import type { Board, PlayerId } from './types.js';
import { getTopPiece } from './boardEngine.js';

/** All 8 win lines on a 3×3 board. */
const WIN_LINES: [number, number][][] = [
  // Rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // Columns
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // Diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

export interface WinResult {
  winner: PlayerId | null;
  winLine: [number, number][] | null;
}

/**
 * Checks all 8 win lines against the visible top pieces.
 * Returns the winner and winning line, or { winner: null, winLine: null }.
 *
 * A line only counts if all 3 cells are occupied by the same player's
 * visible top piece.
 */
export function checkWin(board: Board): WinResult {
  for (const line of WIN_LINES) {
    const owners = line.map(([r, c]) => getTopPiece(board[r][c])?.owner ?? null);
    // All three must be non-null and equal
    if (
      owners[0] !== null &&
      owners[0] === owners[1] &&
      owners[1] === owners[2]
    ) {
      return {
        winner: owners[0] as PlayerId,
        winLine: line as [number, number][],
      };
    }
  }
  return { winner: null, winLine: null };
}
