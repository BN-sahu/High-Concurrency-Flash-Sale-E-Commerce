import { Router, Request, Response, NextFunction } from 'express';
import { getPrisma } from '@flash-sale/database';
import { createLogger } from '../observability/logger';
import { paginationSchema } from '@flash-sale/validation';

const logger = createLogger('orders-controller');
const router = Router();

/**
 * GET /api/v1/orders
 *
 * List orders for the authenticated user.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const parsed = paginationSchema.safeParse(req.query);
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const skip = (page - 1) * limit;

    const prisma = getPrisma();
    const where = { userId: user.sub };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: { name: true, imageUrl: true },
              },
            },
          },
          payment: {
            select: { status: true, confirmedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        itemCount: o.items.length,
        items: o.items.map((i) => ({
          productId: i.productId,
          productName: i.product.name,
          imageUrl: i.product.imageUrl,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        payment: o.payment
          ? { status: o.payment.status, confirmedAt: o.payment.confirmedAt?.toISOString() }
          : null,
        createdAt: o.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/orders/:id
 *
 * Get order details.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, imageUrl: true, description: true },
            },
          },
        },
        payment: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.userId !== user.sub && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        shippingAddress: order.shippingAddress,
        items: order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          imageUrl: i.product.imageUrl,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        payment: order.payment
          ? {
              id: order.payment.id,
              status: order.payment.status,
              amount: Number(order.payment.amount),
              confirmedAt: order.payment.confirmedAt?.toISOString(),
              failedAt: order.payment.failedAt?.toISOString(),
              failureReason: order.payment.failureReason,
            }
          : null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export const ordersRouter = router;
