# Roadmap — Tic-Tac-Gulp

This document covers the path from the current invite-only MVP to a fully-fledged online web app game. Each phase builds on the last. Phases within a tier can be reordered based on priority.

---

## Current State (Phase 3 complete)

The game is fully playable with a shareable invite code. Two players can:
- Create/join a room, play a full game on a 3D board
- Reconnect within 60 seconds if disconnected (forfeit on timeout)
- Accept/decline a rematch after a game ends
- Play on mobile (responsive to 375px)

**What it lacks to be a real web app:** accounts, persistence, in-game quality of life, matchmaking, social features, and AI.

---

## Phase 4 — In-Game Polish (No Auth Required)

These are UX improvements that work with the existing anonymous session model. Highest bang-for-buck before adding auth complexity.

### 4a. Rematch button — 3 states

The current rematch button has no feedback about the opponent's intent. It needs three states:

| State | Trigger | UI |
|---|---|---|
| **Idle** | Game just ended | "Rematch" button, blue |
| **Waiting** | You clicked Rematch, opponent hasn't | "Waiting for opponent…" spinner |
| **Opponent wants rematch** | Opponent clicked Rematch first | Badge: "Opponent wants a rematch!" — button pulses |
| **Declined / Left** | Opponent left the lobby or declined | Button grayed out: "Opponent left" |

**Implementation:**
- Add `rematchRequested: Set<PlayerId>` to server room state (already partially present)
- Emit `rematch:requested` event when one player accepts, before both have
- Add `rematch:declined` event
- On `player:disconnected` during ENDED state — emit `rematch:unavailable`
- Frontend: `GameOverlay` reads `gameState.rematchRequested` to drive button state

### 4b. Resign button

Allow a player to concede at any point during an `IN_PROGRESS` game.

**Implementation:**
- New socket event: `game:resign` → `{ sessionId, roomCode }`
- Server calls `forfeitGame(state, resigningPlayerId)` (same logic as disconnect forfeit)
- Broadcasts `game:ended` with `endReason: 'resign'`
- Frontend: small "Resign" button in `GameView` (tucked in corner, requires confirm tap/click to prevent accidents)
- `GameOverlay` shows "You resigned" / "Opponent resigned" message

### 4c. In-game chat

A simple text chat overlay inside the game view.

**Implementation:**
- New socket event: `chat:message` → `{ sessionId, roomCode, text }` (max 200 chars, rate-limited server-side to 1/second)
- Server validates and broadcasts `chat:message` to the room with `{ playerId, text, timestamp }`
- Frontend: collapsible chat panel pinned to bottom-right of the 3D canvas
  - Unread badge when collapsed
  - Messages styled by player color (P1 blue / P2 orange)
  - Auto-scroll to latest
  - Input clears after send
- Store: `chatMessages: Array<{ playerId, text, timestamp }>` in Zustand

### 4d. Game timer

Show elapsed time per move and total game time.

**Options:**
- **Move timer** (turn clock): each player has N seconds per move. On timeout → automatic forfeit. This changes game rules — probably a lobby option.
- **Elapsed clock** (display only): shows total game time, no forfeit. Simple stopwatch in the UI.

**Recommended for Phase 4:** elapsed clock only (no rule change). Add move clock as a lobby option later.

**Implementation:**
- Server stamps `gameStartedAt: number` (epoch ms) on `startGame()`
- Frontend derives elapsed time from `Date.now() - gameState.gameStartedAt`
- Small clock displayed in the TurnBadge area

### 4e. Opponent profile overlay

Clicking/tapping the opponent's name panel shows a small overlay with their stats (wins, losses, games played). Works without full auth — use display name + session history. Once accounts exist, links to full profile.

**Phase 4 version (no auth):** show session-only stats (current session wins/losses) from the game state.  
**Phase 6 version (with auth):** pull real career stats from the database.

---

## Phase 5 — Persistence Layer (Redis + Postgres)

Before adding user accounts, the infrastructure needs to be durable.

### 5a. Redis — Room and session persistence

Currently rooms live in-memory on the backend Node.js process. A Railway restart wipes all active games.

**Implementation:**
- Add Railway Redis addon
- Replace `Map` in `roomStore.ts` with Redis hash operations
- Use Socket.IO Redis adapter (`@socket.io/redis-adapter`) for cross-process pub/sub
- Set TTL of 2 hours on rooms (auto-expire abandoned games)
- No change to Socket.IO event interface — clients notice nothing

**Unlocks:** backend can restart/redeploy without dropping active games. Enables horizontal scaling.

### 5b. Postgres — Users and match history

Required for user accounts, stats, and leaderboards.

**Schema (initial):**
```sql
users (
  id          UUID PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,        -- chosen at signup, shown in-game
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT,                      -- nullable if OAuth only
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
)

matches (
  id          UUID PRIMARY KEY,
  room_code   TEXT NOT NULL,
  p1_user_id  UUID REFERENCES users(id),
  p2_user_id  UUID REFERENCES users(id),
  winner_id   UUID REFERENCES users(id),  -- NULL = draw
  end_reason  TEXT,                        -- 'win' | 'draw' | 'forfeit' | 'resign'
  move_count  INT,
  duration_ms INT,
  played_at   TIMESTAMPTZ DEFAULT NOW()
)

ratings (
  user_id     UUID PRIMARY KEY REFERENCES users(id),
  elo         INT DEFAULT 1200,
  wins        INT DEFAULT 0,
  losses      INT DEFAULT 0,
  draws       INT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
)
```

**Technology choice:** Postgres on Railway (Railway Postgres addon). Use `pg` or `drizzle-orm` in the backend.

---

## Phase 6 — User Accounts and Auth

### 6a. Account creation and login

**Flows:**
- Email/password signup with email verification
- OAuth: Google (primary), GitHub (optional)
- Guest → account upgrade (link existing session to new account without losing session)

**Implementation:**
- JWT-based auth (short-lived access token + refresh token stored in httpOnly cookie)
- `POST /auth/signup` — create user, send verification email
- `POST /auth/login` — returns access + refresh tokens
- `GET /auth/me` — return current user from token
- `POST /auth/logout` — invalidate refresh token
- `GET /auth/google` — OAuth redirect
- Password reset flow (email link)

**Frontend:**
- Replace landing page "display name" input with proper login/signup card
- Persist login across sessions (refresh token in httpOnly cookie)
- Guest mode still available (no account required) — display name treated as ephemeral

### 6b. User profiles

Each user has a public profile page at `/u/:username`.

**Displays:**
- Avatar (auto-generated from username initials, or uploaded image)
- Username and join date
- Career stats: wins / losses / draws / win rate / games played
- Elo rating and rank tier (Bronze → Silver → Gold → Diamond → Grand Master)
- Recent match history (last 20 games with outcome, opponent, move count, date)
- Favorite opening (most common first move)

### 6c. In-game opponent profile overlay

Clicking the opponent's name panel during a game shows a floating overlay with:
- Their avatar and username
- Current rating + rank badge
- Win rate and recent form (W/L/W/L dots for last 5 games)
- "View full profile" link

---

## Phase 7 — Matchmaking

Current flow requires sharing a code. Matchmaking lets strangers play.

### 7a. Casual queue

- "Play Now" button on landing/lobby — joins a FIFO casual queue
- Server matches first two players in queue
- Matched players enter a lobby automatically (no code needed)
- ELO is not affected by casual games

### 7b. Ranked queue

- "Ranked" button — joins the ranked queue
- Server matches by ELO proximity (±200 range, expanding every 30s)
- Win/loss updates ELO via standard Elo formula (K=32)
- Rank tiers update at thresholds: Bronze (<1000), Silver (1000–1199), Gold (1200–1399), Diamond (1400–1599), Grand Master (1600+)
- Seasonal resets (optional, Phase 9+)

### 7c. Lobby options

Before starting from a private invite room, the host can set:
- Move time limit (off / 30s / 60s / 90s)
- Rated or unrated
- Rematch on game end (on/off)

---

## Phase 8 — AI Opponent

Allow solo practice against a computer opponent.

### 8a. Rule-based AI (easy/medium)

The AI picks moves using the already-pure shared game logic — no server changes needed.

**Easy:** random valid move  
**Medium:** heuristic — prioritize winning moves → block opponent wins → play largest available piece in center/corners

**Implementation:**
- `shared/src/ai/` — `randomAI.ts`, `heuristicAI.ts`
- Both export `getBestMove(state: GameState, playerId: PlayerId): MoveEvent`
- Frontend: "Play vs AI" route, runs AI in a `useEffect` loop with 400ms artificial delay for feel
- No server needed — entire game runs in-browser

### 8b. Minimax AI (hard)

Full minimax with alpha-beta pruning over the piece-stacking search tree.

- Search depth: 4–6 ply (manageable given the small board and finite piece inventory)
- Evaluation: material count (remaining pieces) + positional scoring (center/corners)
- Run in a Web Worker to avoid blocking the UI thread

### 8c. ML / MCTS AI (future, Phase 9+)

Monte Carlo Tree Search or a small neural net trained on self-play. Requires:
- Match history dataset (from Postgres)
- Training pipeline (Python, PyTorch or JAX)
- Model served as ONNX in the browser via `onnxruntime-web`, or as an API endpoint

---

## Phase 9 — Social Layer

### 9a. Friends system

- Send/accept/decline friend requests (by username or QR code)
- Friends list with online/in-game/offline status indicators
- "Challenge friend" button — creates a private room and sends a notification

**Backend:**
```sql
friendships (
  user_id       UUID REFERENCES users(id),
  friend_id     UUID REFERENCES users(id),
  status        TEXT CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
)
```

- Real-time presence via Socket.IO (user joins a personal presence channel on login)
- Notifications via Socket.IO push or Web Push API

### 9b. In-game and lobby chat

Extends Phase 4c with persistent message history and emoji reactions.

- Message history stored in Postgres (capped at last 50 per room)
- Emoji reactions on messages
- `/gg`, `/nice` quick-reply shortcuts

### 9c. Notifications

In-app notification center (bell icon):
- Friend request received
- Friend came online
- Challenge received
- Your turn (if background tab)
- Game result when you return after a disconnect

Web Push notifications (optional): rematch requested, friend online.

---

## Phase 10 — Leaderboard

- **Global leaderboard:** top 100 players by Elo, refreshed every 5 minutes
- **Friends leaderboard:** ranking among your friends only
- **Weekly leaderboard:** resets every Monday — most wins in 7 days
- Pagination and search by username
- Rank badges and trophy icons for top 3

---

## Phase 11 — Observability and Quality

- E2E tests with Playwright: full game flow (create → join → play → rematch → leave)
- Backend integration tests: move validation, forfeit timer, disconnect/reconnect
- Sentry error tracking on frontend and backend
- Railway metrics dashboard (latency, socket connections, memory)
- Uptime monitoring (Better Uptime or Railway built-in)
- Performance budget: landing page LCP < 2s, 3D scene FPS ≥ 30 on mid-range mobile

---

## Feature Wishlist (No Phase Assigned)

These are ideas to revisit once the core is stable:

| Feature | Notes |
|---|---|
| **Spectator mode** | Watch a live game (read-only socket listener, no moves) |
| **Replay viewer** | Step through a completed game move by move |
| **Tournaments** | Bracket-style, 8 or 16 players, auto-match |
| **Seasonal skins** | Board and piece cosmetics (holiday themes, etc.) |
| **Voice chat** | WebRTC peer-to-peer voice in a room |
| **Mobile app** | React Native + Expo reusing the shared game logic |
| **Custom rules** | 4×4 board variant, different inventory counts |
| **PWA / offline** | Install to home screen, play against AI offline |
| **Accessibility** | Screen reader support, color-blind mode, keyboard-only play |

---

## Implementation Priority Order

If starting from Phase 4 today, the recommended order is:

1. **Rematch UX (3 states)** — small change, big UX improvement, affects every game
2. **Resign button** — basic gameplay completeness
3. **Game timer (elapsed clock)** — low effort, adds feel
4. **In-game chat** — keeps players engaged between moves
5. **Redis persistence** — unblocks auth by making the backend durable
6. **Postgres schema** — required for everything after
7. **Auth (email/password + Google OAuth)** — gates profiles, stats, social
8. **User profiles + opponent overlay** — first visible auth payoff
9. **Casual matchmaking** — opens the game to strangers, not just invited friends
10. **AI opponent (easy/medium)** — solo practice, great for new players learning the game
11. **Ranked queue + Elo** — adds competitive layer
12. **Friends + notifications** — social retention
13. **Leaderboard** — competitive prestige
14. **Hard AI (minimax)** — skill ceiling for solo play
