import { getPrisma } from '@flash-sale/database';

/**
 * Order fulfillment worker: handles post-payment order processing.
 */
export async function processOrderFulfillmentJob(
  data: { orderId: string; userId: string },
  messageId: string
): Promise<void> {
  const prisma = getPrisma();

  const processed = await prisma.auditLog.findFirst({
    where: { action: 'order.fulfillment.processed', resourceId: messageId },
  });

  if (processed) return;

  const { orderId } = data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Move to PROCESSING
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'PROCESSING' },
  });

  // Record
  await prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: 'order.fulfillment.processed',
      resource: 'Order',
      resourceId: messageId,
      changes: { orderId, status: 'PROCESSING', itemCount: order.items.length },
    },
  });
}
