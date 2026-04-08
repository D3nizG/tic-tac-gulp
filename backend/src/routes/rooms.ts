import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createInitialState,
  generateRoomCode,
} from '@tic-tac-gulp/shared';
import { roomStore } from '../store/roomStore.js';

export const roomsRouter = Router();

/**
 * POST /api/rooms
 * Creates a new room. Returns roomCode, playerId (P1), and sessionId.
 */
roomsRouter.post('/', (req, res) => {
  const { displayName } = req.body as { displayName?: string };

  if (!displayName || displayName.trim().length < 3 || displayName.trim().length > 16) {
    res.status(400).json({ error: 'displayName must be 3–16 characters.' });
    return;
  }

  const roomCode = generateRoomCode();
  const sessionId = uuidv4();

  const state = createInitialState(roomCode, displayName.trim(), sessionId);
  roomStore.set(roomCode, state);
  roomStore.bindSession(sessionId, roomCode);

  res.status(201).json({ roomCode, playerId: 'P1', sessionId });
});

/**
 * POST /api/rooms/:code/join
 * Joins an existing room as P2.
 */
roomsRouter.post('/:code/join', (req, res) => {
  const { code } = req.params;
  const { displayName } = req.body as { displayName?: string };

  if (!displayName || displayName.trim().length < 3 || displayName.trim().length > 16) {
    res.status(400).json({ error: 'displayName must be 3–16 characters.' });
    return;
  }

  const state = roomStore.get(code.toUpperCase());

  if (!state) {
    res.status(404).json({ error: 'Room not found.', code: 'ROOM_NOT_FOUND' });
    return;
  }
  if (state.status !== 'WAITING') {
    if (state.players.P2.sessionId) {
      res.status(409).json({ error: 'Room is full.', code: 'ROOM_FULL' });
    } else {
      res.status(410).json({ error: 'Game already in progress.', code: 'GAME_IN_PROGRESS' });
    }
    return;
  }

  const sessionId = uuidv4();
  roomStore.bindSession(sessionId, code.toUpperCase());

  // P2 info will be set when they join via WebSocket (room:join event)
  res.status(200).json({ roomCode: code.toUpperCase(), playerId: 'P2', sessionId });
});

/**
 * GET /api/rooms/:code
 * Returns lightweight room status (used on page load for reconnect).
 */
roomsRouter.get('/:code', (req, res) => {
  const state = roomStore.get(req.params.code.toUpperCase());
  if (!state) {
    res.status(404).json({ error: 'Room not found.', code: 'ROOM_NOT_FOUND' });
    return;
  }
  res.json({
    roomCode: state.roomCode,
    status: state.status,
    players: {
      P1: { name: state.players.P1.displayName, connected: state.players.P1.connected },
      P2: { name: state.players.P2.displayName, connected: state.players.P2.connected },
    },
  });
});
