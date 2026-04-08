# Tic-Tac-Gulp

A realtime online multiplayer twist on tic-tac-toe. Stack larger pieces on top of smaller ones — **gulp** your opponent's pieces — and get 3 visible pieces in a row to win.

**Stack:** React · Node.js · Socket.IO · TypeScript · Vite · Zustand

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
└── docs/        Architecture, API spec, game rules, state model
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

### Run (both frontend + backend)

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:3001

To run separately:

```bash
# Backend only
npm run dev -w backend

# Frontend only
npm run dev -w frontend
```

### Run Tests

```bash
npm test
# or run with watch mode
npm run test:watch -w shared
```

Tests cover all shared game logic: move validation, win detection, draw detection, turn management, and edge cases.

---

## Environment Variables

### Backend

| Variable          | Default                    | Description                       |
|---|---|---|
| `PORT`            | `3001`                     | HTTP server port                  |
| `FRONTEND_ORIGIN` | `http://localhost:3000`    | CORS allowed origin               |
| `REDIS_URL`       | *(none — uses in-memory)*  | Redis connection string (Phase 4) |

### Frontend

| Variable          | Default | Description                          |
|---|---|---|
| `VITE_SOCKET_URL` | `''`    | Socket.IO server URL (empty = proxy) |

Create a `.env` file in `backend/` for local overrides.

---

## Documentation

| Document                                    | Contents                                  |
|---|---|
| [`docs/game-rules.md`](docs/game-rules.md)         | Full ruleset with edge cases              |
| [`docs/state-model.md`](docs/state-model.md)       | TypeScript interfaces and lifecycle       |
| [`docs/api-spec.md`](docs/api-spec.md)             | REST and WebSocket API reference          |
| [`docs/architecture.md`](docs/architecture.md)     | Stack, data flow, security, scaling       |
| [`docs/multiplayer-flow.md`](docs/multiplayer-flow.md) | Sequence diagrams for all flows       |

---

## Tech Stack

| Layer              | Technology                     |
|---|---|
| Frontend           | React 18 + TypeScript + Vite   |
| State              | Zustand                        |
| Realtime (client)  | socket.io-client               |
| Backend            | Node.js + Express + TypeScript |
| Realtime (server)  | Socket.IO 4                    |
| Shared logic       | Pure TypeScript (no deps)      |
| Testing            | Vitest                         |
| Hosting (target)   | Railway.app                    |

---

## Delivery Phases

| Phase | Goal                     | Status  |
|---|---|---|
| 0     | Planning & spec          | ✅ Done |
| 1     | Local prototype + tests  | 🔄 In progress |
| 2     | Multiplayer foundation   | Pending |
| 3     | Gameplay polish          | Pending |
| 4     | Persistence & reliability| Pending |
| 5     | Deployment & E2E testing | Pending |

---

## License

MIT
