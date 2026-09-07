import { Router, Request, Response, NextFunction } from 'express';
import { getPrisma } from '@flash-sale/database';
import { ProductCatalog } from '@flash-sale/database';
import { createLogger } from '../observability/logger';
import { paginationSchema } from '@flash-sale/validation';

const logger = createLogger('products-controller');
const router = Router();

/**
 * GET /api/v1/products
 *
 * List products from MongoDB catalog with availability from PostgreSQL.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    const { page, limit, sortBy, sortOrder } = parsed.success
      ? parsed.data
      : { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' as const };

    const skip = (page - 1) * limit;

    // Try MongoDB catalog first, fall back to PostgreSQL
    let products: any[] = [];
    let total = 0;

    try {
      const mongoQuery: any = { status: 'active', isVisible: true };
      if (req.query.category) mongoQuery.category = req.query.category;
      if (req.query.flashSale === 'true') mongoQuery['flashSale.isFlashSale'] = true;

      total = await ProductCatalog.countDocuments(mongoQuery);
      const mongoProducts = await ProductCatalog.find(mongoQuery)
        .sort({ [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      products = mongoProducts.map((p: any) => ({
        ...p,
        id: p.productId,
        imageUrl: p.images?.[0]?.url || p.imageUrl,
      }));
    } catch {
      // MongoDB not available, fall back to PostgreSQL
      const prisma = getPrisma();
      const where: any = { status: 'ACTIVE' };

      total = await prisma.product.count({ where });
      const pgProducts = await prisma.product.findMany({
        where,
        include: { inventory: { select: { availableQuantity: true, totalQuantity: true } } },
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder },
      });

      products = pgProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        currency: p.currency,
        imageUrl: p.imageUrl,
        status: p.status.toLowerCase(),
        availableQuantity: p.inventory?.availableQuantity ?? 0,
        totalQuantity: p.inventory?.totalQuantity ?? 0,
      }));
    }

    return res.status(200).json({
      success: true,
      data: products,
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
 * GET /api/v1/products/:id
 *
 * Get product details with inventory availability.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        inventory: {
          select: {
            id: true,
            availableQuantity: true,
            totalQuantity: true,
            soldQuantity: true,
            reservedQuantity: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Try to enrich from MongoDB catalog
    let catalogData: any = null;
    try {
      catalogData = await ProductCatalog.findOne({ productId: product.id }).lean();
    } catch {
      // MongoDB not available
    }

    return res.status(200).json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        currency: product.currency,
        imageUrl: product.imageUrl,
        status: product.status,
        inventory: product.inventory
          ? {
              available: product.inventory.availableQuantity,
              total: product.inventory.totalQuantity,
              sold: product.inventory.soldQuantity,
              reserved: product.inventory.reservedQuantity,
            }
          : null,
        // MongoDB enrichments
        images: catalogData?.images || [],
        specifications: catalogData?.specifications || [],
        ratings: catalogData?.ratings || { average: 0, count: 0 },
        category: catalogData?.category || '',
        tags: catalogData?.tags || [],
        flashSale: catalogData?.flashSale || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/products/flash-sales/active
 *
 * Get currently active flash sale products.
 */
router.get('/flash-sales/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    // Try MongoDB first
    try {
      const flashSales = await ProductCatalog.find({
        'flashSale.isFlashSale': true,
        'flashSale.startTime': { $lte: now },
        'flashSale.endTime': { $gte: now },
        status: 'active',
      }).lean();

      return res.status(200).json({ 
        success: true, 
        data: flashSales.map((p: any) => ({ ...p, id: p.productId, imageUrl: p.images?.[0]?.url || p.imageUrl })) 
      });
    } catch {
      // Fallback: return all active products from PG
      const prisma = getPrisma();
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        include: { inventory: { select: { availableQuantity: true } } },
        take: 20,
      });

      return res.status(200).json({
        success: true,
        data: products.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          imageUrl: p.imageUrl,
          availableQuantity: p.inventory?.availableQuantity ?? 0,
        })),
      });
    }
  } catch (error) {
    next(error);
  }
});

export const productsRouter = router;
