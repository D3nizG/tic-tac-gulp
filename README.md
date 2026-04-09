# Tic-Tac-Gulp

A realtime online multiplayer twist on tic-tac-toe. Stack larger pieces on top of smaller ones — **gulp** your opponent's pieces — and get 3 visible pieces in a row to win.

**Stack:** React · Node.js · Socket.IO · TypeScript · Vite · Zustand

**Backend:** `https://api.tic-tac-gulp.d3nizg.dev` (Railway) — deployment config in place  
**Frontend:** `https://tic-tac-gulp.d3nizg.dev` — coming in Phase 3

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
├── frontend/    React + Vite + Zustand client
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
# Backend (optional — defaults shown)
cp backend/.env.example backend/.env

# Frontend (optional — Vite proxy handles local API calls)
cp frontend/.env.example frontend/.env.local
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
| `REDIS_URL`       | *(unset)*                | Add Railway Redis addon in Phase 4            |

### Frontend

| Variable          | Default | Description                                         |
|-------------------|---------|-----------------------------------------------------|
| `VITE_SOCKET_URL` | `''`    | Backend URL (empty = Vite proxy; set in production) |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/game-rules.md`](docs/game-rules.md) | Full ruleset, piece inventory, turn structure, win/draw conditions, edge cases |
| [`docs/state-model.md`](docs/state-model.md) | TypeScript interfaces and state lifecycle |
| [`docs/api-spec.md`](docs/api-spec.md) | REST endpoints and WebSocket event reference |
| [`docs/architecture.md`](docs/architecture.md) | Monorepo structure, data flow, server authority model, scaling path |
| [`docs/multiplayer-flow.md`](docs/multiplayer-flow.md) | Sequence diagrams: room creation, moves, disconnect/reconnect, rematch |
| [`docs/deployment.md`](docs/deployment.md) | Railway setup, DNS config, env vars, Redis upgrade path |

---

## Tech Stack

| Layer             | Technology                     |
|-------------------|--------------------------------|
| Frontend          | React 18 + TypeScript + Vite   |
| State             | Zustand                        |
| Realtime (client) | socket.io-client               |
| Backend           | Node.js + Express + TypeScript |
| Realtime (server) | Socket.IO 4                    |
| Shared logic      | Pure TypeScript (no deps)      |
| Testing           | Vitest                         |
| Hosting           | Railway.app                    |

---

## Delivery Phases

| Phase | Goal                       | Status       |
|-------|----------------------------|--------------|
| 0     | Planning & spec            | ✅ Done      |
| 1     | Shared game logic + tests  | ✅ Done (29 tests passing) |
| 2     | Multiplayer backend        | ✅ Done (Socket.IO, rooms, reconnect, forfeit) |
| 3     | Gameplay polish + frontend | 🔄 Next      |
| 4     | Redis persistence          | Pending      |
| 5     | E2E testing + deployment   | Pending      |

---

## License

MIT
