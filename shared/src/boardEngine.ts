import type { Board, Cell, GameState, MoveEvent, Piece } from './types.js';

/** Returns the visible (top) piece of a cell, or null if empty. */
export function getTopPiece(cell: Cell): Piece | null {
  return cell.stack.length > 0 ? cell.stack[cell.stack.length - 1] : null;
}

/** Creates a fresh empty 3×3 board. */
export function createEmptyBoard(): Board {
  const board: Board = [];
  for (let row = 0; row < 3; row++) {
    board[row] = [];
    for (let col = 0; col < 3; col++) {
      board[row][col] = { row, col, stack: [] };
    }
  }
  return board;
}

/**
 * Applies a validated move to a game state and returns a new (immutable) state.
 * Does NOT validate the move — call isLegalMove before this.
 */
export function applyMove(state: GameState, move: MoveEvent): GameState {
  const { row, col, pieceSize, playerId } = move;

  // Deep-clone the board
  const newBoard: Board = state.board.map((rowArr) =>
    rowArr.map((cell) => ({
      ...cell,
      stack: [...cell.stack],
    }))
  );

  // Place the piece
  const piece: Piece = { owner: playerId, size: pieceSize };
  newBoard[row][col].stack.push(piece);

  // Decrement inventory
  const newPlayers = {
    P1: {
      ...state.players.P1,
      inventory: { ...state.players.P1.inventory },
    },
    P2: {
      ...state.players.P2,
      inventory: { ...state.players.P2.inventory },
    },
  };

  const inv = newPlayers[playerId].inventory;
  if (pieceSize === 1) inv.small--;
  else if (pieceSize === 2) inv.medium--;
  else inv.large--;

  return {
    ...state,
    board: newBoard,
    players: newPlayers,
    moveCount: state.moveCount + 1,
    updatedAt: Date.now(),
  };
}

/** Returns the cell at [row][col], or null if out of bounds. */
export function getCell(board: Board, row: number, col: number): Cell | null {
  if (row < 0 || row > 2 || col < 0 || col > 2) return null;
  return board[row][col];
}
