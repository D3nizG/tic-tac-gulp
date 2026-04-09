import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createServer } from '../server.js';

const { app } = createServer();
const request = supertest(app);

// ─── POST /api/rooms ──────────────────────────────────────────────────────────

describe('POST /api/rooms', () => {
  it('creates a room and returns roomCode, playerId=P1, sessionId', async () => {
    const res = await request.post('/api/rooms').send({ displayName: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.playerId).toBe('P1');
    expect(typeof res.body.sessionId).toBe('string');
    expect(res.body.sessionId.length).toBeGreaterThan(0);
  });

  it('trims whitespace from displayName', async () => {
    const res = await request.post('/api/rooms').send({ displayName: '  Alice  ' });
    expect(res.status).toBe(201);
  });

  it('rejects missing displayName', async () => {
    const res = await request.post('/api/rooms').send({});
    expect(res.status).toBe(400);
  });

  it('rejects displayName shorter than 3 characters', async () => {
    const res = await request.post('/api/rooms').send({ displayName: 'AB' });
    expect(res.status).toBe(400);
  });

  it('rejects displayName longer than 16 characters', async () => {
    const res = await request.post('/api/rooms').send({ displayName: 'A'.repeat(17) });
    expect(res.status).toBe(400);
  });

  it('accepts displayName at minimum length (3)', async () => {
    const res = await request.post('/api/rooms').send({ displayName: 'Bob' });
    expect(res.status).toBe(201);
  });

  it('accepts displayName at maximum length (16)', async () => {
    const res = await request.post('/api/rooms').send({ displayName: 'A'.repeat(16) });
    expect(res.status).toBe(201);
  });

  it('each created room gets a unique code', async () => {
    const [r1, r2] = await Promise.all([
      request.post('/api/rooms').send({ displayName: 'Alice' }),
      request.post('/api/rooms').send({ displayName: 'Bob' }),
    ]);
    expect(r1.body.roomCode).not.toBe(r2.body.roomCode);
  });
});

// ─── POST /api/rooms/:code/join ───────────────────────────────────────────────

describe('POST /api/rooms/:code/join', () => {
  async function createRoom(name = 'Alice'): Promise<string> {
    const res = await request.post('/api/rooms').send({ displayName: name });
    return res.body.roomCode as string;
  }

  it('joins an existing room as P2', async () => {
    const roomCode = await createRoom();
    const res = await request.post(`/api/rooms/${roomCode}/join`).send({ displayName: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.roomCode).toBe(roomCode);
    expect(res.body.playerId).toBe('P2');
    expect(typeof res.body.sessionId).toBe('string');
  });

  it('returns 404 for unknown room code', async () => {
    const res = await request.post('/api/rooms/XXXXXX/join').send({ displayName: 'Bob' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROOM_NOT_FOUND');
  });

  it('is case-insensitive for room codes', async () => {
    const roomCode = await createRoom();
    const res = await request
      .post(`/api/rooms/${roomCode.toLowerCase()}/join`)
      .send({ displayName: 'Bob' });
    expect(res.status).toBe(200);
  });

  it('rejects displayName shorter than 3 characters', async () => {
    const roomCode = await createRoom();
    const res = await request.post(`/api/rooms/${roomCode}/join`).send({ displayName: 'B' });
    expect(res.status).toBe(400);
  });

  it('rejects displayName longer than 16 characters', async () => {
    const roomCode = await createRoom();
    const res = await request
      .post(`/api/rooms/${roomCode}/join`)
      .send({ displayName: 'B'.repeat(17) });
    expect(res.status).toBe(400);
  });

  it('rejects missing displayName', async () => {
    const roomCode = await createRoom();
    const res = await request.post(`/api/rooms/${roomCode}/join`).send({});
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/rooms/:code ─────────────────────────────────────────────────────

describe('GET /api/rooms/:code', () => {
  it('returns room info for an existing room', async () => {
    const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
    const { roomCode } = createRes.body;

    const res = await request.get(`/api/rooms/${roomCode}`);
    expect(res.status).toBe(200);
    expect(res.body.roomCode).toBe(roomCode);
    expect(res.body.status).toBe('WAITING');
    expect(res.body.players.P1.name).toBe('Alice');
    expect(res.body.players.P1.connected).toBe(false);
  });

  it('shows updated status after P2 HTTP-joins', async () => {
    const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
    const { roomCode } = createRes.body;
    await request.post(`/api/rooms/${roomCode}/join`).send({ displayName: 'Bob' });

    const res = await request.get(`/api/rooms/${roomCode}`);
    expect(res.status).toBe(200);
    // Status stays WAITING until P2 socket-joins
    expect(res.body.status).toBe('WAITING');
  });

  it('returns 404 for unknown room code', async () => {
    const res = await request.get('/api/rooms/XXXXXX');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROOM_NOT_FOUND');
  });

  it('is case-insensitive for room codes', async () => {
    const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
    const { roomCode } = createRes.body;
    const res = await request.get(`/api/rooms/${roomCode.toLowerCase()}`);
    expect(res.status).toBe(200);
  });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
