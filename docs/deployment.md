# Deployment — Tic-Tac-Gulp

## Overview

| Layer    | Host        | URL                                          |
|----------|-------------|----------------------------------------------|
| Backend  | Railway.app | `https://api.tic-tac-gulp.d3nizg.dev`        |
| Frontend | TBD         | `https://tic-tac-gulp.d3nizg.dev` (Phase 3)  |

---

## Backend → Railway

### 1. Connect the repo (already done)

`D3nizG/tic-tac-gulp` is connected to Railway.

### 2. Set environment variables in Railway dashboard

Go to your Railway service → **Variables** tab and add:

| Variable          | Value                                                                    | Notes                             |
|-------------------|--------------------------------------------------------------------------|-----------------------------------|
| `FRONTEND_ORIGIN` | `https://tic-tac-gulp.d3nizg.dev,http://localhost:3000`                  | Update when frontend URL is set   |
| `NODE_ENV`        | `production`                                                             |                                   |
| `PORT`            | `3001`                                                                   | Must match custom domain targetPort in Railway networking settings |

### 3. How Railway builds and starts

Railway reads `railway.json` and `nixpacks.toml` at the repo root:

- **Install:** `npm install` (handles all workspace packages)
- **Start:** `npm run start -w backend` → `tsx src/index.ts`
- **Health check:** `GET /health` → `{ "status": "ok" }`

No separate compile step — `tsx` runs TypeScript directly.

### 4. Custom domain DNS setup

In your DNS provider for `d3nizg.dev`, add a **CNAME** record:

| Type  | Name                 | Value                          | TTL  |
|-------|----------------------|--------------------------------|------|
| CNAME | `api.tic-tac-gulp`   | `[your-app].up.railway.app`    | 3600 |

> Find your Railway hostname: **Railway → service → Settings → Networking**.  
> Looks like `tic-tac-gulp-production.up.railway.app`.

Then in Railway → **Settings → Networking → Custom Domain**, enter:
```
api.tic-tac-gulp.d3nizg.dev
```

Railway provisions SSL automatically via Let's Encrypt.

---

## Verifying the Deployment

```bash
# Health check
curl https://api.tic-tac-gulp.d3nizg.dev/health
# → { "status": "ok" }

# Create a room
curl -X POST https://api.tic-tac-gulp.d3nizg.dev/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"displayName": "TestUser"}'
# → { "roomCode": "ABCDE2", "playerId": "P1", "sessionId": "..." }
```

---

## Environment Variables Reference

| Variable          | Default                  | Description                                        |
|-------------------|--------------------------|----------------------------------------------------|
| `PORT`            | `3001`                   | Must match Railway custom domain targetPort (set to `3001` in Railway Variables) |
| `FRONTEND_ORIGIN` | `http://localhost:3000`  | Comma-separated allowed CORS origins               |
| `NODE_ENV`        | *(unset)*                | Set to `production` on Railway                     |
| `REDIS_URL`       | *(unset)*                | Add Railway Redis addon in Phase 4 for persistence |

---

## Future: Redis (Phase 4)

1. Railway → **New** → **Database** → **Redis** → attach to your service
2. Railway auto-injects `REDIS_URL` — the `roomStore` interface stays the same
3. Update `backend/src/store/roomStore.ts` to use the Redis adapter

---

## Frontend (Phase 3 — TBD)

Static React build. Set `VITE_SOCKET_URL=https://api.tic-tac-gulp.d3nizg.dev` in the frontend deploy env.

DNS for frontend:

| Type  | Name          | Value              | TTL  |
|-------|---------------|--------------------|------|
| CNAME | `tic-tac-gulp`| (Vercel/host CNAME)| 3600 |
