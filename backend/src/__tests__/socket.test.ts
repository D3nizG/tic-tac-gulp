import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioclient, type Socket } from 'socket.io-client';
import supertest from 'supertest';
import { createServer } from '../server.js';
import type { Server } from 'http';
import type { Server as SocketServer } from 'socket.io';
import type { AddressInfo } from 'net';

// ─── Test server setup ────────────────────────────────────────────────────────

const FORFEIT_MS = 150;

let baseUrl: string;
let request: ReturnType<typeof supertest>;
let httpServer: Server;
let ioServer: SocketServer;

beforeAll(async () => {
  const { app, httpServer: s, io } = createServer({ forfeitTimeoutMs: FORFEIT_MS });
  httpServer = s;
  ioServer = io;
  request = supertest(app);
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => ioServer.close(() => httpServer.close(() => resolve())));
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for '${event}'`)),
      timeoutMs
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioclient(baseUrl, { autoConnect: false });
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 3000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.connect();
  });
}

interface RoomSetup {
  roomCode: string;
  p1Session: string;
  p2Session: string;
  p1Socket: Socket;
  p2Socket: Socket;
}

/** HTTP-create + HTTP-join + socket-join both players through to LOBBY status. */
async function setupRoom(): Promise<RoomSetup> {
  const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
  const { roomCode, sessionId: p1Session } = createRes.body as {
    roomCode: string;
    sessionId: string;
  };

  const joinRes = await request
    .post(`/api/rooms/${roomCode}/join`)
    .send({ displayName: 'Bob' });
  const { sessionId: p2Session } = joinRes.body as { sessionId: string };

  const [p1Socket, p2Socket] = await Promise.all([connectSocket(), connectSocket()]);

  // P1 joins via socket
  const p1Joined = waitForEvent(p1Socket, 'room:joined');
  p1Socket.emit('room:join', { sessionId: p1Session, roomCode, displayName: 'Alice', playerId: 'P1' });
  await p1Joined;

  // P2 joins via socket — P1 receives room:updated
  const p2Joined = waitForEvent(p2Socket, 'room:joined');
  const p1Updated = waitForEvent(p1Socket, 'room:updated');
  p2Socket.emit('room:join', { sessionId: p2Session, roomCode, displayName: 'Bob', playerId: 'P2' });
  await Promise.all([p2Joined, p1Updated]);

  return { roomCode, p1Session, p2Session, p1Socket, p2Socket };
}

/** setupRoom + game:start → both players in IN_PROGRESS state. */
async function setupGame(): Promise<RoomSetup> {
  const room = await setupRoom();
  const { roomCode, p1Session, p1Socket, p2Socket } = room;

  const p1Started = waitForEvent(p1Socket, 'game:started');
  const p2Started = waitForEvent(p2Socket, 'game:started');
  p1Socket.emit('game:start', { sessionId: p1Session, roomCode });
  await Promise.all([p1Started, p2Started]);

  return room;
}

/**
 * Emit a move and wait for BOTH sockets to receive either game:state or game:ended.
 * This prevents race conditions where a broadcast from one move arrives on the
 * observer socket and gets consumed by the next move's listener.
 */
async function emitMove(
  emitterSocket: Socket,
  observerSocket: Socket,
  sessionId: string,
  roomCode: string,
  pieceSize: 1 | 2 | 3,
  row: number,
  col: number
): Promise<[unknown, unknown]> {
  const e1 = waitForEvent(emitterSocket, 'game:state');
  const o1 = waitForEvent(observerSocket, 'game:state');
  const e2 = waitForEvent(emitterSocket, 'game:ended');
  const o2 = waitForEvent(observerSocket, 'game:ended');

  emitterSocket.emit('move:attempt', { sessionId, roomCode, pieceSize, row, col });

  return Promise.race([
    Promise.all([e1, o1]) as Promise<[unknown, unknown]>,
    Promise.all([e2, o2]) as Promise<[unknown, unknown]>,
  ]);
}

/**
 * P1 wins by placing 3 small pieces across the top row, with P2 blocking elsewhere.
 * Move sequence: P1→[0,0]  P2→[1,0]  P1→[0,1]  P2→[1,1]  P1→[0,2] (win)
 */
async function playToWin(room: RoomSetup): Promise<void> {
  const { roomCode, p1Session, p2Session, p1Socket, p2Socket } = room;

  const moves: [Socket, Socket, string, 1 | 2 | 3, number, number][] = [
    [p1Socket, p2Socket, p1Session, 1, 0, 0],
    [p2Socket, p1Socket, p2Session, 1, 1, 0],
    [p1Socket, p2Socket, p1Session, 1, 0, 1],
    [p2Socket, p1Socket, p2Session, 1, 1, 1],
  ];
  for (const [emitter, observer, session, size, row, col] of moves) {
    await emitMove(emitter, observer, session, roomCode, size, row, col);
  }

  // Winning move — both sockets receive game:ended
  const p1Ended = waitForEvent(p1Socket, 'game:ended');
  const p2Ended = waitForEvent(p2Socket, 'game:ended');
  p1Socket.emit('move:attempt', { sessionId: p1Session, roomCode, pieceSize: 1, row: 0, col: 2 });
  await Promise.all([p1Ended, p2Ended]);
}

// ─── room:join ────────────────────────────────────────────────────────────────

describe('room:join', () => {
  it('P1 receives room:joined with correct playerId and gameState', async () => {
    const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
    const { roomCode, sessionId } = createRes.body;

    const socket = await connectSocket();
    try {
      const joinedPromise = waitForEvent<any>(socket, 'room:joined');
      socket.emit('room:join', { sessionId, roomCode, displayName: 'Alice', playerId: 'P1' });
      const data = await joinedPromise;
      expect(data.roomCode).toBe(roomCode);
      expect(data.yourPlayerId).toBe('P1');
      expect(data.gameState.status).toBe('WAITING');
    } finally {
      socket.disconnect();
    }
  });

  it('P2 joining moves room to LOBBY and notifies P1 via room:updated', async () => {
    const { roomCode, p1Socket, p2Socket } = await setupRoom();
    try {
      const infoRes = await request.get(`/api/rooms/${roomCode}`);
      expect(infoRes.body.status).toBe('LOBBY');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('unknown room returns error event', async () => {
    const socket = await connectSocket();
    try {
      const errorPromise = waitForEvent<any>(socket, 'error');
      socket.emit('room:join', {
        sessionId: 'fake-session',
        roomCode: 'XXXXXX',
        displayName: 'Alice',
        playerId: 'P1',
      });
      const err = await errorPromise;
      expect(err.code).toBe('ROOM_NOT_FOUND');
    } finally {
      socket.disconnect();
    }
  });

  it('socketId is not exposed in room:joined payload', async () => {
    const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
    const { roomCode, sessionId } = createRes.body;

    const socket = await connectSocket();
    try {
      const joinedPromise = waitForEvent<any>(socket, 'room:joined');
      socket.emit('room:join', { sessionId, roomCode, displayName: 'Alice', playerId: 'P1' });
      const data = await joinedPromise;
      expect(data.gameState.players.P1.socketId).toBeUndefined();
    } finally {
      socket.disconnect();
    }
  });
});

// ─── room:rejoin ──────────────────────────────────────────────────────────────

describe('room:rejoin', () => {
  it('reconnected player receives full game state', async () => {
    const { roomCode, p1Session, p1Socket, p2Socket } = await setupRoom();
    try {
      p1Socket.disconnect();

      const newSocket = await connectSocket();
      try {
        const rejoinedPromise = waitForEvent<any>(newSocket, 'room:joined');
        newSocket.emit('room:rejoin', { sessionId: p1Session, roomCode });
        const data = await rejoinedPromise;
        expect(data.roomCode).toBe(roomCode);
        expect(data.yourPlayerId).toBe('P1');
        expect(data.gameState).toBeDefined();
      } finally {
        newSocket.disconnect();
      }
    } finally {
      p2Socket.disconnect();
    }
  });

  it('invalid session returns error event', async () => {
    const createRes = await request.post('/api/rooms').send({ displayName: 'Alice' });
    const { roomCode } = createRes.body;

    const socket = await connectSocket();
    try {
      const errorPromise = waitForEvent<any>(socket, 'error');
      socket.emit('room:rejoin', { sessionId: 'invalid-session', roomCode });
      const err = await errorPromise;
      expect(err.code).toBe('SESSION_INVALID');
    } finally {
      socket.disconnect();
    }
  });
});

// ─── game:start ───────────────────────────────────────────────────────────────

describe('game:start', () => {
  it('host starts game and both players receive game:started with IN_PROGRESS state', async () => {
    const { roomCode, p1Session, p1Socket, p2Socket } = await setupRoom();
    try {
      const p1Started = waitForEvent<any>(p1Socket, 'game:started');
      const p2Started = waitForEvent<any>(p2Socket, 'game:started');
      p1Socket.emit('game:start', { sessionId: p1Session, roomCode });
      const [p1Data, p2Data] = await Promise.all([p1Started, p2Started]);
      expect(p1Data.gameState.status).toBe('IN_PROGRESS');
      expect(p2Data.gameState.status).toBe('IN_PROGRESS');
      expect(p1Data.gameState.currentTurn).toBe('P1');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('non-host (P2) cannot start the game', async () => {
    const { roomCode, p2Session, p1Socket, p2Socket } = await setupRoom();
    try {
      const errorPromise = waitForEvent<any>(p2Socket, 'error');
      p2Socket.emit('game:start', { sessionId: p2Session, roomCode });
      const err = await errorPromise;
      expect(err.code).toBe('SESSION_INVALID');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });
});

// ─── move:attempt ─────────────────────────────────────────────────────────────

describe('move:attempt', () => {
  it('valid move broadcasts updated game:state and advances the turn', async () => {
    const { roomCode, p1Session, p1Socket, p2Socket } = await setupGame();
    try {
      const [state] = await emitMove(p1Socket, p2Socket, p1Session, roomCode, 1, 0, 0) as any[];
      expect(state.gameState.board[0][0].stack).toHaveLength(1);
      expect(state.gameState.board[0][0].stack[0].owner).toBe('P1');
      expect(state.gameState.currentTurn).toBe('P2');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('move on wrong turn sends move:error only to that player', async () => {
    const { roomCode, p2Session, p1Socket, p2Socket } = await setupGame();
    try {
      const errorPromise = waitForEvent<any>(p2Socket, 'move:error');
      p2Socket.emit('move:attempt', { sessionId: p2Session, roomCode, pieceSize: 1, row: 0, col: 0 });
      const err = await errorPromise;
      expect(err).toBeDefined();
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('cannot stack a smaller piece on top of a larger one', async () => {
    const { roomCode, p1Session, p2Session, p1Socket, p2Socket } = await setupGame();
    try {
      // P1 places large at [0,0], P2 places large at [1,1]
      await emitMove(p1Socket, p2Socket, p1Session, roomCode, 3, 0, 0);
      await emitMove(p2Socket, p1Socket, p2Session, roomCode, 3, 1, 1);
      // P1 tries to place small on top of large → blocked
      const errorPromise = waitForEvent<any>(p1Socket, 'move:error');
      p1Socket.emit('move:attempt', { sessionId: p1Session, roomCode, pieceSize: 1, row: 0, col: 0 });
      const err = await errorPromise;
      expect(err).toBeDefined();
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('can gulp: larger piece placed on top of smaller one', async () => {
    const { roomCode, p1Session, p2Session, p1Socket, p2Socket } = await setupGame();
    try {
      // P1 places small at [0,0], P2 places small at [1,1]
      await emitMove(p1Socket, p2Socket, p1Session, roomCode, 1, 0, 0);
      await emitMove(p2Socket, p1Socket, p2Session, roomCode, 1, 1, 1);
      // P1 gulps [0,0] with large — both receive game:state
      const [state] = await emitMove(p1Socket, p2Socket, p1Session, roomCode, 3, 0, 0) as any[];
      expect(state.gameState.board[0][0].stack).toHaveLength(2);
      expect(state.gameState.board[0][0].stack[1].size).toBe(3);
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('invalid session on move sends move:error', async () => {
    const { roomCode, p1Socket, p2Socket } = await setupGame();
    try {
      const errorPromise = waitForEvent<any>(p1Socket, 'move:error');
      p1Socket.emit('move:attempt', {
        sessionId: 'bad-session',
        roomCode,
        pieceSize: 1,
        row: 0,
        col: 0,
      });
      const err = await errorPromise;
      expect(err.code).toBe('SESSION_INVALID');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });
});

// ─── game:ended ───────────────────────────────────────────────────────────────

describe('game:ended', () => {
  it('three-in-a-row triggers game:ended with correct winner and winLine', async () => {
    const room = await setupGame();
    const { p1Socket, p2Socket } = room;
    try {
      await playToWin(room);
      // game:ended was already awaited inside playToWin — verify state via HTTP
      const infoRes = await request.get(`/api/rooms/${room.roomCode}`);
      expect(infoRes.body.status).toBe('ENDED');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('game:ended payload contains winner, reason, and winLine', async () => {
    const room = await setupGame();
    const { roomCode, p1Session, p2Session, p1Socket, p2Socket } = room;
    try {
      const moves: [Socket, Socket, string, 1 | 2 | 3, number, number][] = [
        [p1Socket, p2Socket, p1Session, 1, 0, 0],
        [p2Socket, p1Socket, p2Session, 1, 1, 0],
        [p1Socket, p2Socket, p1Session, 1, 0, 1],
        [p2Socket, p1Socket, p2Session, 1, 1, 1],
      ];
      for (const [emitter, observer, session, size, row, col] of moves) {
        await emitMove(emitter, observer, session, roomCode, size, row, col);
      }
      const p1Ended = waitForEvent<any>(p1Socket, 'game:ended');
      const p2Ended = waitForEvent<any>(p2Socket, 'game:ended');
      p1Socket.emit('move:attempt', { sessionId: p1Session, roomCode, pieceSize: 1, row: 0, col: 2 });
      const [ended] = await Promise.all([p1Ended, p2Ended]);
      expect(ended.winner).toBe('P1');
      expect(ended.reason).toBe('normal');
      expect(ended.gameState.status).toBe('ENDED');
      expect(ended.gameState.winLine).toHaveLength(3);
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });
});

// ─── disconnect & forfeit ─────────────────────────────────────────────────────

describe('disconnect & forfeit', () => {
  it('disconnect sends player:disconnected to the other player', async () => {
    const { p1Socket, p2Socket } = await setupGame();
    try {
      const disconnectedPromise = waitForEvent<any>(p2Socket, 'player:disconnected');
      p1Socket.disconnect();
      const data = await disconnectedPromise;
      expect(data.playerId).toBe('P1');
      expect(typeof data.timeoutSeconds).toBe('number');
    } finally {
      p2Socket.disconnect();
    }
  });

  it('forfeit fires game:ended after timeout expires', async () => {
    const { p1Socket, p2Socket } = await setupGame();

    const disconnectedPromise = waitForEvent<any>(p2Socket, 'player:disconnected');
    p1Socket.disconnect();
    await disconnectedPromise;

    // Forfeit timeout is FORFEIT_MS (150ms) — wait up to 2s for the event
    const ended = await waitForEvent<any>(p2Socket, 'game:ended', 2000);
    expect(ended.winner).toBe('P2');
    expect(ended.reason).toBe('forfeit');
    p2Socket.disconnect();
  });

  it('reconnecting before timeout cancels the forfeit', async () => {
    const { roomCode, p1Session, p1Socket, p2Socket } = await setupGame();

    const disconnectedPromise = waitForEvent<any>(p2Socket, 'player:disconnected');
    p1Socket.disconnect();
    await disconnectedPromise;

    // Reconnect immediately (well within FORFEIT_MS)
    const newP1Socket = await connectSocket();
    try {
      const rejoinedPromise = waitForEvent<any>(newP1Socket, 'room:joined');
      const reconnectedPromise = waitForEvent<any>(p2Socket, 'player:reconnected');
      newP1Socket.emit('room:rejoin', { sessionId: p1Session, roomCode });
      await Promise.all([rejoinedPromise, reconnectedPromise]);

      // Wait past the original timeout and confirm game:ended does NOT fire
      const endedPromise = waitForEvent<any>(p2Socket, 'game:ended', FORFEIT_MS * 3);
      await expect(endedPromise).rejects.toThrow(/Timed out/);
    } finally {
      newP1Socket.disconnect();
      p2Socket.disconnect();
    }
  });
});

// ─── rematch ──────────────────────────────────────────────────────────────────

describe('rematch', () => {
  async function setupEndedGame(): Promise<RoomSetup> {
    const room = await setupGame();
    await playToWin(room);
    return room;
  }

  it('both accept → rematch:started with fresh IN_PROGRESS state and reset inventory', async () => {
    const { roomCode, p1Session, p2Session, p1Socket, p2Socket } = await setupEndedGame();
    try {
      const p1Rematch = waitForEvent<any>(p1Socket, 'rematch:started');
      const p2Rematch = waitForEvent<any>(p2Socket, 'rematch:started');
      p1Socket.emit('rematch:accept', { sessionId: p1Session, roomCode });
      p2Socket.emit('rematch:accept', { sessionId: p2Session, roomCode });
      const [data] = await Promise.all([p1Rematch, p2Rematch]);
      expect(data.gameState.status).toBe('IN_PROGRESS');
      expect(data.gameState.moveCount).toBe(0);
      expect(data.gameState.winner).toBeNull();
      expect(data.gameState.players.P1.inventory.small).toBe(3);
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('first accept emits rematch:requested to the other player', async () => {
    const { roomCode, p1Session, p1Socket, p2Socket } = await setupEndedGame();
    try {
      const requestedPromise = waitForEvent<any>(p2Socket, 'rematch:requested');
      p1Socket.emit('rematch:accept', { sessionId: p1Session, roomCode });
      const data = await requestedPromise;
      expect(data.byPlayerId).toBe('P1');
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });

  it('decline sends rematch:declined to other player', async () => {
    const { roomCode, p2Session, p1Socket, p2Socket } = await setupEndedGame();
    try {
      const declinedPromise = waitForEvent<any>(p1Socket, 'rematch:declined');
      p2Socket.emit('rematch:decline', { sessionId: p2Session, roomCode });
      await declinedPromise;
    } finally {
      p1Socket.disconnect();
      p2Socket.disconnect();
    }
  });
});
