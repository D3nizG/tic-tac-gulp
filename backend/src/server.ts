import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { roomsRouter } from './routes/rooms.js';
import { usersRouter } from './routes/users.js';
import { friendsRouter } from './routes/friends.js';
import { invitesRouter } from './routes/invites.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { getRedis, getRedisSubscriber } from './lib/redis.js';
import { roomStore } from './store/roomStore.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

// Supports a comma-separated list of origins, e.g.:
// FRONTEND_ORIGIN=https://tic-tac-gulp.d3nizg.dev,http://localhost:3000
const rawOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
const ALLOWED_ORIGINS = expandLocalOrigins(rawOrigin.split(',').map((o) => o.trim()));

function expandLocalOrigins(origins: string[]): string[] {
  const expanded = new Set<string>();
  for (const origin of origins) {
    if (!origin) continue;
    expanded.add(origin);
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost') {
        url.hostname = '127.0.0.1';
        expanded.add(url.toString().replace(/\/$/, ''));
      } else if (url.hostname === '127.0.0.1') {
        url.hostname = 'localhost';
        expanded.add(url.toString().replace(/\/$/, ''));
      }
    } catch {
      // Ignore malformed origins; cors/socket.io will reject them normally.
    }
  }
  return [...expanded];
}

export function createServer(
  options: { forfeitTimeoutMs?: number; startingPlayer?: PlayerId; publicMatchStartDelayMs?: number } = {}
) {
  const app = express();
  const httpServer = createHttpServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
    },
  });

  // Attach Redis adapter for multi-process pub/sub (if REDIS_URL is set)
  const pubClient = getRedis();
  const subClient = getRedisSubscriber();
  if (pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.IO] Redis adapter attached');
  }

  app.use(cors({ origin: ALLOWED_ORIGINS }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // REST routes
  app.use('/api/rooms', roomsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/invites', invitesRouter);

  // WebSocket handlers
  registerSocketHandlers(io, {
    forfeitTimeoutMs: options.forfeitTimeoutMs,
    startingPlayer: options.startingPlayer,
    publicMatchStartDelayMs: options.publicMatchStartDelayMs,
  });

  // Restore persisted rooms from Redis (runs async after server setup)
  roomStore.initFromRedis().catch((err) => {
    console.error('[server] initFromRedis failed:', err);
  });

  return { app, httpServer, io };
}
