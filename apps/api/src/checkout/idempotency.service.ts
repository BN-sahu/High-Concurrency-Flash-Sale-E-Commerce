import { getPrisma } from '@flash-sale/database';
import { createLogger } from '../observability/logger';
import { IDEMPOTENCY_KEY_TTL_MS } from '@flash-sale/shared';

const logger = createLogger('idempotency');

/**
 * Check if an operation with this idempotency key has been processed.
 * Returns the cached result if it exists and is successful.
 */
export async function getIdempotencyResult(key: string): Promise<any | null> {
  const prisma = getPrisma();

  const record = await prisma.idempotencyKey.findUnique({
    where: { key },
  });

  if (!record) {
    return null;
  }

  // Clean up expired records
  if (new Date() > record.expiresAt) {
    await prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
    return null;
  }

  if (record.status === 'SUCCESS') {
    logger.debug({ key }, 'Idempotency hit (success)');
    return record.result;
  }

  if (record.status === 'FAILURE') {
    logger.debug({ key }, 'Idempotency hit (failure)');
    throw new Error('Previous request with this key failed. Please retry with a new key.');
  }

  // PROCESSING status: another request is in progress
  // Return null to let the caller decide whether to wait or reject
  return null;
}

/**
 * Record a successful result for an idempotency key.
 */
export async function recordIdempotencySuccess(key: string, result: any): Promise<void> {
  const prisma = getPrisma();

  await prisma.idempotencyKey.upsert({
    where: { key },
    create: {
      key,
      result,
      status: 'SUCCESS',
      expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
    },
    update: {
      result,
      status: 'SUCCESS',
      expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
    },
  });

  logger.debug({ key }, 'Recorded idempotency success');
}

/**
 * Record a failed result for an idempotency key.
 */
export async function recordIdempotencyFailure(key: string, error: any): Promise<void> {
  const prisma = getPrisma();

  await prisma.idempotencyKey.upsert({
    where: { key },
    create: {
      key,
      result: { error: error.message || 'Unknown error' },
      status: 'FAILURE',
      expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
    },
    update: {
      result: { error: error.message || 'Unknown error' },
      status: 'FAILURE',
      expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
    },
  });

  logger.debug({ key }, 'Recorded idempotency failure');
}
