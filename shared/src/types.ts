// ─── Piece ────────────────────────────────────────────────────────────────────

export type PieceSize = 1 | 2 | 3; // 1=Small, 2=Medium, 3=Large
export type PlayerId = 'P1' | 'P2';

export interface Piece {
  owner: PlayerId;
  size: PieceSize;
}

// ─── Board ────────────────────────────────────────────────────────────────────

export interface Cell {
  row: number;
  col: number;
  /** Ordered bottom→top. The last element is the visible piece. */
  stack: Piece[];
}

/** 3×3 board: board[row][col] */
export type Board = Cell[][];

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface Inventory {
  small: number;  // 0–3
  medium: number; // 0–3
  large: number;  // 0–3
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: PlayerId;
  displayName: string;
  sessionId: string;
  socketId: string | null;
  connected: boolean;
  inventory: Inventory;
  /** Supabase user id — null for guest players. */
  userId: string | null;
}

// ─── Game State ───────────────────────────────────────────────────────────────

export type GameStatus = 'WAITING' | 'LOBBY' | 'IN_PROGRESS' | 'ENDED';

export interface GameState {
  roomCode: string;
  status: GameStatus;
  board: Board;
  players: { P1: Player; P2: Player };
  currentTurn: PlayerId;
  moveCount: number;
  winner: PlayerId | 'DRAW' | null;
  /** Cells that form the winning line, e.g. [[0,0],[1,1],[2,2]] */
  winLine: [number, number][] | null;
  endReason: 'normal' | 'forfeit' | 'resign' | null;
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms
  gameStartedAt: number | null;  // epoch ms — set when status transitions to IN_PROGRESS
  turnStartedAt: number | null;  // epoch ms — reset after each move; drives per-turn countdown
}

// ─── Move ─────────────────────────────────────────────────────────────────────

export interface MoveEvent {
  playerId: PlayerId;
  pieceSize: PieceSize;
  row: number;
  col: number;
  /** Monotonically increasing. Used for idempotency checks. */
  moveIndex: number;
}

// ─── Match Result ─────────────────────────────────────────────────────────────

export interface MatchResult {
  roomCode: string;
  winner: PlayerId | 'DRAW';
  endReason: 'normal' | 'forfeit';
  moveCount: number;
  durationMs: number;
  P1Name: string;
  P2Name: string;
  endedAt: number; // epoch ms
}

// ─── Error Codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'INVALID_MOVE'
  | 'NOT_YOUR_TURN'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'SESSION_INVALID'
  | 'GAME_NOT_STARTED'
  | 'PIECE_UNAVAILABLE'
  | 'CELL_BLOCKED';
