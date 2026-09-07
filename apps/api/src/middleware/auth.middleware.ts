import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@flash-sale/auth';
import { createLogger } from '../observability/logger';

const logger = createLogger('auth-middleware');

/**
 * JWT authentication middleware.
 * Extracts and verifies JWT from Authorization header or session cookie.
 * Attaches user payload to req.user.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth for public routes
  const publicPaths = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/products',
    '/health',
    '/ready',
    '/api/docs',
  ];

  const isPublic = publicPaths.some(
    (path) => req.path === path || req.path.startsWith(path)
  );

  // Extract token
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token && req.cookies?.session) {
    // For cookie-based auth, we'd look up the session token
    // For now, we check for a JWT in a different cookie
    token = req.cookies?.jwt;
  }

  if (!token) {
    if (isPublic) {
      return next();
    }
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch (error: any) {
    logger.debug({ err: error }, 'Token verification failed');

    if (isPublic) {
      return next();
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }

    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Optional auth middleware — sets user if token present, but doesn't require it.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    (req as any).user = payload;
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}
