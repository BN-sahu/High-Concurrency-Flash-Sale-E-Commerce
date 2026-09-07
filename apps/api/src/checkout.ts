import { Request, Response } from 'express';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { PrismaClient } from '@flash-sale/database';
import amqplib from 'amqplib';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 200,
  automaticExtensionThreshold: 500,
});

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://root:password@localhost:5672';

let rabbitChannel: amqplib.Channel;

async function getRabbitChannel() {
  if (!rabbitChannel) {
    const conn = await amqplib.connect(RABBITMQ_URL);
    rabbitChannel = await conn.createChannel();
    await rabbitChannel.assertQueue('checkout_queue', { durable: true });
  }
  return rabbitChannel;
}

export const reserveInventory = async (req: Request, res: Response) => {
  const { productId, quantity } = req.body;
  
  // Basic validation
  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid product or quantity' });
  }

  // Use a hardcoded user ID for now, later get from session cookie
  const userId = 'user-123'; // req.user.id

  const lockKey = `inventory_lock:${productId}`;
  const lockTTL = 5000; // 5 seconds

  let lock;
  try {
    // 1. Acquire Distributed Redis Lock
    lock = await redlock.acquire([lockKey], lockTTL);

    // 2. PostgreSQL Transaction
    const reservation = await prisma.$transaction(async (tx) => {
      // a. Check inventory
      const inventory = await tx.inventory.findFirst({
        where: { productId },
      });

      if (!inventory) {
        throw new Error('Inventory not found');
      }

      if (inventory.availableStock < quantity) {
        throw new Error('Insufficient stock');
      }

      // b. Create Reservation
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiration

      const newReservation = await tx.reservation.create({
        data: {
          userId,
          inventoryId: inventory.id,
          quantity,
          status: 'RESERVED',
          expiresAt,
        }
      });

      // c. Update Inventory
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          availableStock: { decrement: quantity },
          reservedStock: { increment: quantity },
        }
      });

      return newReservation;
    });

    // 3. Return reservation details to client (creates checkout session)
    return res.status(201).json({ 
      success: true, 
      reservationId: reservation.id, 
      expiresAt: reservation.expiresAt 
    });

  } catch (error: any) {
    console.error('Reservation failed:', error);
    if (error.message === 'Insufficient stock') {
      return res.status(409).json({ error: 'Item sold out or insufficient stock' });
    }
    return res.status(500).json({ error: 'Failed to reserve inventory' });
  } finally {
    // 4. Release Redis Lock
    if (lock) {
      try {
        await lock.release();
      } catch (e) {
        console.error('Failed to release lock', e);
      }
    }
  }
};

export const confirmCheckout = async (req: Request, res: Response) => {
  const { reservationId, paymentIntentId, idempotencyKey } = req.body;
  const userId = 'user-123';

  if (!reservationId || !paymentIntentId || !idempotencyKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { inventory: true }
    });

    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    if (reservation.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    if (reservation.status !== 'RESERVED') return res.status(400).json({ error: 'Invalid reservation status' });
    
    if (new Date() > reservation.expiresAt) {
       // Ideally a cron or Redis expiry listener handles this, but we can do a lazy check here too
       return res.status(400).json({ error: 'Reservation expired' });
    }

    // Process using Transactional Outbox pattern conceptually, or just direct to RabbitMQ
    // We update status to PAYMENT_PENDING
    
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'PAYMENT_PENDING' }
    });

    // Enqueue message to Worker for processing the Stripe verification and Order creation
    const channel = await getRabbitChannel();
    const payload = JSON.stringify({
      reservationId,
      paymentIntentId,
      idempotencyKey,
      userId
    });

    channel.sendToQueue('checkout_queue', Buffer.from(payload), { persistent: true });

    return res.status(202).json({ success: true, message: 'Checkout processing' });

  } catch (error) {
    console.error('Checkout confirmation failed', error);
    return res.status(500).json({ error: 'Failed to process checkout' });
  }
};
