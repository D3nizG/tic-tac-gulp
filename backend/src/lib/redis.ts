import { Redis } from 'ioredis';

let _redis: Redis | null = null;
let _subscriber: Redis | null = null;

/**
 * Returns the shared Redis client, or null if REDIS_URL is not set.
 * Used for room state persistence.
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    _redis.on('error', (err: Error) => {
      console.error('[Redis] connection error:', err.message);
    });
  }
  return _redis;
}

/**
 * Returns a dedicated subscriber Redis client for the Socket.IO adapter.
 * Socket.IO Redis adapter requires two separate clients (pub + sub).
 */
export function getRedisSubscriber(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_subscriber) {
    _subscriber = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    _subscriber.on('error', (err: Error) => {
      console.error('[Redis subscriber] connection error:', err.message);
    });
  }
  return _subscriber;
}
