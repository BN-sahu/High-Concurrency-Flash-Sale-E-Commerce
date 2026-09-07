import { getPrisma } from '@flash-sale/database';
import { Prisma } from '@flash-sale/database';
import { acquireInventoryLock, releaseLock } from '../cache/distributed-lock';
import {
  getIdempotencyResult,
  recordIdempotencySuccess,
  recordIdempotencyFailure,
} from './idempotency.service';
import { createLogger } from '../observability/logger';
import {
  InsufficientInventoryError,
  InvalidStateTransitionError,
  ReservationExpiredError,
  NotFoundError,
} from '@flash-sale/shared';
import { RESERVATION_TTL_MS, PAYMENT_WINDOW_TTL_MS } from '@flash-sale/shared';

const logger = createLogger('reservation-service');

/**
 * CRITICAL: Atomic reservation with distributed lock + PostgreSQL transaction.
 *
 * Guarantees:
 * - Exactly one reservation succeeds per available inventory unit
 * - Idempotent: repeated requests with same key return original result
 * - Timeout: reservation expires after 10 minutes
 * - State Machine: RESERVED → PAYMENT_PENDING → SOLD / EXPIRED / FAILED
 *
 * The reservation flow uses TWO layers of protection:
 * 1. Redis Distributed Lock (Redlock) — fast rejection of concurrent requests
 * 2. PostgreSQL SELECT FOR UPDATE — database-level row lock for atomicity
 */
export async function createReservation(
  userId: string,
  productId: string,
  quantity: number = 1,
  idempotencyKey: string
) {
  // Step 1: Check idempotency (fast path for duplicate requests)
  const existing = await getIdempotencyResult(idempotencyKey);
  if (existing) {
    logger.info({ idempotencyKey }, 'Idempotency hit: returning cached result');
    return existing;
  }

  const prisma = getPrisma();

  // Step 2: Look up inventory (without lock, just to get the inventory ID)
  const inventory = await prisma.inventory.findFirst({
    where: { productId },
    include: { product: true },
  });

  if (!inventory) {
    throw new NotFoundError('Product', productId);
  }

  // Quick availability check (non-authoritative, just for fast rejection)
  if (inventory.availableQuantity < quantity) {
    throw new InsufficientInventoryError(productId, inventory.availableQuantity, quantity);
  }

  // Step 3: Acquire Redis distributed lock
  const lock = await acquireInventoryLock(inventory.id);

  try {
    // Step 4: PostgreSQL transaction with SERIALIZABLE isolation + row-level lock
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock the inventory row FOR UPDATE using raw SQL
        // This prevents any other transaction from reading/writing this row
        const lockedRows = await tx.$queryRaw<Array<{
          id: string;
          availableQuantity: number;
          reservedQuantity: number;
          soldQuantity: number;
          totalQuantity: number;
          versionLock: number;
        }>>`
          SELECT "id", "availableQuantity", "reservedQuantity", "soldQuantity", "totalQuantity", "versionLock"
          FROM "Inventory"
          WHERE "id" = ${inventory.id}
          FOR UPDATE
        `;

        if (!lockedRows.length) {
          throw new NotFoundError('Inventory', inventory.id);
        }

        const lockedInventory = lockedRows[0];

        // Validate availability (authoritative check under lock)
        if (lockedInventory.availableQuantity < quantity) {
          throw new InsufficientInventoryError(
            productId,
            lockedInventory.availableQuantity,
            quantity
          );
        }

        // Step 5: Create reservation and update inventory atomically
        const reservation = await tx.reservation.create({
          data: {
            inventoryId: inventory.id,
            productId,
            userId,
            quantity,
            state: 'RESERVED',
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
            idempotencyKey,
          },
          include: { product: true },
        });

        // Decrement available, increment reserved
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            availableQuantity: { decrement: quantity },
            reservedQuantity: { increment: quantity },
            versionLock: { increment: 1 },
          },
        });

        // Step 6: Publish outbox event (within the same transaction)
        await tx.outboxEvent.create({
          data: {
            eventType: 'reservation.created',
            aggregateId: reservation.id,
            payload: {
              reservationId: reservation.id,
              userId,
              productId,
              quantity,
              expiresAt: reservation.expiresAt.toISOString(),
            },
          },
        });

        return reservation;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000, // 10 second transaction timeout
      }
    );

    // Step 7: Record idempotency success (outside transaction — ok if this fails)
    await recordIdempotencySuccess(idempotencyKey, {
      id: result.id,
      productId: result.productId,
      quantity: result.quantity,
      state: result.state,
      expiresAt: result.expiresAt.toISOString(),
    });

    logger.info(
      { reservationId: result.id, userId, productId, quantity },
      'Reservation created successfully'
    );

    return result;
  } catch (error: any) {
    // Step 8: Record failure for idempotency (prevents immediate retry with same key)
    if (error.code !== 'INSUFFICIENT_INVENTORY') {
      await recordIdempotencyFailure(idempotencyKey, error).catch(() => {});
    }
    throw error;
  } finally {
    // Step 9: ALWAYS release the distributed lock
    await releaseLock(lock);
  }
}

/**
 * Transition reservation from RESERVED to PAYMENT_PENDING.
 * Called when user proceeds to checkout/payment.
 */
export async function transitionToPaymentPending(
  reservationId: string,
  checkoutSessionId: string
) {
  const prisma = getPrisma();

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    throw new NotFoundError('Reservation', reservationId);
  }

  if (reservation.state !== 'RESERVED') {
    throw new InvalidStateTransitionError(
      'Reservation',
      reservation.state,
      'PAYMENT_PENDING'
    );
  }

  if (new Date() > reservation.expiresAt) {
    throw new ReservationExpiredError(reservationId);
  }

  return prisma.reservation.update({
    where: { id: reservationId },
    data: {
      state: 'PAYMENT_PENDING',
      checkoutSessionId,
      expiresAt: new Date(Date.now() + PAYMENT_WINDOW_TTL_MS),
    },
  });
}

/**
 * Transition reservation from PAYMENT_PENDING to SOLD.
 * Called when payment is confirmed via Stripe webhook.
 */
export async function transitionToSold(reservationId: string, paymentId: string) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    if (reservation.state !== 'PAYMENT_PENDING') {
      throw new InvalidStateTransitionError(
        'Reservation',
        reservation.state,
        'SOLD'
      );
    }

    // Update reservation to SOLD
    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        state: 'SOLD',
        paymentId,
      },
    });

    // Move quantity from reserved to sold
    await tx.inventory.update({
      where: { id: reservation.inventoryId },
      data: {
        reservedQuantity: { decrement: reservation.quantity },
        soldQuantity: { increment: reservation.quantity },
      },
    });

    return updated;
  });
}

/**
 * Expire old reservations and return inventory to AVAILABLE state.
 * Run periodically (every 30 seconds) via background job.
 */
export async function expireReservations(): Promise<number> {
  const prisma = getPrisma();
  const now = new Date();

  // Find all expired reservations still in RESERVED or PAYMENT_PENDING state
  const expired = await prisma.reservation.findMany({
    where: {
      expiresAt: { lt: now },
      state: { in: ['RESERVED', 'PAYMENT_PENDING'] },
    },
    include: { inventory: true },
  });

  if (expired.length === 0) {
    return 0;
  }

  logger.info({ count: expired.length }, 'Expiring reservations');

  let expiredCount = 0;

  for (const reservation of expired) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Update reservation state
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { state: 'EXPIRED' },
          });

          // Return inventory to available
          await tx.inventory.update({
            where: { id: reservation.inventoryId },
            data: {
              availableQuantity: { increment: reservation.quantity },
              reservedQuantity: { decrement: reservation.quantity },
            },
          });

          // Publish event
          await tx.outboxEvent.create({
            data: {
              eventType: 'reservation.expired',
              aggregateId: reservation.id,
              payload: {
                reservationId: reservation.id,
                inventoryId: reservation.inventoryId,
                quantity: reservation.quantity,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      expiredCount++;
      logger.info({ reservationId: reservation.id }, 'Reservation expired');
    } catch (error) {
      logger.error(
        { reservationId: reservation.id, err: error },
        'Failed to expire reservation'
      );
    }
  }

  return expiredCount;
}
