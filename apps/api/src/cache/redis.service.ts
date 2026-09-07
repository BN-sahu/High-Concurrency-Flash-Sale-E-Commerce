import Redis from 'ioredis';
import { createLogger } from '../observability/logger';

const logger = createLogger('redis');

let redisInstance: Redis | null = null;

/**
 * Get the singleton Redis instance.
 * Connection pooling is handled internally by ioredis.
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    redisInstance = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 3000);
        logger.warn({ times, delay }, 'Redis connection retry');
        return delay;
      },
      reconnectOnError(err: Error) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      lazyConnect: false,
      enableReadyCheck: true,
    });

    redisInstance.on('connect', () => {
      logger.info('Redis connected');
    });

    redisInstance.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error');
    });

    redisInstance.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisInstance;
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    logger.info('Redis connection closed gracefully');
  }
}

/**
 * Health check for Redis.
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
