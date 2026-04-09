# Tic-Tac-Gulp

A realtime online multiplayer twist on tic-tac-toe. Stack larger pieces on top of smaller ones — **gulp** your opponent's pieces — and get 3 visible pieces in a row to win.

**Stack:** React · Three.js (R3F) · Node.js · Socket.IO · TypeScript · Vite · Zustand · Motion for React

**Backend:** `https://api.tic-tac-gulp.d3nizg.dev` (Railway)  
**Frontend:** `https://tic-tac-gulp.d3nizg.dev` (Vercel)

---

## Game Rules (Quick Version)

- 3×3 grid. Two players. Blue (P1) goes first.
- Each player has 9 pieces: 3 Small, 3 Medium, 3 Large.
- A larger piece can cover (gulp) a smaller piece on any cell.
- Only the **visible top piece** counts toward winning.
- First to get 3 visible pieces in a row wins.

Full rules → [`docs/game-rules.md`](docs/game-rules.md)

---

## Project Structure

```
tic-tac-gulp/
├── shared/      Pure game logic (types, rules, move validation, win detection)
├── backend/     Node.js + Express + Socket.IO server
├── frontend/    React + Vite + Zustand client (3D board via React Three Fiber)
└── docs/        Architecture, API spec, game rules, state model, deployment
```

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Environment

```bash
# Frontend — point to local backend (Vite proxy handles /api and /socket.io)
# VITE_SOCKET_URL is NOT needed locally — the proxy in vite.config.ts handles it
```

### Run (frontend + backend together)

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:3001

Run separately:

```bash
npm run dev -w backend
npm run dev -w frontend
```

### Run Tests

```bash
npm test
```

29 unit tests covering all game logic — move validation, win detection, draw detection, stacking rules, edge cases.

---

## Environment Variables

### Backend

| Variable          | Default                  | Description                                   |
|-------------------|--------------------------|-----------------------------------------------|
| `PORT`            | `3001`                   | Set automatically by Railway — do not override|
| `FRONTEND_ORIGIN` | `http://localhost:3000`  | Comma-separated allowed CORS origins          |
| `NODE_ENV`        | *(unset)*                | Set to `production` on Railway                |

### Frontend

| Variable          | Default | Description                                                  |
|-------------------|---------|--------------------------------------------------------------|
| `VITE_SOCKET_URL` | `''`    | Backend URL. Empty = Vite proxy (local). Set to backend URL in Vercel. |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/game-rules.md`](docs/game-rules.md) | Full ruleset, piece inventory, turn structure, win/draw conditions, edge cases |
| [`docs/state-model.md`](docs/state-model.md) | TypeScript interfaces and state lifecycle |
| [`docs/api-spec.md`](docs/api-spec.md) | REST endpoints and WebSocket event reference |
| [`docs/architecture.md`](docs/architecture.md) | Monorepo structure, data flow, server authority model, scaling path |
| [`docs/multiplayer-flow.md`](docs/multiplayer-flow.md) | Sequence diagrams: room creation, moves, disconnect/reconnect, rematch |
| [`docs/deployment.md`](docs/deployment.md) | Railway + Vercel setup, DNS config, env vars |

---

## Tech Stack

| Layer             | Technology                                   |
|-------------------|----------------------------------------------|
| Frontend          | React 18 + TypeScript + Vite                 |
| 3D Rendering      | Three.js + React Three Fiber + Drei          |
| Animation         | Motion for React v12                         |
| State             | Zustand                                      |
| Realtime (client) | socket.io-client                             |
| Backend           | Node.js + Express + TypeScript               |
| Realtime (server) | Socket.IO 4                                  |
| Shared logic      | Pure TypeScript (no deps)                    |
| Testing           | Vitest                                       |
| Frontend hosting  | Vercel                                       |
| Backend hosting   | Railway.app                                  |

---

## Delivery Phases

| Phase | Goal                                    | Status       |
|-------|-----------------------------------------|--------------|
| 0     | Planning & spec                         | ✅ Done      |
| 1     | Shared game logic + tests               | ✅ Done (29 tests passing) |
| 2     | Multiplayer backend                     | ✅ Done (Socket.IO, rooms, reconnect, forfeit) |
| 3     | 3D frontend, Motion UI, Vercel deploy   | ✅ Done      |
| 4     | Redis persistence                       | Pending      |
| 5     | E2E testing + observability             | Pending      |

---

## Expected Behavior

### Landing Page
- Dark navy background with subtle grid lines and blue glow
- Oxanium display font title with orange "Gulp" accent
- Frosted glass card with name input and Create/Join buttons
- Spring entrance animations on load

### Lobby
- Share the 6-character room code with your opponent
- Slots animate in as players join
- Host sees animated "Start Game" button that pulses when both players are ready

### Gameplay
- 3D board viewed from a strategic top-down angle (constrained camera — rotate but can't flip under)
- Hover a cell to see a ghost preview of your selected piece
- Valid cells glow with a ring indicator; winning cells pulse gold
- Pieces drop in with a spring animation
- Buried pieces show as faint outlines beneath the top piece
- Piece panel at top (opponent) and bottom (you) — click to select a size

### Turn Flow
- Turn badge crossfades between "Your turn" (yellow) and opponent's name
- After placing a piece, control passes immediately
- Invalid moves trigger a cell shake animation

### Game Over
- Overlay springs in: trophy for win, skull for loss, scale for draw
- Rematch or Leave options

### Disconnect
- If your opponent disconnects, a banner slides in from the top with a 60-second countdown
- If you disconnect, the server holds a 60-second forfeit window for reconnection
- If the window expires, the connected player wins by forfeit

---

## License

MIT
