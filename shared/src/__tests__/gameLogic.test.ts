import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  addSecondPlayer,
  startGame,
  resetGameState,
} from '../gameFactory.js';
import { applyMove, getTopPiece } from '../boardEngine.js';
import { isLegalMove, getMoveError, getValidTargets } from '../moveValidator.js';
import { checkWin } from '../winDetector.js';
import { checkDraw, hasLegalMoves } from '../drawDetector.js';
import { nextTurn, isPlayerTurn } from '../turnManager.js';
import { resolveAfterMove, forfeitGame } from '../endGameResolver.js';
import type { GameState, MoveEvent } from '../types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGame(): GameState {
  const s = createInitialState('TESTXX', 'Alice', 'sess-alice');
  const s2 = addSecondPlayer(s, 'Bob', 'sess-bob');
  return startGame(s2);
}

function move(
  state: GameState,
  playerId: 'P1' | 'P2',
  pieceSize: 1 | 2 | 3,
  row: number,
  col: number
): MoveEvent {
  return { playerId, pieceSize, row, col, moveIndex: state.moveCount };
}

// ─── moveValidator ────────────────────────────────────────────────────────────

describe('moveValidator', () => {
  it('allows placing a small piece on an empty cell', () => {
    const g = makeGame();
    expect(isLegalMove(g, move(g, 'P1', 1, 0, 0))).toBe(true);
  });

  it('allows placing a medium on an empty cell', () => {
    const g = makeGame();
    expect(isLegalMove(g, move(g, 'P1', 2, 1, 1))).toBe(true);
  });

  it('allows placing a large on a small (own)', () => {
    let g = makeGame();
    g = applyMove(g, move(g, 'P1', 1, 0, 0)); // P1 places small at (0,0)
    // Manually fix turn for test (normally resolveAfterMove does this)
    g = { ...g, currentTurn: 'P1', moveCount: g.moveCount };
    expect(isLegalMove(g, move(g, 'P1', 3, 0, 0))).toBe(true);
  });

  it('allows placing a large on a medium (opponent)', () => {
    let g = makeGame();
    g = applyMove(g, move(g, 'P1', 2, 0, 0));
    g = { ...g, currentTurn: 'P1' };
    expect(isLegalMove(g, move(g, 'P1', 3, 0, 0))).toBe(true);
  });

  it('rejects placing a small on a medium', () => {
    let g = makeGame();
    g = applyMove(g, move(g, 'P1', 2, 0, 0));
    g = { ...g, currentTurn: 'P1' };
    expect(isLegalMove(g, move(g, 'P1', 1, 0, 0))).toBe(false);
  });

  it('rejects placing a medium on a medium (equal size)', () => {
    let g = makeGame();
    g = applyMove(g, move(g, 'P1', 2, 0, 0));
    g = { ...g, currentTurn: 'P1' };
    expect(isLegalMove(g, move(g, 'P1', 2, 0, 0))).toBe(false);
  });

  it('rejects moving on the wrong turn', () => {
    const g = makeGame(); // P1's turn
    expect(isLegalMove(g, move(g, 'P2', 1, 0, 0))).toBe(false);
  });

  it('rejects using a piece not in inventory', () => {
    let g = makeGame();
    // Drain all P1 small pieces manually
    g = { ...g, players: { ...g.players, P1: { ...g.players.P1, inventory: { small: 0, medium: 3, large: 3 } } } };
    expect(isLegalMove(g, move(g, 'P1', 1, 0, 0))).toBe(false);
  });

  it('rejects a stale moveIndex', () => {
    const g = makeGame();
    const m: MoveEvent = { playerId: 'P1', pieceSize: 1, row: 0, col: 0, moveIndex: 999 };
    expect(isLegalMove(g, m)).toBe(false);
  });

  it('rejects out-of-bounds coordinates', () => {
    const g = makeGame();
    const m: MoveEvent = { playerId: 'P1', pieceSize: 1, row: 3, col: 0, moveIndex: 0 };
    expect(isLegalMove(g, m)).toBe(false);
  });

  it('rejects when game is not IN_PROGRESS', () => {
    const g = makeGame();
    const notStarted = { ...g, status: 'ENDED' as const };
    expect(isLegalMove(notStarted, move(g, 'P1', 1, 0, 0))).toBe(false);
  });
});

// ─── getValidTargets ──────────────────────────────────────────────────────────

describe('getValidTargets', () => {
  it('returns all 9 cells for a small piece on an empty board', () => {
    const g = makeGame();
    const targets = getValidTargets(g, 'P1', 1);
    expect(targets).toHaveLength(9);
  });

  it('excludes cells where top piece is equal or larger', () => {
    let g = makeGame();
    g = applyMove(g, move(g, 'P1', 2, 0, 0)); // medium at (0,0)
    g = { ...g, currentTurn: 'P1' };
    const targets = getValidTargets(g, 'P1', 1);
    // (0,0) has medium on top — small can't go there
    expect(targets.some(([r, c]) => r === 0 && c === 0)).toBe(false);
    expect(targets).toHaveLength(8);
  });

  it('returns empty when it is not the player\'s turn', () => {
    const g = makeGame(); // P1's turn
    expect(getValidTargets(g, 'P2', 1)).toHaveLength(0);
  });
});

// ─── winDetector ──────────────────────────────────────────────────────────────

describe('winDetector', () => {
  it('detects a row win', () => {
    let g = makeGame();
    // P1 fills row 0: (0,0), (0,1), (0,2) with small pieces
    // P2 plays filler moves in row 1
    const moves: [GameState, 'P1' | 'P2', 1 | 2 | 3, number, number][] = [
      [g, 'P1', 1, 0, 0],
    ];
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 0)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 1, 0)));
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 1, 1)));
    g = applyMove(g, move(g, 'P1', 1, 0, 2));
    const result = checkWin(g.board);
    expect(result.winner).toBe('P1');
    expect(result.winLine).toEqual([[0, 0], [0, 1], [0, 2]]);
  });

  it('detects a diagonal win', () => {
    let g = makeGame();
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 0)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 0, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 1, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 0, 2)));
    g = applyMove(g, move(g, 'P1', 1, 2, 2));
    const result = checkWin(g.board);
    expect(result.winner).toBe('P1');
    expect(result.winLine).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('does not count a covered piece toward a win line', () => {
    let g = makeGame();
    // P1 places smalls at (0,0),(0,1),(0,2) then P2 covers (0,0) with medium
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 0)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 2, 2))); // P2 filler
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 2, 0, 0))); // P2 covers (0,0)
    g = applyMove(g, move(g, 'P1', 1, 0, 2));
    const result = checkWin(g.board);
    // (0,0) now shows P2's medium — breaks P1's row
    expect(result.winner).toBeNull();
  });

  it('returns no winner on an empty board', () => {
    const g = makeGame();
    expect(checkWin(g.board).winner).toBeNull();
  });

  it('detects a win after a cover move completes a line', () => {
    let g = makeGame();
    // Board: P2 has smalls at (0,0),(0,1),(0,2). P1 covers (0,0) with large.
    // After cover, P1 visible at (0,0)? No — P1 covers P2, so P2's line is broken.
    // Adjust: P1 has smalls at (1,0),(1,1) and covers (1,2) with medium on top of P2 small
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 1, 0)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 1, 2)));
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 1, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 0, 0))); // filler
    // P1 covers P2's small at (1,2) with medium → completing P1 row 1
    g = applyMove(g, move(g, 'P1', 2, 1, 2));
    const result = checkWin(g.board);
    expect(result.winner).toBe('P1');
  });
});

// ─── drawDetector ─────────────────────────────────────────────────────────────

describe('drawDetector', () => {
  it('returns false on a fresh game', () => {
    const g = makeGame();
    expect(checkDraw(g)).toBe(false);
  });

  it('returns true when both inventories are empty and no winner', () => {
    const g = makeGame();
    // Manually empty inventories and ensure no win
    const noWinState: GameState = {
      ...g,
      players: {
        P1: { ...g.players.P1, inventory: { small: 0, medium: 0, large: 0 } },
        P2: { ...g.players.P2, inventory: { small: 0, medium: 0, large: 0 } },
      },
    };
    expect(checkDraw(noWinState)).toBe(true);
  });

  it('returns false when one player still has pieces', () => {
    const g = makeGame();
    const state: GameState = {
      ...g,
      players: {
        P1: { ...g.players.P1, inventory: { small: 0, medium: 0, large: 0 } },
        P2: { ...g.players.P2, inventory: { small: 1, medium: 0, large: 0 } },
      },
    };
    expect(checkDraw(state)).toBe(false);
  });
});

// ─── turnManager ──────────────────────────────────────────────────────────────

describe('turnManager', () => {
  it('nextTurn: P1 → P2', () => expect(nextTurn('P1')).toBe('P2'));
  it('nextTurn: P2 → P1', () => expect(nextTurn('P2')).toBe('P1'));

  it('isPlayerTurn: true for active player', () => {
    const g = makeGame();
    expect(isPlayerTurn(g, 'P1')).toBe(true);
    expect(isPlayerTurn(g, 'P2')).toBe(false);
  });
});

// ─── endGameResolver ──────────────────────────────────────────────────────────

describe('resolveAfterMove', () => {
  it('advances the turn when no win or draw', () => {
    let g = makeGame();
    g = applyMove(g, move(g, 'P1', 1, 0, 0));
    const resolved = resolveAfterMove(g);
    expect(resolved.currentTurn).toBe('P2');
    expect(resolved.status).toBe('IN_PROGRESS');
  });

  it('ends the game with a winner', () => {
    let g = makeGame();
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 0)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 2, 2)));
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P2', 1, 2, 1)));
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 2)));
    expect(g.status).toBe('ENDED');
    expect(g.winner).toBe('P1');
    expect(g.winLine).toEqual([[0, 0], [0, 1], [0, 2]]);
  });
});

describe('forfeitGame', () => {
  it('makes the other player win', () => {
    const g = makeGame();
    const ended = forfeitGame(g, 'P1');
    expect(ended.winner).toBe('P2');
    expect(ended.endReason).toBe('forfeit');
    expect(ended.status).toBe('ENDED');
  });
});

// ─── resetGameState ───────────────────────────────────────────────────────────

describe('resetGameState', () => {
  it('resets board and inventories but keeps player names', () => {
    let g = makeGame();
    g = resolveAfterMove(applyMove(g, move(g, 'P1', 1, 0, 0)));
    const reset = resetGameState(g);
    expect(reset.status).toBe('IN_PROGRESS');
    expect(reset.moveCount).toBe(0);
    expect(reset.currentTurn).toBe('P1');
    expect(reset.players.P1.inventory).toEqual({ small: 3, medium: 3, large: 3 });
    expect(reset.players.P2.inventory).toEqual({ small: 3, medium: 3, large: 3 });
    expect(reset.board[0][0].stack).toHaveLength(0);
    expect(reset.players.P1.displayName).toBe('Alice');
    expect(reset.players.P2.displayName).toBe('Bob');
  });
});
