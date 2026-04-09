# Roadmap — Tic-Tac-Gulp

This document covers the path from the current invite-only MVP to a fully-fledged online web app game. Each phase builds on the last. Phases within a tier can be reordered based on priority.

---

## Current State (Phase 4 complete)

The game is fully playable with a shareable invite code. Two players can:
- Create/join a room, play a full game on a 3D board
- Reconnect within 60 seconds if disconnected (forfeit on timeout)
- Resign mid-game (with confirm step)
- Chat in-game with rate limiting and color-coded bubbles
- See a 3-state rematch indicator (idle / waiting / opponent wants rematch / unavailable)
- View the opponent's session stats and inventory via an info overlay
- See a game elapsed clock
- Play a second game without restarting the server (socket singleton fix)
- Play on mobile (responsive to 375px)

**Phase 4 is complete.** All items shipped.

---

## Phase 4 — In-Game Polish (No Auth Required)

### ✅ 4a. Rematch button — 4 states

| State | Trigger | UI |
|---|---|---|
| **Idle** | Game just ended | "Rematch" button, blue |
| **Waiting** | You clicked Rematch, opponent hasn't | Spinner "Waiting…" |
| **Opponent wants rematch** | Opponent clicked first | Pulsing "Accept" with badge |
| **Unavailable** | Opponent left or declined | Grayed out "Opponent left" |

- `rematch:requested` / `rematch:declined` / `rematch:unavailable` socket events
- Leave button always emits `rematch:decline` to notify the other player
- `rematchState` in Zustand drives the button

### ✅ 4b. Resign button

- `game:resign` socket event → server sets `endReason: 'resign'`
- Inline confirm (flag icon → "Sure? Yes / No", auto-cancels after 4s)
- GameOverlay shows "You resigned" / "Opponent resigned"

### ✅ 4c. In-game chat

- Collapsible panel with unread badge (shows count when closed)
- Rate-limited server-side to 1 message/second per session
- P1 blue / P2 orange color-coded bubbles
- 200-character cap, Enter to send

### ✅ 4d. Game timer (elapsed clock)

- `gameStartedAt` stamped on `startGame()` and `resetGameState()`
- Live MM:SS counter; freezes on game end showing final duration

### ✅ 4e. Opponent profile overlay

- `ℹ` button on opponent's PlayerPanel
- Shows session W/L/D stats (derived from current session, not persistent)
- Shows opponent's current piece inventory
- "Sign in for career stats" prompt for future auth

### ✅ 4f. Socket singleton fix

- `socket.once('connect', ...)` only fires on an unconnected socket
- Fixed by checking `socket.connected` first and emitting `room:join` immediately if already live
- Prevents "hanging on Connecting…" when starting a second game after leaving

### ✅ 4g. Per-turn countdown timer + auto-move

Each turn has a 13-second clock. If it expires, the server automatically plays a move.

**Auto-move priority:**
1. Try smallest piece (S → M → L) that the player still has in inventory
2. Among valid placements for that size, pick a random cell
3. Edge cases: no small pieces → try medium; no valid spots for a size (all blocked) → try next size up; if truly no valid move the game should already be ended by draw detection

**Implementation:**
- Add `turnStartedAt: number | null` to `GameState`
- Set in `startGame()`, `resetGameState()`, and after each valid move on the server
- Backend: `turnTimers: Map<roomCode, timeout>` — 13s timer per room
- Timer fires → compute auto-move → `applyMove` + `resolveAfterMove` → emit `game:state`
- Timer clears on: valid move received, resign, game:ended, rematch start, disconnect
- Frontend: `GameTimer` repurposed as per-turn countdown (count down from 13 to 0)
- Pulse red when ≤ 5 seconds

### ✅ 4h. Player-perspective camera angles

P1 and P2 see the board from opposite sides, reflecting the physical feeling of sitting across from each other.

**Implementation:**
- P1 camera: `(0, 7, +5)` — looking from positive Z (front)
- P2 camera: `(0, 7, -5)` — looking from negative Z (back)
- `CameraRig` accepts `playerSide: 'P1' | 'P2'` prop
- `GameScene` reads `yourPlayerId` from store and passes to `CameraRig`
- Players can still orbit freely within existing angle constraints

### ✅ 4i. Local multiplayer (pass and play)

Two players on the same device. No server or socket needed — pure shared game logic.

**Flow:**
1. Landing page "Play Locally" button → name entry for P1 and P2
2. Route `/local` renders `LocalGamePage`
3. After each move, a **PassScreen** covers the board: "Pass to [name] — tap to continue"
   - Hides the board state from the previous player while device is handed over
4. Camera rotates to the new player's side when PassScreen is dismissed
5. 13-second turn timer applies (auto-move fires same as online mode)
6. Game over: rematch restarts on the same device (no pass screen on first move)

**Implementation:**
- `localStore.ts`: Zustand store managing `GameState` via shared logic (no socket)
- `LocalGamePage.tsx`: full game page reusing `PlayerPanel`, `TurnBadge`, `GameTimer`, `GameOverlay`
- `PassScreen.tsx`: full-screen overlay, player color accented, tap to dismiss
- `LocalGameScene.tsx`: GameScene variant using `localStore` for state and local move handler
- `App.tsx`: add `/local` route (lazy-loaded)
- `LandingPage`: "Local 2-Player" button option

---

## Phase 5 — Persistence Layer (Railway Redis + Supabase Postgres)

Before adding user accounts, the infrastructure needs to be durable.

**Architecture decision:** Supabase is used for Postgres + Auth instead of Railway Postgres + custom JWT.
Redis is still required for Socket.IO ephemeral game state — Supabase does not replace it.

### 5a. Redis — Room and session persistence

Currently rooms live in-memory on the backend Node.js process. A Railway restart wipes all active games.

**Implementation:**
- Add Railway Redis addon (Railway dashboard → New → Database → Redis)
- Install `ioredis` + `@socket.io/redis-adapter` on backend
- Replace `Map` in `roomStore.ts` with ioredis hash operations
- Use Socket.IO Redis adapter for cross-process pub/sub
- Set TTL of 2 hours on rooms (auto-expire abandoned games)
- No change to Socket.IO event interface — clients notice nothing

**Env vars added:** `REDIS_URL` (Railway auto-injects)

**Unlocks:** backend can restart/redeploy without dropping active games. Enables horizontal scaling.

### 5b. Supabase Postgres — Users and match history

Required for user accounts, stats, and leaderboards. Hosted on Supabase instead of Railway.

**Why Supabase over Railway Postgres:**
- Auth is built-in (Google OAuth, email/password, magic links) — saves ~3 weeks of custom auth work
- User management dashboard included
- Free tier covers this project for a long time (500MB DB, 50k MAU)
- JWT issued by Supabase, verified on backend with `SUPABASE_JWT_SECRET`

**Setup:**
- Create project at supabase.com
- Run SQL migrations for `users`, `matches`, `ratings` tables
- Backend uses `@supabase/supabase-js` admin client

**Env vars added:**
- `SUPABASE_URL` — project URL (on Railway backend)
- `SUPABASE_SERVICE_ROLE_KEY` — admin key (on Railway backend)
- `VITE_SUPABASE_URL` — project URL (on Vercel frontend)
- `VITE_SUPABASE_ANON_KEY` — public anon key (on Vercel frontend)

**Schema:**
```sql
users (
  id          UUID PRIMARY KEY,  -- Supabase auth.users.id
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
)

matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT NOT NULL,
  p1_user_id  UUID REFERENCES users(id),
  p2_user_id  UUID REFERENCES users(id),
  winner_id   UUID REFERENCES users(id),
  end_reason  TEXT,
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

---

## Phase 6 — User Accounts and Auth (via Supabase)

Supabase Auth handles Google OAuth, email/password, and JWT issuance — replacing what would otherwise
be ~3 weeks of custom implementation.

### 6a. Account creation and login

**Flows:**
- Google OAuth (primary): `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Email/password: `supabase.auth.signInWithPassword({...})` — verification built in
- Guest → account upgrade: link existing `sessionId` to new Supabase `userId` after sign-in

**What Supabase handles automatically:**
- Token issuance and refresh
- Email verification
- Password reset (email link)
- Google OAuth PKCE flow
- User management dashboard

**Backend auth middleware:**
- Verify `Authorization: Bearer <supabase-jwt>` using `SUPABASE_JWT_SECRET`
- Protected routes attach `req.userId` (Supabase `user.id`)

**Required setup:**
- Supabase dashboard → Authentication → Providers → enable Google
- Google Cloud Console → create OAuth 2.0 credentials → add redirect URI from Supabase

**Frontend:**
- `@supabase/supabase-js` client with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Zustand `authStore.ts` — tracks `user`, `session`, loading state
- Landing page: optional sign-in card (guest mode still works without an account)

### 6b. User profiles

Each user has a public profile at `/u/:username`:
- Avatar (initials fallback), username, join date
- Career stats: wins / losses / draws / win rate
- Elo rating + rank tier (Bronze → Silver → Gold → Diamond → Grand Master)
- Recent match history (last 20 games)
- Favorite opening (most common first move)

### 6c. In-game opponent profile overlay (Phase 6 upgrade)

Replaces the session-only overlay with real career stats:
- Avatar, rating + rank badge
- Win rate and recent form (W/L/W/L dots for last 5)
- "View full profile" link

---

## Phase 7 — Matchmaking

### 7a. Casual queue
- "Play Now" — FIFO queue, matched players enter lobby automatically, no invite code

### 7b. Ranked queue
- Match by ELO proximity (±200 range, expanding every 30s)
- Win/loss updates ELO via standard formula (K=32)
- Rank tiers: Bronze (<1000), Silver (1000–1199), Gold (1200–1399), Diamond (1400–1599), Grand Master (1600+)

### 7c. Lobby options
- Move time limit (off / 30s / 60s / 90s)
- Rated or unrated
- Rematch on game end

---

## Phase 8 — AI Opponent

### 8a. Rule-based AI (easy/medium)
- `shared/src/ai/` — `randomAI.ts`, `heuristicAI.ts`
- Both export `getBestMove(state, playerId): MoveEvent`
- Frontend: "Play vs AI" route, AI runs in `useEffect` with 400ms artificial delay
- No server needed — entire game runs in-browser

### 8b. Minimax AI (hard)
- Alpha-beta pruning, depth 4–6 ply
- Run in a Web Worker to avoid blocking the UI
- Evaluation: material + positional scoring (center/corners)

### 8c. ML / MCTS AI (future)
- Monte Carlo Tree Search or small neural net trained on self-play
- ONNX in the browser via `onnxruntime-web` or as an API endpoint

---

## Phase 9 — Social Layer

### 9a. Friends system
- Send/accept/decline friend requests (by username or QR code)
- Friends list with online/in-game/offline status
- "Challenge friend" button — creates private room + sends notification

```sql
friendships (
  user_id   UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  status    TEXT CHECK (status IN ('pending', 'accepted', 'blocked')),
  PRIMARY KEY (user_id, friend_id)
)
```

### 9b. Persistent chat + reactions
- Message history in Postgres (capped at last 50 per room)
- Emoji reactions, `/gg` and `/nice` quick-reply shortcuts

### 9c. Notifications
- In-app bell: friend requests, challenge received, your turn (background tab)
- Web Push: rematch requested, friend online

---

## Phase 10 — Leaderboard

- Global top 100 by Elo, refreshed every 5 minutes
- Friends leaderboard
- Weekly leaderboard (resets Monday)
- Pagination + search by username, rank badges for top 3

---

## Phase 11 — Observability and Quality

- E2E tests with Playwright (full game flow)
- Backend integration tests (move validation, forfeit timer, reconnect)
- Sentry error tracking (frontend + backend)
- Railway metrics dashboard
- Uptime monitoring
- Performance budget: LCP < 2s, 3D scene ≥ 30 FPS on mid-range mobile

---

## Feature Wishlist (No Phase Assigned)

| Feature | Notes |
|---|---|
| **Spectator mode** | Watch a live game (read-only socket listener) |
| **Replay viewer** | Step through completed game move by move |
| **Tournaments** | Bracket-style, 8 or 16 players, auto-match |
| **Seasonal skins** | Board/piece cosmetics (holiday themes) |
| **Voice chat** | WebRTC peer-to-peer in a room |
| **Mobile app** | React Native + Expo, reuses shared game logic |
| **Custom rules** | 4×4 board variant, different inventory counts |
| **PWA / offline** | Install to home screen, AI offline |
| **Accessibility** | Screen reader, color-blind mode, keyboard-only |

---

## Implementation Priority Order

1. **Turn countdown + auto-move** — every game needs it, affects feel immediately
2. **Camera perspectives** — quick win, makes the game feel spatial
3. **Local pass-and-play** — opens game to people without two devices
4. **Redis persistence** — unblocks auth, makes backend durable
5. **Postgres schema** — required for everything after
6. **Auth (email/password + Google OAuth)** — gates profiles, stats, social
7. **User profiles + opponent overlay upgrade** — first visible auth payoff
8. **Casual matchmaking** — opens to strangers
9. **AI opponent (easy/medium)** — solo practice
10. **Ranked queue + Elo** — competitive layer
11. **Friends + notifications** — social retention
12. **Leaderboard** — competitive prestige
13. **Hard AI (minimax)** — skill ceiling for solo play
