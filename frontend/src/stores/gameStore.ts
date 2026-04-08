import { create } from 'zustand';
import type { GameState, PlayerId } from '@tic-tac-gulp/shared';

interface GameStore {
  // Server-authoritative state
  gameState: GameState | null;
  yourPlayerId: PlayerId | null;
  roomCode: string | null;
  sessionId: string | null;

  // UI state
  selectedPieceSize: 1 | 2 | 3 | null;
  isConnected: boolean;
  isReconnecting: boolean;
  lastMoveError: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  setSession: (playerId: PlayerId, roomCode: string, sessionId: string) => void;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  selectPiece: (size: 1 | 2 | 3 | null) => void;
  setMoveError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  gameState: null,
  yourPlayerId: null,
  roomCode: null,
  sessionId: null,
  selectedPieceSize: null,
  isConnected: false,
  isReconnecting: false,
  lastMoveError: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setGameState: (gameState) => set({ gameState }),

  setSession: (yourPlayerId, roomCode, sessionId) =>
    set({ yourPlayerId, roomCode, sessionId }),

  setConnected: (isConnected) => set({ isConnected }),

  setReconnecting: (isReconnecting) => set({ isReconnecting }),

  selectPiece: (selectedPieceSize) =>
    set({ selectedPieceSize, lastMoveError: null }),

  setMoveError: (lastMoveError) => set({ lastMoveError }),

  reset: () => set(initialState),
}));
