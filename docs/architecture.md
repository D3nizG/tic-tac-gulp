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
│   ├── vercel.json         ← SPA routing rewrite for Vercel
│   └── src/
│       ├── main.tsx        ← React root + ErrorBoundary
│       ├── App.tsx         ← React Router routes
│       ├── index.css       ← Design tokens, fonts, resets
│       ├── pages/
│       │   ├── LandingPage.tsx   ← Create/join game (Motion animated)
│       │   └── RoomPage.tsx      ← Routes to LobbyView or GameView
│       ├── components/
│       │   ├── LobbyView.tsx         ← Lobby: room code, player slots (Motion)
│       │   ├── GameView.tsx          ← Game shell: canvas + overlaid UI panels
│       │   ├── PlayerPanel.tsx       ← Piece inventory selector (motion.button)
│       │   ├── TurnBadge.tsx         ← AnimatePresence turn crossfade
│       │   ├── GameOverlay.tsx       ← Spring-entrance win/lose/draw modal
│       │   ├── ConnectionBanner.tsx  ← Slide-down disconnect notification
│       │   └── ErrorBoundary.tsx     ← Catches render errors, shows stack trace
│       ├── scene/                    ← Everything inside the R3F Canvas
│       │   ├── GameScene.tsx         ← Canvas setup, lighting, fog, camera rig
│       │   ├── Board.tsx             ← 3D board base plate + grid lines
│       │   ├── CellMesh.tsx          ← Per-cell: click target, hover, highlights
│       │   ├── PieceMesh.tsx         ← Animated piece (drop-in spring)
│       │   └── CameraRig.tsx         ← Constrained OrbitControls
│       └── stores/
│           ├── gameStore.ts    ← Zustand: game + UI + animation state
│           └── socketStore.ts  ← Socket.IO singleton + event wiring
└── docs/
```

---

## Technology Stack

| Layer              | Technology                               | Why                                              |
|--------------------|------------------------------------------|--------------------------------------------------|
| Frontend           | React 18 + TypeScript + Vite             | Mature, fast dev builds, great ecosystem         |
| 3D rendering       | Three.js + React Three Fiber + Drei      | Declarative Three.js in React, excellent DX      |
| UI animation       | Motion for React v12 (`motion/react`)    | Spring physics, AnimatePresence, performant       |
| State management   | Zustand                                  | Minimal boilerplate, works naturally with React  |
| Realtime (client)  | socket.io-client                         | Matches server, auto-reconnect built-in          |
| Routing            | react-router-dom v6                      | Standard SPA routing                             |
| Backend            | Node.js + Express + TypeScript           | Shared language with frontend, simple setup      |
| Realtime (server)  | Socket.IO                                | Room abstraction, reconnect, fallback transport  |
| Persistence (MVP)  | In-memory Map                            | Zero dependencies for Phase 1                    |
| Persistence (v2)   | Redis (Railway addon)                    | TTL, survives restarts, enables horizontal scale |
| Testing (shared)   | Vitest                                   | Fast, ESM-native, works with monorepo            |
| Frontend hosting   | Vercel                                   | Static CDN, SPA routing, custom domain           |
| Backend hosting    | Railway.app                              | WebSocket support, Redis addon, GitHub CI/CD     |

---

## Frontend Visual Design

**Aesthetic:** Premium digital board game. Dark, tactile, strategic.

| Token            | Value                  | Use                         |
|------------------|------------------------|-----------------------------|
| `--bg`           | `#0a0f1e`              | Page background             |
| `--surface`      | `#141c33`              | Cards, panels               |
| `--p1-primary`   | `#2563eb`              | P1 Blue pieces + UI         |
| `--p2-primary`   | `#ea580c`              | P2 Orange pieces + UI       |
| `--highlight`    | `#fbbf24`              | Win cells, your turn badge  |
| `--font-display` | Oxanium                | Headings, scores, labels    |
| `--font-body`    | DM Sans                | Body text, inputs           |

**3D Scene:**
- Canvas background: `#0a0f1e` + `FogExp2` density 0.038
- Board: dark slate BoxGeometry, `MeshStandardMaterial` roughness 0.85
- Pieces: `CylinderGeometry` — S(r:0.32, h:0.18), M(r:0.42, h:0.26), L(r:0.54, h:0.36)
- Lighting: ambient `#8ba4d4` + directional with shadows + rim light `#4a7abf`
- Camera: position `(0, 7, 5)`, fov 45, constrained orbit (no flip, no pan)

---

## Data Flow

### Move Flow (Happy Path)

```
Frontend                         Backend (Node.js + Socket.IO)
────────                         ──────────────────────────────
User selects piece size
  → getValidTargets() [shared]   (client-side UI highlight only)
User clicks valid cell
  → socket.emit('move:attempt', { pieceSize, row, col, moveIndex })
                                 receive 'move:attempt'
                                   → getMoveError() [shared]
                                   → if error: emit 'move:error' to sender
                                   → applyMove() [shared]
                                   → resolveAfterMove() [shared]
                                     → checkWin() → checkDraw() → nextTurn()
                                   → roomStore.set(newState)
                                   → io.to(room).emit('game:state', { gameState })
receive 'game:state'
  → recordMove(moveCount - 1)    ← triggers drop animation on last placed piece
  → setGameState(gameState)
  → React re-renders board
```

### Reconnect Flow

```
Client                           Server
──────                           ──────
page load → check localStorage
  → socket.connect()
  → socket.emit('room:rejoin', { sessionId, roomCode })
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

### Disconnect / Forfeit Flow

```
Client disconnects               Server
──────────────────               ──────
socket 'disconnect'
                                 start 60s forfeit timer
                                 emit 'player:disconnected' to room
                                   { playerId, timeoutSeconds: 60 }
  [if reconnects within 60s]
  socket.emit('room:rejoin')  →  cancel timer, restore session
                                 emit 'player:reconnected'

  [if timeout expires]
                                 forfeitGame() → ENDED
                                 emit 'game:ended' to room
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
- The same code runs on the server (authoritative validation) and client (UI highlighting).
- An AI opponent or local-mode can import the same modules.

Key modules:

| Module             | Exports                                               |
|--------------------|-------------------------------------------------------|
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
└── gameStore
    ├── gameState              ← Full GameState from server (authoritative)
    ├── yourPlayerId           ← Which player you are in this session
    ├── roomCode
    ├── sessionId              ← UUID for reconnection
    ├── selectedPieceSize      ← UI: which piece size is currently selected
    ├── isConnected            ← Socket connection status
    ├── isReconnecting         ← True while trying to reconnect
    ├── lastMoveError          ← Error string from last failed move attempt
    ├── lastPlacedMoveCount    ← moveCount at time of last placement (for drop animation)
    └── disconnectedPlayer     ← PlayerId of disconnected opponent (for banner)

socketStore (not Zustand — plain module singleton)
└── getSocket()               ← Creates/returns socket.io Socket
    emitMove(size, row, col)
    emitStartGame()
    emitRematchAccept()
    emitRematchDecline()
```

The frontend never computes game outcomes — it renders whatever `gameStore.gameState` contains.

---

## 3D Scene Architecture

The 3D game board runs inside a React Three Fiber `<Canvas>`. All scene components must be children of `<Canvas>` and use R3F-specific hooks (`useFrame`, `useThree`).

```
GameScene (Canvas)
├── Lighting (ambientLight, directionalLight ×2, pointLight)
├── Environment (city preset, environmentIntensity 0.3)
├── CameraRig (OrbitControls — constrained, no pan, limited angles)
├── Board (base plate + grid lines as BoxGeometry meshes)
└── CellMesh ×9 (one per cell)
    ├── Invisible click plane (BoxGeometry, transparent)
    ├── Cell surface tint (win / valid / hover states)
    ├── Valid target ring (RingGeometry, AnimatePresence-like via useFrame)
    ├── Ghost piece on hover (translucent CylinderGeometry)
    └── PieceMesh ×n (stacked, computed Y positions)
        ├── Top piece: full material + emissive glow
        └── Buried pieces: semi-transparent (opacity 0.18)
```

**Drop animation:** `PieceMesh` stores `dropY` in a ref, initializes to `position.y + 3.5` when `justPlaced`, and lerps toward `restY` each frame via `useFrame`.

**Win cell:** `useFrame` in `CellMesh` pulses `emissiveIntensity` of the cell glow mesh using `Math.sin(clock.elapsedTime)`.

**Invalid shake:** `CellMesh` uses a `shakeRef` counter decremented each frame, with `Math.sin` applied to the group's X position.

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
socket rematch:accept ×2     → resetGameState(), status → IN_PROGRESS
```

---

## Security Model

| Threat                | Mitigation                                                   |
|-----------------------|--------------------------------------------------------------|
| Illegal moves         | Server validates every move with `isLegalMove()` before applying |
| Move tampering        | Client sends intents only — never game state                 |
| Wrong-turn moves      | `moveIndex` must equal `state.moveCount`; turn checked       |
| Duplicate submissions | `moveIndex` idempotency check                                |
| Session spoofing      | `sessionId` is a server-generated UUID; not guessable        |
| Stale rooms           | Redis TTL of 2 hours (Phase 4); in-memory rooms cleared on game end |
| XSS / injection       | Display names validated (3–16 characters)                    |
| CORS                  | Configured to frontend origin only via `FRONTEND_ORIGIN` env var |

---

## Scaling Path

The MVP runs on a single Node.js process. To scale horizontally:

1. Replace in-memory `roomStore` with a Redis adapter.
2. Use Socket.IO's Redis adapter (`@socket.io/redis-adapter`) for cross-process event broadcasting.
3. Add a sticky-session load balancer (or use WebSocket-aware LB).

This path is non-breaking — the interface of `roomStore` is already abstracted.
