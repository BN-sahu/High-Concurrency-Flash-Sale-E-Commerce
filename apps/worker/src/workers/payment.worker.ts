import { getPrisma } from '@flash-sale/database';

/**
 * Payment worker: processes payment confirmations from the queue.
 * Idempotent via audit log message ID check.
 */
export async function processPaymentJob(
  data: { orderId: string; userId: string; paymentIntentId?: string },
  messageId: string
): Promise<void> {
  const prisma = getPrisma();

  // Idempotency: check if already processed
  const processed = await prisma.auditLog.findFirst({
    where: { action: 'payment.worker.processed', resourceId: messageId },
  });

  if (processed) {
    return; // Already handled
  }

  const { orderId, userId } = data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.payment?.status === 'CONFIRMED') {
    // Already confirmed; record and skip
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'payment.worker.processed',
        resource: 'Order',
        resourceId: messageId,
        changes: { orderId, note: 'Already confirmed' },
      },
    });
    return;
  }

  // Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CONFIRMED' },
  });

  // Record processing
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'payment.worker.processed',
      resource: 'Order',
      resourceId: messageId,
      changes: { orderId, status: 'CONFIRMED' },
    },
  });
}
