import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { roomsRouter } from './routes/rooms.js';
import { registerSocketHandlers } from './socket/handlers.js';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

export function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: FRONTEND_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  app.use(cors({ origin: FRONTEND_ORIGIN }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // REST routes
  app.use('/api/rooms', roomsRouter);

  // WebSocket handlers
  registerSocketHandlers(io);

  return { app, httpServer, io };
}
