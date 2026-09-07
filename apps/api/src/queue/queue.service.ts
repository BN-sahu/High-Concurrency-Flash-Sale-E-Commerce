import { Queue } from 'bullmq';
import { getRedis } from '../cache/redis.service';
import { createLogger } from '../observability/logger';
import {
  QUEUE_PAYMENT_PROCESSING,
  QUEUE_ORDER_FULFILLMENT,
  QUEUE_RESERVATION_EXPIRATION,
  QUEUE_WEBHOOK_RETRY,
} from '@flash-sale/shared';

const logger = createLogger('queue-service');

const queues: Map<string, Queue> = new Map();

/**
 * Get or create a BullMQ queue.
 * In production, this could be swapped for an SQS adapter.
 */
function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const redis = getRedis();
    const queue = new Queue(name, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    queues.set(name, queue);
    logger.info({ queue: name }, 'Queue initialized');
  }

  return queues.get(name)!;
}

/**
 * Enqueue a payment processing job.
 */
export async function enqueuePaymentProcessing(data: {
  orderId: string;
  userId: string;
  paymentIntentId: string;
}) {
  const queue = getQueue(QUEUE_PAYMENT_PROCESSING);
  const job = await queue.add('process-payment', data, {
    priority: 1, // High priority
  });
  logger.info({ jobId: job.id, orderId: data.orderId }, 'Payment processing job enqueued');
  return job.id;
}

/**
 * Enqueue an order fulfillment job.
 */
export async function enqueueOrderFulfillment(data: {
  orderId: string;
  userId: string;
}) {
  const queue = getQueue(QUEUE_ORDER_FULFILLMENT);
  const job = await queue.add('fulfill-order', data);
  logger.info({ jobId: job.id, orderId: data.orderId }, 'Order fulfillment job enqueued');
  return job.id;
}

/**
 * Enqueue a reservation expiration check.
 */
export async function enqueueReservationExpiration(data: {
  reservationId: string;
  inventoryId: string;
  quantity: number;
}) {
  const queue = getQueue(QUEUE_RESERVATION_EXPIRATION);
  const job = await queue.add('expire-reservation', data, {
    delay: 10 * 60 * 1000, // 10-minute delay
  });
  logger.info({ jobId: job.id, reservationId: data.reservationId }, 'Reservation expiration job enqueued');
  return job.id;
}

/**
 * Enqueue a webhook retry.
 */
export async function enqueueWebhookRetry(data: {
  eventId: string;
  event: any;
  attempt: number;
}) {
  const queue = getQueue(QUEUE_WEBHOOK_RETRY);
  const job = await queue.add('retry-webhook', data, {
    delay: data.attempt * 5000, // Increasing delay per attempt
  });
  logger.info({ jobId: job.id, eventId: data.eventId, attempt: data.attempt }, 'Webhook retry job enqueued');
  return job.id;
}

/**
 * Close all queues gracefully.
 */
export async function closeQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    logger.info({ queue: name }, 'Queue closed');
  }
  queues.clear();
}
