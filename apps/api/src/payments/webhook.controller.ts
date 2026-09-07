import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getPrisma } from '@flash-sale/database';
import { transitionToSold } from '../checkout/reservation.service';
import { enqueueOrderFulfillment } from '../queue/queue.service';
import { createLogger } from '../observability/logger';

const logger = createLogger('webhook-controller');
const router = Router();

/**
 * POST /api/v1/webhooks/razorpay
 *
 * Razorpay webhook handler with signature verification and idempotent processing.
 * IMPORTANT: This route must use raw body parser (not JSON).
 */
router.post('/razorpay', async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['x-razorpay-signature'] as string;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const rawBody = (req as any).rawBody || req.body;
  let event: any;

  if (webhookSecret && sig) {
    try {
      // Razorpay expects the raw string body to validate HMAC SHA256
      const isValid = Razorpay.validateWebhookSignature(
        rawBody.toString(),
        sig,
        webhookSecret
      );
      if (!isValid) {
        throw new Error('Invalid signature');
      }
      event = JSON.parse(rawBody.toString());
    } catch (err: any) {
      logger.error({ err }, 'Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    // Development mode: accept without verification if no secret provided
    event = JSON.parse(rawBody.toString());
    logger.warn('Webhook received without signature verification (dev mode)');
  }

  // Razorpay doesn't have a unique event ID by default, we can use a combination or the header if they send one.
  // Using x-razorpay-event-id header
  const eventId = (req.headers['x-razorpay-event-id'] as string) || `evt_${Date.now()}_${Math.random()}`;
  const prisma = getPrisma();

  // Idempotent webhook processing: check if already processed
  const alreadyProcessed = await prisma.auditLog.findFirst({
    where: {
      action: 'razorpay.webhook',
      resourceId: eventId,
    },
  });

  if (alreadyProcessed) {
    logger.warn({ eventId }, 'Duplicate webhook, ignoring');
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    const paymentEntity = event.payload?.payment?.entity;

    switch (event.event) {
      case 'payment.captured': {
        await handlePaymentSuccess(paymentEntity, eventId);
        break;
      }

      case 'payment.failed': {
        await handlePaymentFailure(paymentEntity, eventId);
        break;
      }

      default:
        logger.info({ eventType: event.event }, 'Unhandled webhook event type');
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error({ eventId, err: error }, 'Webhook processing error');
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handlePaymentSuccess(paymentEntity: any, webhookId: string) {
  const prisma = getPrisma();
  const gatewayOrderId = paymentEntity.order_id;
  const gatewayPaymentId = paymentEntity.id;

  if (!gatewayOrderId) {
    logger.warn('Payment captured event missing order_id');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { gatewayOrderId },
    });

    if (!payment) {
      logger.warn({ gatewayOrderId }, 'Payment not found for order');
      return;
    }

    if (payment.status === 'CONFIRMED') {
      logger.info({ gatewayOrderId }, 'Payment already confirmed');
      return;
    }

    // Update payment status
    await tx.payment.update({
      where: { id: payment.id },
      data: { 
        status: 'CONFIRMED', 
        confirmedAt: new Date(),
        gatewayPaymentId 
      },
    });

    // Update order status
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: 'CONFIRMED' },
    });

    // Find and transition reservations to SOLD
    const reservations = await tx.reservation.findMany({
      where: { paymentId: payment.id },
    });

    for (const res of reservations) {
      await tx.reservation.update({
        where: { id: res.id },
        data: { state: 'SOLD' },
      });

      // Move from reserved to sold in inventory
      await tx.inventory.update({
        where: { id: res.inventoryId },
        data: {
          reservedQuantity: { decrement: res.quantity },
          soldQuantity: { increment: res.quantity },
        },
      });
    }

    // Publish outbox event
    await tx.outboxEvent.create({
      data: {
        eventType: 'payment.confirmed',
        aggregateId: payment.id,
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: payment.amount.toString(),
        },
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: payment.userId,
        action: 'razorpay.webhook',
        resource: 'Payment',
        resourceId: webhookId,
        changes: { gatewayOrderId, gatewayPaymentId, status: 'CONFIRMED' },
      },
    });
  });

  // Queue order fulfillment (outside transaction)
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId },
  });
  if (payment) {
    await enqueueOrderFulfillment({
      orderId: payment.orderId,
      userId: payment.userId,
    });
  }

  logger.info({ gatewayOrderId }, 'Payment confirmed via webhook');
}

async function handlePaymentFailure(paymentEntity: any, webhookId: string) {
  const prisma = getPrisma();
  const gatewayOrderId = paymentEntity.order_id;
  const failureReason = paymentEntity.error_description || 'Unknown error';

  if (!gatewayOrderId) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { gatewayOrderId },
    });

    if (!payment) {
      logger.warn({ gatewayOrderId }, 'Payment not found for failed order');
      return;
    }

    // Update payment
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failedAt: new Date(), failureReason },
    });

    // Revert reservations and return inventory
    const reservations = await tx.reservation.findMany({
      where: { paymentId: payment.id },
    });

    for (const res of reservations) {
      await tx.reservation.update({
        where: { id: res.id },
        data: { state: 'FAILED' },
      });

      await tx.inventory.update({
        where: { id: res.inventoryId },
        data: {
          availableQuantity: { increment: res.quantity },
          reservedQuantity: { decrement: res.quantity },
        },
      });
    }

    // Audit
    await tx.auditLog.create({
      data: {
        userId: payment.userId,
        action: 'razorpay.webhook',
        resource: 'Payment',
        resourceId: webhookId,
        changes: { gatewayOrderId, status: 'FAILED', failureReason },
      },
    });
  });

  logger.warn({ gatewayOrderId, failureReason }, 'Payment failed via webhook');
}

export const webhookRouter = router;
