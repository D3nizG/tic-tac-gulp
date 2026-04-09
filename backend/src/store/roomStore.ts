import type { GameState } from '@tic-tac-gulp/shared';
import { getRedis } from '../lib/redis.js';

const ROOM_TTL_SECONDS = 2 * 60 * 60; // 2 hours

/** In-memory room store (primary, authoritative for a running process). */
const rooms = new Map<string, GameState>();

/** Maps sessionId → roomCode for reconnect lookups. */
const sessionToRoom = new Map<string, string>();

/** Maps sessionId → forfeit timer handle. Stays in-memory (process-level). */
const forfeitTimers = new Map<string, ReturnType<typeof setTimeout>>();

function redisKey(roomCode: string) {
  return `room:${roomCode}`;
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

/**
 * Persist a room to Redis (fire-and-forget).
 * Failures are logged but do not block the caller.
 */
function persistRoom(roomCode: string, state: GameState): void {
  const redis = getRedis();
  if (!redis) return;
  redis
    .set(redisKey(roomCode), JSON.stringify(state), 'EX', ROOM_TTL_SECONDS)
    .catch((err: Error) => console.error('[roomStore] Redis set error:', err.message));
}

function deleteFromRedis(roomCode: string): void {
  const redis = getRedis();
  if (!redis) return;
  redis
    .del(redisKey(roomCode))
    .catch((err) => console.error('[roomStore] Redis del error:', err.message));
}

function persistSession(sessionId: string, roomCode: string): void {
  const redis = getRedis();
  if (!redis) return;
  redis
    .set(sessionKey(sessionId), roomCode, 'EX', ROOM_TTL_SECONDS)
    .catch((err) => console.error('[roomStore] Redis session set error:', err.message));
}

export const roomStore = {
  get(roomCode: string): GameState | undefined {
    return rooms.get(roomCode);
  },

  set(roomCode: string, state: GameState): void {
    rooms.set(roomCode, state);
    persistRoom(roomCode, state);
  },

  delete(roomCode: string): void {
    rooms.delete(roomCode);
    deleteFromRedis(roomCode);
  },

  has(roomCode: string): boolean {
    return rooms.has(roomCode);
  },

  /** Associates a session with a room for reconnect lookups. */
  bindSession(sessionId: string, roomCode: string): void {
    sessionToRoom.set(sessionId, roomCode);
    persistSession(sessionId, roomCode);
  },

  getRoomBySession(sessionId: string): string | undefined {
    return sessionToRoom.get(sessionId);
  },

  /** Start a forfeit timer for a disconnected player. */
  startForfeitTimer(
    sessionId: string,
    timeoutMs: number,
    onExpire: () => void
  ): void {
    this.clearForfeitTimer(sessionId);
    const handle = setTimeout(onExpire, timeoutMs);
    forfeitTimers.set(sessionId, handle);
  },

  clearForfeitTimer(sessionId: string): void {
    const handle = forfeitTimers.get(sessionId);
    if (handle) {
      clearTimeout(handle);
      forfeitTimers.delete(sessionId);
    }
  },

  /**
   * On startup: load all persisted rooms and sessions from Redis into memory.
   * This allows the server to survive a restart without dropping active games.
   */
  async initFromRedis(): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      // Restore rooms
      const roomKeys = await redis.keys('room:*');
      if (roomKeys.length > 0) {
        const values = await redis.mget(...roomKeys);
        let restored = 0;
        for (let i = 0; i < roomKeys.length; i++) {
          const raw = values[i];
          if (!raw) continue;
          try {
            const state: GameState = JSON.parse(raw);
            const code = roomKeys[i].replace('room:', '');
            rooms.set(code, state);
            restored++;
          } catch {
            // corrupt entry, skip
          }
        }
        if (restored > 0) {
          console.log(`[roomStore] Restored ${restored} room(s) from Redis`);
        }
      }

      // Restore session→room mappings
      const sessionKeys = await redis.keys('session:*');
      if (sessionKeys.length > 0) {
        const values = await redis.mget(...sessionKeys);
        for (let i = 0; i < sessionKeys.length; i++) {
          const roomCode = values[i];
          if (!roomCode) continue;
          const sessionId = sessionKeys[i].replace('session:', '');
          sessionToRoom.set(sessionId, roomCode);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[roomStore] Failed to restore from Redis:', msg);
    }
  },
};
