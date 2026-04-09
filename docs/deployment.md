# Deployment — Tic-Tac-Gulp

## Overview

| Layer    | Host        | URL                                          | Status |
|----------|-------------|----------------------------------------------|--------|
| Backend  | Railway.app | `https://api.tic-tac-gulp.d3nizg.dev`        | Live   |
| Frontend | Vercel      | `https://tic-tac-gulp.d3nizg.dev`            | Live   |

---

## Backend → Railway

### How Railway builds and starts

Railway reads `railway.json` and `nixpacks.toml` at the repo root:

- **Install:** `npm install` (handles all workspace packages)
- **Start:** `npm run start -w backend` → `tsx src/index.ts`
- **Health check:** `GET /health` → `{ "status": "ok" }`

No separate compile step — `tsx` runs TypeScript directly.

### Environment variables (Railway dashboard → Variables)

| Variable          | Value                                                        | Notes                        |
|-------------------|--------------------------------------------------------------|------------------------------|
| `FRONTEND_ORIGIN` | `https://tic-tac-gulp.d3nizg.dev,http://localhost:3000`      | Comma-separated CORS origins |
| `NODE_ENV`        | `production`                                                 |                              |
| `PORT`            | `3001`                                                       | Must match Railway networking targetPort |

### DNS (Porkbun → d3nizg.dev)

| Type  | Name               | Value                          | TTL  |
|-------|--------------------|--------------------------------|------|
| CNAME | `api.tic-tac-gulp` | `[your-app].up.railway.app`    | 3600 |

Railway provisions SSL automatically via Let's Encrypt.

### Verify backend

```bash
curl https://api.tic-tac-gulp.d3nizg.dev/health
# → { "status": "ok" }

curl -X POST https://api.tic-tac-gulp.d3nizg.dev/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"displayName": "TestUser"}'
# → { "roomCode": "ABCDE2", "playerId": "P1", "sessionId": "..." }
```

---

## Frontend → Vercel

### Vercel project settings

| Setting              | Value                                         |
|----------------------|-----------------------------------------------|
| GitHub repo          | `D3nizG/tic-tac-gulp`                         |
| Root Directory       | `frontend`                                    |
| Framework preset     | Vite (auto-detected)                          |
| Build command        | `npm run build` (auto from package.json)      |
| Output directory     | `dist`                                        |

### Environment variables (Vercel dashboard → Settings → Environment Variables)

| Variable          | Value                                    | Notes                             |
|-------------------|------------------------------------------|-----------------------------------|
| `VITE_SOCKET_URL` | `https://api.tic-tac-gulp.d3nizg.dev`    | Baked in at build time by Vite    |

> **Important:** After adding/changing `VITE_SOCKET_URL`, you must trigger a new deployment for the value to take effect. Vite bakes env vars into the bundle at build time.

### SPA routing

`frontend/vercel.json` configures SPA routing so all paths serve `index.html`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Custom domain DNS (Porkbun → d3nizg.dev)

| Type  | Name           | Value                   | TTL |
|-------|----------------|-------------------------|-----|
| CNAME | `tic-tac-gulp` | `cname.vercel-dns.com`  | 600 |

Add the domain in Vercel → Project → Settings → Domains, then add the CNAME in Porkbun. SSL auto-provisions within 1–2 minutes.

---

## Environment Variables Reference

### Backend

| Variable          | Default                  | Description                                        |
|-------------------|--------------------------|----------------------------------------------------|
| `PORT`            | `3001`                   | Set automatically by Railway                       |
| `FRONTEND_ORIGIN` | `http://localhost:3000`  | Comma-separated allowed CORS origins               |
| `NODE_ENV`        | *(unset)*                | Set to `production` on Railway                     |
| `REDIS_URL`       | *(unset)*                | Add Railway Redis addon in Phase 4 for persistence |

### Frontend

| Variable          | Default | Description                                                       |
|-------------------|---------|-------------------------------------------------------------------|
| `VITE_SOCKET_URL` | `''`    | Backend URL. Empty string = connect to same origin (dev proxy). Set to full backend URL in Vercel. |

---

## Local Development vs Production

| Concern         | Local (dev)                            | Production (Vercel)                     |
|-----------------|----------------------------------------|-----------------------------------------|
| API calls       | Vite proxy `/api` → `localhost:3001`   | `VITE_SOCKET_URL + /api/...`            |
| Socket.IO       | Vite proxy `/socket.io` → `localhost:3001` | `VITE_SOCKET_URL` (direct)         |
| CSS loading     | Injected by Vite's JS (HMR)            | Separate `<link>` tag in built HTML     |
| `VITE_SOCKET_URL` | Not set (empty = proxy works)        | Must be set to backend URL              |

---

## Future: Redis (Phase 4)

1. Railway → **New** → **Database** → **Redis** → attach to your service
2. Railway auto-injects `REDIS_URL` — the `roomStore` interface stays the same
3. Update `backend/src/store/roomStore.ts` to use the Redis adapter
4. Rooms will survive backend restarts and support horizontal scaling
