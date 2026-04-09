# Tic-Tac-Gulp

A realtime online multiplayer twist on tic-tac-toe. Stack larger pieces on top of smaller ones — **gulp** your opponent's pieces — and get 3 visible pieces in a row to win.

**Stack:** React 19 · Three.js (R3F) · Node.js · Socket.IO · TypeScript · Vite · Zustand · Motion for React

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
└── docs/        Architecture, API spec, game rules, state model, deployment, roadmap
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

### Run (frontend + backend together)

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

`VITE_SOCKET_URL` is not needed locally — the Vite proxy in `vite.config.ts` forwards `/api` and `/socket.io` to the backend automatically.

### Run Tests

```bash
npm test
```

29 unit tests covering all game logic.

---

## Environment Variables

### Backend

| Variable          | Default                 | Description                                    |
|-------------------|-------------------------|------------------------------------------------|
| `PORT`            | `3001`                  | Set automatically by Railway                   |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Comma-separated allowed CORS origins           |
| `NODE_ENV`        | *(unset)*               | Set to `production` on Railway                 |
| `REDIS_URL`       | *(unset)*               | Redis connection (Phase 4+)                    |
| `DATABASE_URL`    | *(unset)*               | Postgres connection (Phase 5+)                 |
| `JWT_SECRET`      | *(unset)*               | JWT signing secret (Phase 5+)                  |

### Frontend

| Variable          | Default | Description                                                    |
|-------------------|---------|----------------------------------------------------------------|
| `VITE_SOCKET_URL` | `''`    | Backend URL. Empty = Vite proxy (local). Set in Vercel for prod. |

---

## Tech Stack

| Layer             | Technology                                   |
|-------------------|----------------------------------------------|
| Frontend          | React 19 + TypeScript + Vite                 |
| 3D Rendering      | Three.js + React Three Fiber v9 + Drei v10   |
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

## Documentation

| Document | Contents |
|---|---|
| [`docs/game-rules.md`](docs/game-rules.md) | Full ruleset, piece inventory, edge cases |
| [`docs/state-model.md`](docs/state-model.md) | TypeScript interfaces and state lifecycle |
| [`docs/api-spec.md`](docs/api-spec.md) | REST endpoints and WebSocket event reference |
| [`docs/architecture.md`](docs/architecture.md) | Monorepo structure, data flow, server authority model |
| [`docs/multiplayer-flow.md`](docs/multiplayer-flow.md) | Sequence diagrams for room, move, disconnect, rematch |
| [`docs/deployment.md`](docs/deployment.md) | Railway + Vercel setup, DNS, env vars |
| [`docs/roadmap.md`](docs/roadmap.md) | Full feature roadmap from MVP to full web app |

---

## Current Status

### What works today

- Create a game room and share a 6-character code with a friend
- Full 3D board rendered with React Three Fiber — constrained orbit camera, piece drop animations, win cell pulse, hover ghosts
- Server-authoritative game state — no client-side cheating possible
- Disconnect/reconnect with 60-second forfeit window
- Resign mid-game with a 2-click confirm (auto-cancels)
- In-game chat with unread badge, rate limiting, player-color bubbles
- 3-state rematch indicator (idle / waiting / opponent wants / unavailable)
- Opponent profile overlay (session W/L/D + current inventory)
- Game elapsed clock
- Responsive down to 375px

### What's left in Phase 4

- Per-turn countdown (13s) with server-side auto-move
- Player-perspective camera angles (P1 and P2 see from opposite sides)
- Local pass-and-play mode (2 players, same device)

### What's missing for a full web app

See [`docs/roadmap.md`](docs/roadmap.md) for the full breakdown. In short:

- User accounts, auth, persistent profiles
- Matchmaking (ranked/casual queue)
- Social layer (friends, notifications)
- AI opponent
- Leaderboard and stats
- Redis persistence (rooms survive backend restarts)
- Database (users, match history, ratings)

---

## Delivery Phases

| Phase | Goal                                         | Status       |
|-------|----------------------------------------------|--------------|
| 0     | Planning & spec                              | ✅ Done      |
| 1     | Shared game logic + tests                    | ✅ Done (40 tests passing) |
| 2     | Multiplayer backend                          | ✅ Done (Socket.IO, rooms, reconnect, forfeit) |
| 3     | 3D frontend, Motion UI, Vercel deploy        | ✅ Done      |
| 4     | In-game polish                               | 🔄 In progress |
| 5     | Redis + Postgres + user accounts + auth      | Planned      |
| 6     | Matchmaking, profiles, stats, leaderboard    | Planned      |
| 7     | AI opponent                                  | Planned      |
| 8     | Social layer (friends, notifications)        | Planned      |

Full roadmap with implementation details → [`docs/roadmap.md`](docs/roadmap.md)

---

## License

MIT
