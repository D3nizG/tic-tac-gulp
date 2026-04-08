# Architecture — Tic-Tac-Gulp

## Overview

Tic-Tac-Gulp is a monorepo with three packages and a shared game logic layer. The server is fully authoritative: all game state lives on the server, and clients receive read-only copies after every move.

---

## Monorepo Structure

```
tic-tac-gulp/
├── package.json            ← npm workspaces root
├── tsconfig.base.json      ← shared TypeScript base config
├── shared/                 ← Pure game logic (no I/O, no framework)
│   ├── src/
│   │   ├── types.ts
│   │   ├── boardEngine.ts
│   │   ├── moveValidator.ts
│   │   ├── winDetector.ts
│   │   ├── drawDetector.ts
│   │   ├── turnManager.ts
│   │   ├── gameFactory.ts
│   │   ├── endGameResolver.ts
│   │   ├── index.ts
│   │   └── __tests__/
│   │       └── gameLogic.test.ts
│   └── vitest.config.ts
├── backend/
│   └── src/
│       ├── index.ts        ← Entry point (starts HTTP server)
│       ├── server.ts       ← Express + Socket.IO setup
│       ├── routes/
│       │   └── rooms.ts    ← REST: create/join/get room
│       ├── socket/
│       │   └── handlers.ts ← All WebSocket event handlers
│       └── store/
│           └── roomStore.ts ← In-memory room + session store
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx         ← React Router routes
│       ├── index.css       ← Design tokens + resets
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   └── RoomPage.tsx
│       ├── components/
│       │   ├── LobbyView.tsx
│       │   ├── GameView.tsx
│       │   ├── GameBoard.tsx
│       │   ├── BoardCell.tsx
│       │   ├── PlayerPanel.tsx
│       │   └── GameOverOverlay.tsx
│       └── stores/
│           ├── gameStore.ts   ← Zustand: game + UI state
│           └── socketStore.ts ← Socket.IO singleton + event wiring
└── docs/
    ├── game-rules.md
    ├── state-model.md
    ├── api-spec.md
    ├── architecture.md    ← (this file)
    └── multiplayer-flow.md
```

---

## Technology Stack

| Layer              | Technology                     | Why                                              |
|---|---|---|
| Frontend           | React + TypeScript + Vite      | Mature, fast dev builds, great ecosystem         |
| State management   | Zustand                        | Minimal boilerplate, works naturally with React  |
| Realtime (client)  | socket.io-client               | Matches server, auto-reconnect built-in          |
| Routing            | react-router-dom v6            | Standard SPA routing                            |
| Backend            | Node.js + Express + TypeScript | Shared language with frontend, simple setup      |
| Realtime (server)  | Socket.IO                      | Room abstraction, reconnect, fallback transport  |
| Persistence (MVP)  | In-memory Map                  | Zero dependencies for Phase 1                    |
| Persistence (v2)   | Redis (Railway addon)          | TTL, survives restarts, enables horizontal scale |
| Testing (shared)   | Vitest                         | Fast, ESM-native, works with monorepo            |
| Hosting            | Railway.app                    | WebSocket support, Redis addon, GitHub CI/CD     |

---

## Data Flow

### Move Flow (Happy Path)

```
Frontend                         Backend (Node.js + Socket.IO)
────────                         ──────────────────────────────
User selects piece
  → getValidTargets() [shared]   (client-side UI highlight only)
User clicks valid cell
  → socket.emit('move:attempt')
                                 receive 'move:attempt'
                                   → getMoveError() [shared]
                                   → if error: emit 'move:error' to sender
                                   → applyMove() [shared]
                                   → resolveAfterMove() [shared]
                                     → checkWin() [shared]
                                     → checkDraw() [shared]
                                     → nextTurn() [shared]
                                   → roomStore.set(newState)
                                   → io.to(room).emit('game:state')
                                   → if ENDED: io.to(room).emit('game:ended')
receive 'game:state'
  → useGameStore.setGameState()
  → React re-renders board
```

### Reconnect Flow

```
Client                           Server
──────                           ──────
page load → check localStorage
  → socket.connect()
  → socket.emit('room:rejoin')
                                 receive 'room:rejoin'
                                   → match sessionId → playerId
                                   → cancel forfeit timer
                                   → mark player connected
                                   → emit 'room:joined' with full state
                                   → broadcast 'player:reconnected' to room
receive 'room:joined'
  → restore full game state
  → render board as-is
```

---

## Server Authority Model

- The server is the **sole source of truth** for all game state.
- The client never modifies game state locally — it only sends **move intents**.
- After every valid move, the server sends the **complete `GameState`** (not a diff) to all players in the room.
- Client-side move validation (e.g., `getValidTargets`) is purely for UX (highlighting) and is never trusted by the server.

**Benefits:**
- Eliminates desync by design.
- Simplifies client: it only renders what it receives.
- Makes cheating via client modification impossible.

---

## Shared Game Logic

All game logic lives in `shared/src/` as **pure functions with no side effects**. This means:

- Logic is fully unit-testable without a server or browser.
- The same code path runs on the server (for authoritative validation) and can run on the client (for UI highlighting).
- An AI opponent or local-mode can import the same modules.

Key modules:

| Module             | Exports                                               |
|---|---|
| `boardEngine`      | `applyMove`, `getTopPiece`, `createEmptyBoard`        |
| `moveValidator`    | `isLegalMove`, `getMoveError`, `getValidTargets`      |
| `winDetector`      | `checkWin`                                            |
| `drawDetector`     | `checkDraw`, `hasLegalMoves`                          |
| `turnManager`      | `nextTurn`, `isPlayerTurn`                            |
| `gameFactory`      | `createInitialState`, `addSecondPlayer`, `startGame`, `resetGameState`, `generateRoomCode` |
| `endGameResolver`  | `resolveAfterMove`, `forfeitGame`                     |

---

## Frontend State Architecture

```
Zustand stores
├── gameStore         ← Server-replicated state + UI state
│   ├── gameState       (authoritative, set from WS events)
│   ├── yourPlayerId
│   ├── sessionId
│   ├── roomCode
│   ├── selectedPieceSize (UI only)
│   ├── isConnected
│   ├── isReconnecting
│   └── lastMoveError
└── socketStore       ← Socket.IO singleton (not a Zustand store)
    └── getSocket()     emitMove(), emitStartGame(), etc.
```

The frontend never computes game outcomes — it renders whatever `gameStore.gameState` contains.

---

## Room Lifecycle

```
POST /api/rooms              → creates room (status: WAITING)
POST /api/rooms/:code/join   → assigns P2 session
socket room:join (P1)        → P1 connects, room updates
socket room:join (P2)        → P2 connects, status → LOBBY
socket game:start            → host starts, status → IN_PROGRESS
[moves play out]
status → ENDED               → rematch or leave
```

---

## Security Model

| Threat                | Mitigation                                                   |
|---|---|
| Illegal moves         | Server validates every move with `isLegalMove()` before applying |
| Move tampering        | Client sends intents only — never game state                 |
| Wrong-turn moves      | `moveIndex` must equal `state.moveCount`; turn checked       |
| Duplicate submissions | `moveIndex` idempotency check                                |
| Session spoofing      | `sessionId` is a server-generated UUID; not guessable        |
| Room spam             | Rate-limit `POST /api/rooms` to 5/min per IP                 |
| Stale rooms           | Redis TTL of 2 hours; in-memory rooms cleaned up on end      |
| XSS / injection       | Display names validated (3–16 chars, no special chars)       |
| CORS                  | Configured to frontend origin only                           |

---

## Scaling Path

The MVP runs on a single Node.js process. To scale horizontally:

1. Replace in-memory `roomStore` with a Redis adapter.
2. Use Socket.IO's Redis adapter (`@socket.io/redis-adapter`) for cross-process event broadcasting.
3. Add a sticky-session load balancer (or use WebSocket-aware LB).

This path is non-breaking — the interface of `roomStore` is already abstracted.
