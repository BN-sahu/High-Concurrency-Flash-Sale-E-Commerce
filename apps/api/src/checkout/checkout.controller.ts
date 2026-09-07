import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Razorpay from 'razorpay';
import { createReservation, transitionToPaymentPending } from './reservation.service';
import { getPrisma } from '@flash-sale/database';
import { createReservationSchema, createPaymentSchema } from '@flash-sale/validation';
import { createLogger } from '../observability/logger';
import { CHECKOUT_SESSION_TTL_MS } from '@flash-sale/shared';
import { AppError } from '@flash-sale/shared';

const logger = createLogger('checkout-controller');
const router = Router();

/**
 * POST /api/v1/checkout/reserve
 *
 * Reserve an inventory item with distributed lock + idempotency.
 * Returns checkout session ID for payment.
 */
router.post('/reserve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Validate input
    const parsed = createReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { productId, quantity, idempotencyKey: clientKey } = parsed.data;
    const idempotencyKey = clientKey || uuidv4();
    const userId = user.sub;

    // Create reservation (with distributed lock + atomic transaction)
    const reservation = await createReservation(userId, productId, quantity, idempotencyKey);

    // Create checkout session
    const prisma = getPrisma();
    const checkoutSession = await prisma.checkoutSession.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + CHECKOUT_SESSION_TTL_MS),
        status: 'ACTIVE',
      },
    });

    // Link reservation to checkout session
    await transitionToPaymentPending(reservation.id, checkoutSession.id);

    logger.info(
      { reservationId: reservation.id, checkoutSessionId: checkoutSession.id, userId },
      'Checkout reservation successful'
    );

    return res.status(200).json({
      success: true,
      checkoutSessionId: checkoutSession.id,
      reservationId: reservation.id,
      expiresIn: CHECKOUT_SESSION_TTL_MS,
      idempotencyKey,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/checkout/payment
 *
 * Create Stripe Payment Intent and initiate payment.
 */
router.post('/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { checkoutSessionId, idempotencyKey } = parsed.data;
    const prisma = getPrisma();

    // Verify checkout session
    const checkoutSession = await prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: {
        reservations: {
          include: { product: true },
        },
      },
    });

    if (!checkoutSession) {
      return res.status(404).json({ success: false, error: 'Checkout session not found' });
    }

    if (checkoutSession.userId !== user.sub) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (new Date() > checkoutSession.expiresAt) {
      return res.status(410).json({ success: false, error: 'Checkout session expired' });
    }

    // Calculate total (in INR, assuming product price is in INR)
    const total = checkoutSession.reservations.reduce((sum, res) => {
      return sum + Number(res.product.price) * res.quantity;
    }, 0);

    // Initialize Razorpay client
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    // Create Razorpay Order
    const options = {
      amount: Math.round(total * 100), // amount in smallest currency unit (paise)
      currency: 'INR',
      receipt: checkoutSessionId,
    };
    
    const rzpOrder = await razorpay.orders.create(options);
    const paymentIntentId = rzpOrder.id; // This is the razorpay order_id (e.g. order_IluGWxBm9U8zJ8)

    // Create order and payment records
    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = `FS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: user.sub,
          totalAmount: total,
          currency: 'INR',
          status: 'PENDING',
          items: {
            create: checkoutSession.reservations.map((res) => ({
              productId: res.productId,
              quantity: res.quantity,
              unitPrice: res.product.price,
            })),
          },
        },
      });

      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          userId: user.sub,
          amount: total,
          currency: 'INR',
          gatewayOrderId: paymentIntentId,
          idempotencyKey,
          status: 'PENDING',
        },
      });

      // Link checkout to order
      await tx.checkoutSession.update({
        where: { id: checkoutSessionId },
        data: {
          orderId: newOrder.id,
          gatewayOrderId: paymentIntentId,
        },
      });

      return newOrder;
    });

    logger.info(
      { orderId: order.id, paymentIntentId, total },
      'Payment intent created'
    );

    return res.status(200).json({
      success: true,
      razorpayOrderId: paymentIntentId,
      amount: Math.round(total * 100), // paise
      currency: 'INR',
      orderId: order.id,
      orderNumber: order.orderNumber,
      keyId: process.env.RAZORPAY_KEY_ID, // Frontend needs the key to initialize SDK
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    next(error);
  }
});

/**
 * GET /api/v1/checkout/status/:sessionId
 *
 * Check checkout session status.
 */
router.get('/status/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const prisma = getPrisma();
    const session = await prisma.checkoutSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        reservations: {
          include: { product: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.userId !== user.sub) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const isExpired = new Date() > session.expiresAt;

    return res.status(200).json({
      success: true,
      data: {
        id: session.id,
        status: isExpired ? 'EXPIRED' : session.status,
        expiresAt: session.expiresAt.toISOString(),
        reservations: session.reservations.map((r) => ({
          id: r.id,
          productId: r.productId,
          quantity: r.quantity,
          state: r.state,
          product: {
            name: r.product.name,
            price: Number(r.product.price),
            imageUrl: r.product.imageUrl,
          }
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export const checkoutRouter = router;
