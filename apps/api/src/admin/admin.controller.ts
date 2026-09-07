import { Router, Request, Response, NextFunction } from 'express';
import { getPrisma } from '@flash-sale/database';
import { ProductCatalog } from '@flash-sale/database';
import { createProductSchema, updateProductSchema, updateInventorySchema, paginationSchema } from '@flash-sale/validation';
import { createLogger } from '../observability/logger';

const logger = createLogger('admin-controller');
const router = Router();

/**
 * Admin guard middleware — requires ADMIN role.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

router.use(requireAdmin);

/**
 * POST /api/v1/admin/products
 *
 * Create a new product with inventory.
 */
router.post('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, description, price, currency, imageUrl, inventory, category, tags } = parsed.data;
    const prisma = getPrisma();

    // Create product with inventory in a single transaction
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          description,
          price,
          currency: currency || 'USD',
          imageUrl,
          status: 'ACTIVE',
          inventory: {
            create: {
              totalQuantity: inventory.quantity,
              availableQuantity: inventory.quantity,
              reservedQuantity: 0,
              soldQuantity: 0,
            },
          },
        },
        include: { inventory: true },
      });

      // Create in MongoDB catalog
      try {
        await ProductCatalog.create({
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description,
          price,
          currency: currency || 'USD',
          inventoryId: newProduct.inventory!.id,
          productId: newProduct.id,
          images: imageUrl ? [{ url: imageUrl, alt: name, isPrimary: true }] : [],
          category: category || 'general',
          tags: tags || [],
          status: 'active',
          isVisible: true,
        });
      } catch (mongoError) {
        logger.warn({ err: mongoError }, 'Failed to create MongoDB catalog entry');
        // Non-critical: product exists in PG
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: (req as any).user.sub,
          action: 'product.created',
          resource: 'Product',
          resourceId: newProduct.id,
          changes: { name, price, quantity: inventory.quantity },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      return newProduct;
    });

    logger.info({ productId: product.id, name }, 'Product created');

    return res.status(201).json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        inventoryId: product.inventory?.id,
        availableQuantity: product.inventory?.availableQuantity,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/admin/products/:id
 */
router.patch('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const prisma = getPrisma();
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    logger.info({ productId: product.id }, 'Product updated');

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/admin/inventory/:id
 */
router.patch('/inventory/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const prisma = getPrisma();
    const inventory = await prisma.inventory.update({
      where: { id: req.params.id },
      data: {
        totalQuantity: parsed.data.totalQuantity,
        availableQuantity: parsed.data.availableQuantity,
      },
    });

    logger.info({ inventoryId: inventory.id }, 'Inventory updated');

    return res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();

    const [
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      totalRevenue,
      activeReservations,
      totalUsers,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'CONFIRMED' } }),
      prisma.payment.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
      prisma.reservation.count({
        where: { state: { in: ['RESERVED', 'PAYMENT_PENDING'] } },
      }),
      prisma.user.count(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products: { total: totalProducts, active: activeProducts },
        orders: { total: totalOrders, pending: pendingOrders, confirmed: confirmedOrders },
        revenue: { total: Number(totalRevenue._sum.amount || 0) },
        reservations: { active: activeReservations },
        users: { total: totalUsers },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/orders
 */
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const skip = (page - 1) * limit;

    const prisma = getPrisma();
    const statusFilter = req.query.status as string;
    const where = statusFilter ? { status: statusFilter as any } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { email: true, username: true } },
          items: { include: { product: { select: { name: true } } } },
          payment: { select: { status: true, amount: true } },
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
        user: o.user,
        itemCount: o.items.length,
        payment: o.payment ? { status: o.payment.status, amount: Number(o.payment.amount) } : null,
        createdAt: o.createdAt.toISOString(),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

export const adminRouter = router;
