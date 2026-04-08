import type { GameState } from '@tic-tac-gulp/shared';

/** In-memory room store. Replace with Redis adapter for multi-server deployments. */
const rooms = new Map<string, GameState>();

/** Maps sessionId → roomCode for reconnect lookups. */
const sessionToRoom = new Map<string, string>();

/** Maps sessionId → forfeit timer handle. */
const forfeitTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const roomStore = {
  get(roomCode: string): GameState | undefined {
    return rooms.get(roomCode);
  },

  set(roomCode: string, state: GameState): void {
    rooms.set(roomCode, state);
  },

  delete(roomCode: string): void {
    rooms.delete(roomCode);
  },

  has(roomCode: string): boolean {
    return rooms.has(roomCode);
  },

  /** Associates a session with a room for reconnect lookups. */
  bindSession(sessionId: string, roomCode: string): void {
    sessionToRoom.set(sessionId, roomCode);
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
};
