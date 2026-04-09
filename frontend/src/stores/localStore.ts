import { create } from 'zustand';
import {
  createInitialState,
  addSecondPlayer,
  startGame,
  resetGameState,
  applyMove,
  resolveAfterMove,
  getValidTargets,
} from '@tic-tac-gulp/shared';
import type { GameState, MoveEvent, PieceSize } from '@tic-tac-gulp/shared';

export interface LocalStore {
  gameState: GameState | null;
  /** Which player's perspective the camera is currently showing */
  viewSide: 'P1' | 'P2';
  /** True while showing the pass screen between turns */
  passMode: boolean;
  selectedPieceSize: PieceSize | null;
  lastPlacedMoveCount: number | null;
  /** Auto-move timer handle */
  _autoMoveTimer: ReturnType<typeof setTimeout> | null;

  initGame: (p1Name: string, p2Name: string) => void;
  applyLocalMove: (pieceSize: PieceSize, row: number, col: number) => void;
  selectPiece: (size: PieceSize | null) => void;
  dismissPass: () => void;
  rematch: () => void;
  reset: () => void;
  scheduleAutoMove: () => void;
  cancelAutoMove: () => void;
}

const TURN_TIMEOUT_MS = 13_000;

export const useLocalStore = create<LocalStore>((set, get) => ({
  gameState: null,
  viewSide: 'P1',
  passMode: false,
  selectedPieceSize: null,
  lastPlacedMoveCount: null,
  _autoMoveTimer: null,

  initGame: (p1Name, p2Name) => {
    const s0 = createInitialState('LOCAL', p1Name, 'local-p1');
    const s1 = addSecondPlayer(s0, p2Name, 'local-p2');
    const s2 = startGame(s1);
    set({ gameState: s2, viewSide: 'P1', passMode: false });
    get().scheduleAutoMove();
  },

  applyLocalMove: (pieceSize, row, col) => {
    const { gameState, cancelAutoMove } = get();
    if (!gameState || gameState.status !== 'IN_PROGRESS') return;
    const { currentTurn, moveCount } = gameState;
    const move: MoveEvent = { playerId: currentTurn, pieceSize, row, col, moveIndex: moveCount };
    let next = resolveAfterMove(applyMove(gameState, move));
    const now = Date.now();
    if (next.status === 'IN_PROGRESS') {
      next = { ...next, turnStartedAt: now };
    }
    cancelAutoMove();

    if (next.status === 'ENDED') {
      set({ gameState: next, passMode: false, selectedPieceSize: null });
    } else {
      // Show pass screen — hides board from previous player while device is passed
      set({ gameState: next, passMode: true, selectedPieceSize: null, lastPlacedMoveCount: moveCount });
      // Don't start auto-move timer until pass screen is dismissed
    }
  },

  selectPiece: (selectedPieceSize) => set({ selectedPieceSize }),

  dismissPass: () => {
    const { gameState } = get();
    if (!gameState) return;
    const viewSide = gameState.currentTurn; // show board from new current player's perspective
    set({ passMode: false, viewSide });
    get().scheduleAutoMove();
  },

  rematch: () => {
    const { gameState, cancelAutoMove } = get();
    if (!gameState) return;
    cancelAutoMove();
    const next = resetGameState(gameState);
    set({ gameState: next, viewSide: 'P1', passMode: false, selectedPieceSize: null, lastPlacedMoveCount: null });
    get().scheduleAutoMove();
  },

  reset: () => {
    get().cancelAutoMove();
    set({ gameState: null, viewSide: 'P1', passMode: false, selectedPieceSize: null, lastPlacedMoveCount: null, _autoMoveTimer: null });
  },

  scheduleAutoMove: () => {
    const { cancelAutoMove, gameState } = get();
    cancelAutoMove();
    if (!gameState || gameState.status !== 'IN_PROGRESS') return;

    const h = setTimeout(() => {
      const state = get().gameState;
      if (!state || state.status !== 'IN_PROGRESS') return;
      const { currentTurn, players, moveCount } = state;
      const inv = players[currentTurn].inventory;
      const sizes: PieceSize[] = [1, 2, 3];
      let autoMove: MoveEvent | null = null;
      for (const pieceSize of sizes) {
        const count = pieceSize === 1 ? inv.small : pieceSize === 2 ? inv.medium : inv.large;
        if (count === 0) continue;
        const targets = getValidTargets(state, currentTurn, pieceSize);
        if (targets.length > 0) {
          const [r, c] = targets[Math.floor(Math.random() * targets.length)];
          autoMove = { playerId: currentTurn, pieceSize, row: r, col: c, moveIndex: moveCount };
          break;
        }
      }
      if (!autoMove) return;
      get().applyLocalMove(autoMove.pieceSize, autoMove.row, autoMove.col);
    }, TURN_TIMEOUT_MS);

    set({ _autoMoveTimer: h });
  },

  cancelAutoMove: () => {
    const { _autoMoveTimer } = get();
    if (_autoMoveTimer) {
      clearTimeout(_autoMoveTimer);
      set({ _autoMoveTimer: null });
    }
  },
}));
