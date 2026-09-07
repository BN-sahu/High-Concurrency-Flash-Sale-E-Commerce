import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectMongo } from '@flash-sale/database';
import { getPrisma } from '@flash-sale/database';
import { createLogger } from './observability/logger';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { healthRouter } from './health/health.controller';
import { authRouter } from './auth/auth.controller';
import { productsRouter } from './products/products.controller';
import { checkoutRouter } from './checkout/checkout.controller';
import { ordersRouter } from './orders/orders.controller';
import { adminRouter } from './admin/admin.controller';
import { webhookRouter } from './payments/webhook.controller';
import { closeRedis } from './cache/redis.service';
import { closeQueues } from './queue/queue.service';
import { expireReservations } from './checkout/reservation.service';

dotenv.config();

const logger = createLogger('server');
const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// ============ Security Middleware ============
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  maxAge: 86400,
}));

// ============ Body Parsing ============
// Webhook route needs raw body for Razorpay signature verification
app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// ============ Rate Limiting ============
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 checkout attempts per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.sub || req.ip || 'anonymous',
  message: { success: false, error: 'Checkout rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts', code: 'RATE_LIMIT_EXCEEDED' },
});

app.use('/api/', generalLimiter);

// ============ Request Logging ============
app.use(requestLogger);

// ============ Authentication ============
app.use(authMiddleware);

// ============ Health Endpoints ============
app.use('/', healthRouter);

// ============ API Routes ============
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/checkout', checkoutLimiter, checkoutRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/webhooks', webhookRouter);

// ============ API Documentation ============
app.get('/api/docs', (_req, res) => {
  res.json({
    title: 'Flash Sale Platform API',
    version: '1.0.0',
    description: 'High-concurrency flash sale e-commerce platform',
    endpoints: {
      auth: {
        'POST /api/v1/auth/register': 'Register a new user',
        'POST /api/v1/auth/login': 'Login',
        'POST /api/v1/auth/logout': 'Logout',
        'GET /api/v1/auth/me': 'Get current user',
      },
      products: {
        'GET /api/v1/products': 'List products (paginated)',
        'GET /api/v1/products/:id': 'Get product details',
        'GET /api/v1/products/flash-sales/active': 'Active flash sales',
      },
      checkout: {
        'POST /api/v1/checkout/reserve': 'Reserve inventory (distributed lock)',
        'POST /api/v1/checkout/payment': 'Create payment intent',
        'GET /api/v1/checkout/status/:sessionId': 'Check checkout status',
      },
      orders: {
        'GET /api/v1/orders': 'List user orders',
        'GET /api/v1/orders/:id': 'Get order details',
      },
      admin: {
        'GET /api/v1/admin/dashboard': 'Dashboard analytics',
        'POST /api/v1/admin/products': 'Create product',
        'PATCH /api/v1/admin/products/:id': 'Update product',
        'PATCH /api/v1/admin/inventory/:id': 'Update inventory',
        'GET /api/v1/admin/orders': 'List all orders',
      },
      webhooks: {
        'POST /api/v1/webhooks/razorpay': 'Razorpay webhook handler',
      },
      health: {
        'GET /health': 'Liveness probe',
        'GET /ready': 'Readiness probe',
      },
    },
  });
});

// ============ 404 & Error Handling ============
app.use(notFoundHandler);
app.use(errorHandler);

// ============ Reservation Expiration Scheduler ============
let expirationInterval: ReturnType<typeof setInterval>;

function startReservationExpiration() {
  // Run every 30 seconds
  expirationInterval = setInterval(async () => {
    try {
      const expired = await expireReservations();
      if (expired > 0) {
        logger.info({ expired }, 'Expired reservations processed');
      }
    } catch (error) {
      logger.error({ err: error }, 'Reservation expiration error');
    }
  }, 30 * 1000);

  logger.info('Reservation expiration scheduler started (30s interval)');
}

// ============ Bootstrap ============
async function bootstrap() {
  try {
    // Connect to PostgreSQL
    const prisma = getPrisma();
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    // Connect to MongoDB (non-critical)
    if (process.env.MONGO_URI) {
      try {
        await connectMongo(process.env.MONGO_URI);
        logger.info('Connected to MongoDB');
      } catch (error) {
        logger.warn({ err: error }, 'MongoDB connection failed (non-critical)');
      }
    }

    // Start reservation expiration scheduler
    startReservationExpiration();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'API server started');
    });

    // ============ Graceful Shutdown ============
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        // Stop reservation expiration
        if (expirationInterval) {
          clearInterval(expirationInterval);
        }

        // Close all connections
        try {
          await prisma.$disconnect();
          logger.info('PostgreSQL disconnected');
        } catch (e) {
          logger.error({ err: e }, 'PostgreSQL disconnect error');
        }

        try {
          await closeRedis();
          logger.info('Redis disconnected');
        } catch (e) {
          logger.error({ err: e }, 'Redis disconnect error');
        }

        try {
          await closeQueues();
          logger.info('Queues closed');
        } catch (e) {
          logger.error({ err: e }, 'Queue close error');
        }

        logger.info('Graceful shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
