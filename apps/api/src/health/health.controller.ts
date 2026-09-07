import { Router, Request, Response } from 'express';
import { getPrisma } from '@flash-sale/database';
import { redisHealthCheck } from '../cache/redis.service';
import { createLogger } from '../observability/logger';

const logger = createLogger('health');
const router = Router();

const startTime = Date.now();

/**
 * GET /health
 *
 * Liveness probe — is the process running?
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 *
 * Readiness probe — are all dependencies connected?
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const prisma = getPrisma();

  const [postgresOk, redisOk] = await Promise.all([
    prisma.healthCheck().catch(() => false),
    redisHealthCheck().catch(() => false),
  ]);

  let mongoOk = false;
  try {
    const mongoose = require('mongoose');
    mongoOk = mongoose.connection.readyState >= 1;
  } catch {
    mongoOk = false;
  }

  const allOk = postgresOk && redisOk;

  const status = allOk ? 'ok' : 'degraded';
  const statusCode = allOk ? 200 : 503;

  res.status(statusCode).json({
    status,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    services: {
      postgres: postgresOk,
      redis: redisOk,
      mongo: mongoOk,
    },
  });
});

export const healthRouter = router;
