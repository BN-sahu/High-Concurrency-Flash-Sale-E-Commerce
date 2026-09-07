import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../observability/logger';
import { AppError } from '@flash-sale/shared';

const logger = createLogger('error-handler');

/**
 * Global error handler middleware.
 * Catches all unhandled errors, logs them, and returns a structured response.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // AppError instances are operational (expected) errors
  if (err instanceof AppError) {
    logger.warn(
      {
        statusCode: err.statusCode,
        code: err.code,
        path: req.path,
        method: req.method,
      },
      err.message
    );

    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...('details' in err ? { details: (err as any).details } : {}),
    });
  }

  // Prisma errors
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A record with this value already exists',
        code: 'DUPLICATE_ENTRY',
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
      });
    }
  }

  // Unexpected errors
  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      body: req.body,
    },
    'Unhandled error'
  );

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}
