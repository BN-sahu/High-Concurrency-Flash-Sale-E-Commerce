import Redlock, { Lock } from 'redlock';
import { getRedis } from './redis.service';
import { createLogger } from '../observability/logger';
import { LockAcquisitionError } from '@flash-sale/shared';
import {
  LOCK_TTL_MS,
  LOCK_RETRY_COUNT,
  LOCK_RETRY_DELAY_MS,
  LOCK_RETRY_JITTER_MS,
  REDIS_LOCK_PREFIX,
} from '@flash-sale/shared';

const logger = createLogger('distributed-lock');

let redlockInstance: Redlock | null = null;

/**
 * Get the singleton Redlock instance.
 */
function getRedlock(): Redlock {
  if (!redlockInstance) {
    const redis = getRedis();
    redlockInstance = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: LOCK_RETRY_COUNT,
      retryDelay: LOCK_RETRY_DELAY_MS,
      retryJitter: LOCK_RETRY_JITTER_MS,
      automaticExtensionThreshold: 500,
    });

    redlockInstance.on('error', (error: Error) => {
      logger.error({ err: error }, 'Redlock error');
    });
  }
  return redlockInstance;
}

/**
 * Acquire a distributed lock for an inventory item.
 * Prevents concurrent reservations from overselling.
 *
 * @param inventoryId - The inventory ID to lock
 * @param ttlMs - Lock TTL in milliseconds (default: 5000ms)
 * @returns The lock object (must be released in finally block)
 * @throws LockAcquisitionError if the lock cannot be acquired
 */
export async function acquireInventoryLock(
  inventoryId: string,
  ttlMs: number = LOCK_TTL_MS
): Promise<Lock> {
  const lockKey = `${REDIS_LOCK_PREFIX}${inventoryId}`;

  try {
    logger.debug({ inventoryId, lockKey, ttlMs }, 'Attempting to acquire lock');
    const lock = await getRedlock().acquire([lockKey], ttlMs);
    logger.debug({ inventoryId }, 'Lock acquired successfully');
    return lock;
  } catch (error) {
    logger.warn({ inventoryId, err: error }, 'Failed to acquire lock');
    throw new LockAcquisitionError(inventoryId);
  }
}

/**
 * Release a previously acquired lock.
 * Must be called in a finally block to ensure release.
 */
export async function releaseLock(lock: Lock): Promise<void> {
  try {
    await lock.release();
    logger.debug('Lock released successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to release lock (will auto-expire)');
    // Lock will auto-expire via TTL; log but do not rethrow
  }
}
