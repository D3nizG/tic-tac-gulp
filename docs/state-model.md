# State Model — Tic-Tac-Gulp

All TypeScript types live in `shared/src/types.ts` and are re-exported from `shared/src/index.ts`.

---

## Core Types

```typescript
type PieceSize = 1 | 2 | 3;         // 1=Small, 2=Medium, 3=Large
type PlayerId  = 'P1' | 'P2';
type GameStatus = 'WAITING' | 'LOBBY' | 'IN_PROGRESS' | 'ENDED';
```

---

## Piece

```typescript
interface Piece {
  owner: PlayerId;
  size: PieceSize;
}
```

A `Piece` is a value object. It carries no ID — only its owner and size matter.

---

## Cell

```typescript
interface Cell {
  row: number;   // 0–2
  col: number;   // 0–2
  stack: Piece[]; // ordered bottom→top; last element is visible
}
```

- An empty cell has `stack = []`.
- `stack[stack.length - 1]` is the **visible top piece**.
- Covered pieces remain in the stack — they are never removed.

---

## Board

```typescript
type Board = Cell[][];   // board[row][col], both 0–2
```

The board is a 3×3 2D array. Always access as `board[row][col]`.

---

## Inventory

```typescript
interface Inventory {
  small: number;   // 0–3
  medium: number;  // 0–3
  large: number;   // 0–3
}
```

Tracks how many pieces of each size a player has remaining. Counts only decrease — placed pieces cannot be reclaimed.

---

## Player

```typescript
interface Player {
  id: PlayerId;
  displayName: string;
  sessionId: string;       // UUID assigned at room creation/join
  socketId: string | null; // current socket connection (null if disconnected)
  connected: boolean;
  inventory: Inventory;
}
```

> **Security note:** `socketId` is stripped from all payloads sent to clients. Only the server holds this value.

---

## GameState

```typescript
interface GameState {
  roomCode: string;
  status: GameStatus;
  board: Board;
  players: { P1: Player; P2: Player };
  currentTurn: PlayerId;
  moveCount: number;              // monotonically increasing; used for idempotency
  winner: PlayerId | 'DRAW' | null;
  winLine: [number, number][] | null; // e.g. [[0,0],[1,1],[2,2]]
  endReason: 'normal' | 'forfeit' | null;
  createdAt: number;              // epoch ms
  updatedAt: number;              // epoch ms
}
```

### GameStatus Lifecycle

```
WAITING ──► LOBBY ──► IN_PROGRESS ──► ENDED
                           ▲              │
                           └── rematch ───┘
```

| Status       | Meaning                                              |
|---|---|
| `WAITING`    | Room created, only P1 has joined                     |
| `LOBBY`      | Both players present, host hasn't started yet        |
| `IN_PROGRESS`| Game running, moves accepted                         |
| `ENDED`      | Game over (win, draw, or forfeit)                    |

---

## MoveEvent

```typescript
interface MoveEvent {
  playerId: PlayerId;
  pieceSize: PieceSize;
  row: number;        // 0–2
  col: number;        // 0–2
  moveIndex: number;  // must equal state.moveCount at time of validation
}
```

`moveIndex` is used for idempotency. If a client sends a move with a stale index (e.g., after reconnecting), the server rejects it.

---

## MatchResult

```typescript
interface MatchResult {
  roomCode: string;
  winner: PlayerId | 'DRAW';
  endReason: 'normal' | 'forfeit';
  moveCount: number;
  durationMs: number;
  P1Name: string;
  P2Name: string;
  endedAt: number;    // epoch ms
}
```

Stored to Redis after each game ends (optional in MVP).

---

## Error Codes

```typescript
type ErrorCode =
  | 'INVALID_MOVE'       // Violates game rules
  | 'NOT_YOUR_TURN'      // Move sent out of turn
  | 'ROOM_NOT_FOUND'     // No room with that code
  | 'ROOM_FULL'          // Room already has 2 players
  | 'GAME_IN_PROGRESS'   // Can't join an active game
  | 'SESSION_INVALID'    // Unknown or expired session
  | 'GAME_NOT_STARTED'   // Move sent before game started
  | 'PIECE_UNAVAILABLE'  // Player has none of that size
  | 'CELL_BLOCKED';      // Target cell's top piece is equal/larger
```

---

## Persistence vs In-Memory

| Data                   | Storage                          | TTL       |
|---|---|---|
| Active `GameState`     | Server memory (Map)              | Until room expires |
| `GameState` (backup)   | Redis (JSON string)              | 2 hours   |
| Player session         | Redis (keyed by `sessionId`)     | 24 hours  |
| Room → session mapping | Redis                            | 2 hours   |
| `MatchResult`          | Redis (append to list)           | Indefinite (optional) |
| Forfeit timer handles  | Server memory (Map)              | Cleared on reconnect |

**For MVP**, server memory is acceptable. Redis is added in Phase 4 to survive server restarts.

---

## What the Client Never Sees

- `Player.socketId` — stripped in `sanitizeState()` before broadcasting
- Internal forfeit timer handles
- `_rematchAccepted` metadata (transient server-side tracking)
