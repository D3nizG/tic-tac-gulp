import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createInitialState,
  generateRoomCode,
} from '@tic-tac-gulp/shared';
import { roomStore } from '../store/roomStore.js';
import { optionalAuth } from '../middleware/auth.js';

export const roomsRouter = Router();

const MIN_DISPLAY_NAME_LENGTH = 3;
const MAX_DISPLAY_NAME_LENGTH = 20;

function cleanDisplayName(displayName: unknown): string | null {
  if (typeof displayName !== 'string') return null;
  const trimmed = displayName.trim();
  if (trimmed.length < MIN_DISPLAY_NAME_LENGTH || trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return null;
  }
  return trimmed;
}

function makeUniqueRoomCode(): string {
  let roomCode = generateRoomCode();
  while (roomStore.has(roomCode)) roomCode = generateRoomCode();
  return roomCode;
}

/**
 * POST /api/rooms
 * Creates a new room. Returns roomCode, playerId (P1), and sessionId.
 */
roomsRouter.post('/', optionalAuth, (req, res) => {
  const displayName = cleanDisplayName((req.body as { displayName?: string }).displayName);

  if (!displayName) {
    res.status(400).json({ error: 'displayName must be 3–20 characters.' });
    return;
  }

  const roomCode = makeUniqueRoomCode();
  const sessionId = uuidv4();
  const userId = req.userId ?? null;

  const state = createInitialState(roomCode, displayName, sessionId, userId);
  roomStore.set(roomCode, state);
  roomStore.bindSession(sessionId, roomCode);

  res.status(201).json({ roomCode, playerId: 'P1', sessionId });
});

/**
 * POST /api/rooms/search
 * Finds an open public room, or creates one if none are waiting.
 */
roomsRouter.post('/search', optionalAuth, (req, res) => {
  const displayName = cleanDisplayName((req.body as { displayName?: string }).displayName);

  if (!displayName) {
    res.status(400).json({ error: 'displayName must be 3–20 characters.' });
    return;
  }

  const userId = req.userId ?? null;
  const openRoom = roomStore.findOpenPublicRoom({ excludeUserId: userId });
  const sessionId = uuidv4();

  if (openRoom) {
    const updatedState = {
      ...openRoom,
      players: {
        ...openRoom.players,
        P2: {
          ...openRoom.players.P2,
          displayName,
          sessionId,
          userId,
        },
      },
      updatedAt: Date.now(),
    };
    roomStore.set(openRoom.roomCode, updatedState);
    roomStore.bindSession(sessionId, openRoom.roomCode);

    res.status(200).json({
      roomCode: openRoom.roomCode,
      playerId: 'P2',
      sessionId,
      matched: true,
    });
    return;
  }

  const roomCode = makeUniqueRoomCode();
  const state = {
    ...createInitialState(roomCode, displayName, sessionId, userId),
    isPublic: true,
  };
  roomStore.set(roomCode, state);
  roomStore.bindSession(sessionId, roomCode);

  res.status(201).json({
    roomCode,
    playerId: 'P1',
    sessionId,
    matched: false,
  });
});

/**
 * POST /api/rooms/:code/join
 * Joins an existing room as P2.
 */
roomsRouter.post('/:code/join', optionalAuth, (req, res) => {
  const { code } = req.params;
  const displayName = cleanDisplayName((req.body as { displayName?: string }).displayName);

  if (!displayName) {
    res.status(400).json({ error: 'displayName must be 3–20 characters.' });
    return;
  }

  const state = roomStore.get(code.toUpperCase());

  if (!state) {
    res.status(404).json({ error: 'Room not found.', code: 'ROOM_NOT_FOUND' });
    return;
  }
  if (state.players.P2.sessionId) {
    res.status(409).json({ error: 'Room is full.', code: 'ROOM_FULL' });
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
  const userId = req.userId ?? null;

  // Store the userId on the room state so the socket handler can use it
  const updatedState = {
    ...state,
    players: {
      ...state.players,
      // Reserve P2's session/user so duplicate joins cannot claim this room before socket connect.
      P2: { ...state.players.P2, displayName, sessionId, userId },
    },
    updatedAt: Date.now(),
  };
  roomStore.set(code.toUpperCase(), updatedState);
  roomStore.bindSession(sessionId, code.toUpperCase());

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
