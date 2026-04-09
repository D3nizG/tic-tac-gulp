import { create } from 'zustand';
import type { GameState, PlayerId } from '@tic-tac-gulp/shared';

export interface ChatMessage {
  playerId: PlayerId;
  text: string;
  timestamp: number;
}

export type RematchState = 'idle' | 'i_requested' | 'opponent_requested' | 'unavailable';

interface SessionStats {
  wins: number;
  losses: number;
  draws: number;
}

interface GameStore {
  // Server-authoritative state
  gameState: GameState | null;
  yourPlayerId: PlayerId | null;
  roomCode: string | null;
  sessionId: string | null;

  // UI / animation state
  selectedPieceSize: 1 | 2 | 3 | null;
  isConnected: boolean;
  isReconnecting: boolean;
  lastMoveError: string | null;
  /** moveCount at the time the last piece was placed — used for drop animation */
  lastPlacedMoveCount: number | null;
  /** Which player just disconnected (for banner) */
  disconnectedPlayer: PlayerId | null;

  // Phase 4 state
  rematchState: RematchState;
  chatMessages: ChatMessage[];
  unreadChat: number;
  sessionStats: SessionStats;

  // Actions
  setGameState: (state: GameState) => void;
  setSession: (playerId: PlayerId, roomCode: string, sessionId: string) => void;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  selectPiece: (size: 1 | 2 | 3 | null) => void;
  setMoveError: (error: string | null) => void;
  recordMove: (moveCount: number) => void;
  setDisconnectedPlayer: (p: PlayerId | null) => void;
  setRematchState: (state: RematchState) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearUnreadChat: () => void;
  incrementStats: (result: 'win' | 'loss' | 'draw') => void;
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
  lastPlacedMoveCount: null,
  disconnectedPlayer: null,
  rematchState: 'idle' as RematchState,
  chatMessages: [] as ChatMessage[],
  unreadChat: 0,
  sessionStats: { wins: 0, losses: 0, draws: 0 },
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setGameState: (gameState) => set({ gameState }),

  setSession: (yourPlayerId, roomCode, sessionId) =>
    set({ yourPlayerId, roomCode, sessionId }),

  setConnected: (isConnected) => set({ isConnected }),

  setReconnecting: (isReconnecting) => set({ isReconnecting }),

  selectPiece: (selectedPieceSize) =>
    set({ selectedPieceSize, lastMoveError: null }),

  setMoveError: (lastMoveError) => set({ lastMoveError }),

  recordMove: (moveCount) => set({ lastPlacedMoveCount: moveCount }),

  setDisconnectedPlayer: (disconnectedPlayer) => set({ disconnectedPlayer }),

  setRematchState: (rematchState) => set({ rematchState }),

  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, msg],
      unreadChat: s.unreadChat + 1,
    })),

  clearUnreadChat: () => set({ unreadChat: 0 }),

  incrementStats: (result) =>
    set((s) => ({
      sessionStats: {
        wins: s.sessionStats.wins + (result === 'win' ? 1 : 0),
        losses: s.sessionStats.losses + (result === 'loss' ? 1 : 0),
        draws: s.sessionStats.draws + (result === 'draw' ? 1 : 0),
      },
    })),

  reset: () => {
    const { sessionStats } = get();
    set({ ...initialState, sessionStats });
  },
}));
