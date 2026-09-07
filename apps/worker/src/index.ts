import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { getPrisma } from '@flash-sale/database';
import {
  QUEUE_PAYMENT_PROCESSING,
  QUEUE_ORDER_FULFILLMENT,
  QUEUE_RESERVATION_EXPIRATION,
  QUEUE_WEBHOOK_RETRY,
} from '@flash-sale/shared';
import { processPaymentJob } from './workers/payment.worker';
import { processOrderFulfillmentJob } from './workers/order-fulfillment.worker';
import { processReservationExpirationJob } from './workers/reservation-expiration.worker';
import { processReconciliationJob } from './workers/reconciliation.worker';

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
  base: { service: 'flash-sale-worker', env: process.env.NODE_ENV || 'development' },
});

const workers: Worker[] = [];

async function bootstrap() {
  try {
    // Connect to PostgreSQL
    const prisma = getPrisma();
    await prisma.$connect();
    logger.info('Worker connected to PostgreSQL');

    // Redis connection for BullMQ
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });

    logger.info('Worker connected to Redis');

    // ============ Payment Processing Worker ============
    const paymentWorker = new Worker(
      QUEUE_PAYMENT_PROCESSING,
      async (job) => {
        logger.info({ jobId: job.id, data: job.data }, 'Processing payment job');
        await processPaymentJob(job.data, job.id || 'unknown');
      },
      {
        connection: redis,
        concurrency: 5,
        limiter: { max: 10, duration: 1000 },
      }
    );

    paymentWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Payment job completed');
    });

    paymentWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Payment job failed');
    });

    workers.push(paymentWorker);

    // ============ Order Fulfillment Worker ============
    const fulfillmentWorker = new Worker(
      QUEUE_ORDER_FULFILLMENT,
      async (job) => {
        logger.info({ jobId: job.id, data: job.data }, 'Processing order fulfillment job');
        await processOrderFulfillmentJob(job.data, job.id || 'unknown');
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    fulfillmentWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Order fulfillment job completed');
    });

    fulfillmentWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Order fulfillment job failed');
    });

    workers.push(fulfillmentWorker);

    // ============ Reservation Expiration Worker ============
    const expirationWorker = new Worker(
      QUEUE_RESERVATION_EXPIRATION,
      async (job) => {
        logger.info({ jobId: job.id, data: job.data }, 'Processing reservation expiration');
        await processReservationExpirationJob(job.data, job.id || 'unknown');
      },
      {
        connection: redis,
        concurrency: 10,
      }
    );

    expirationWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Reservation expiration job completed');
    });

    workers.push(expirationWorker);

    // ============ Webhook Retry Worker ============
    const webhookRetryWorker = new Worker(
      QUEUE_WEBHOOK_RETRY,
      async (job) => {
        logger.info({ jobId: job.id, data: job.data }, 'Retrying webhook');
        // Reprocess the webhook event
        // In production, call the webhook handler again
      },
      {
        connection: redis,
        concurrency: 3,
      }
    );

    workers.push(webhookRetryWorker);

    // ============ Periodic Reconciliation ============
    setInterval(async () => {
      try {
        await processReconciliationJob();
      } catch (err) {
        logger.error({ err }, 'Reconciliation error');
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    logger.info(`Worker started with ${workers.length} queue consumers`);

    // ============ Graceful Shutdown ============
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Worker shutdown signal received');

      for (const worker of workers) {
        await worker.close();
      }

      await prisma.$disconnect();
      await redis.quit();

      logger.info('Worker shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ err: error }, 'Failed to start worker');
    process.exit(1);
  }
}

bootstrap();
