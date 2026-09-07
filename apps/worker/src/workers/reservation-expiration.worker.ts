import { getPrisma } from '@flash-sale/database';
import { Prisma } from '@prisma/client';

/**
 * Reservation expiration worker: releases expired reservations back to inventory.
 */
export async function processReservationExpirationJob(
  data: { reservationId: string; inventoryId: string; quantity: number },
  messageId: string
): Promise<void> {
  const prisma = getPrisma();

  const reservation = await prisma.reservation.findUnique({
    where: { id: data.reservationId },
  });

  if (!reservation) return;

  // Only expire if still in RESERVED or PAYMENT_PENDING
  if (!['RESERVED', 'PAYMENT_PENDING'].includes(reservation.state)) {
    return;
  }

  // Atomic transition
  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: data.reservationId },
      data: { state: 'EXPIRED' },
    });

    await tx.inventory.update({
      where: { id: data.inventoryId },
      data: {
        availableQuantity: { increment: data.quantity },
        reservedQuantity: { decrement: data.quantity },
      },
    });

    await tx.outboxEvent.create({
      data: {
        eventType: 'reservation.expired',
        aggregateId: data.reservationId,
        payload: data,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
