import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { roomsRouter } from './routes/rooms.js';
import { usersRouter } from './routes/users.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { getRedis, getRedisSubscriber } from './lib/redis.js';
import { roomStore } from './store/roomStore.js';

// Supports a comma-separated list of origins, e.g.:
// FRONTEND_ORIGIN=https://tic-tac-gulp.d3nizg.dev,http://localhost:3000
const rawOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
const ALLOWED_ORIGINS = rawOrigin.split(',').map((o) => o.trim());

export function createServer(options: { forfeitTimeoutMs?: number } = {}) {
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

  // WebSocket handlers
  registerSocketHandlers(io, { forfeitTimeoutMs: options.forfeitTimeoutMs });

  // Restore persisted rooms from Redis (runs async after server setup)
  roomStore.initFromRedis().catch((err) => {
    console.error('[server] initFromRedis failed:', err);
  });

  return { app, httpServer, io };
}
