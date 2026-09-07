import { Router, Request, Response, NextFunction } from 'express';
import { getPrisma } from '@flash-sale/database';
import { hashPassword, verifyPassword, generateAccessToken, generateSessionToken, getSessionExpiry, getSecureCookieOptions } from '@flash-sale/auth';
import { loginSchema, registerSchema } from '@flash-sale/validation';
import { createLogger } from '../observability/logger';
import { InvalidCredentialsError, AppError } from '@flash-sale/shared';

const logger = createLogger('auth-controller');
const router = Router();

/**
 * POST /api/v1/auth/register
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, username, password } = parsed.data;
    const prisma = getPrisma();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({
        success: false,
        error: `A user with this ${field} already exists`,
      });
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, role: true },
    });

    // Create session
    const sessionToken = generateSessionToken();
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: getSessionExpiry(),
      },
    });

    // Generate JWT
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'CUSTOMER' | 'ADMIN',
      sessionId: session.id,
    });

    // Set secure cookie
    res.cookie('session', sessionToken, getSecureCookieOptions());

    logger.info({ userId: user.id, email }, 'User registered');

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;
    const prisma = getPrisma();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true, role: true, passwordHash: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new InvalidCredentialsError();
    }

    // Verify password
    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    // Create session
    const sessionToken = generateSessionToken();
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: getSessionExpiry(),
      },
    });

    // Generate JWT
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'CUSTOMER' | 'ADMIN',
      sessionId: session.id,
    });

    // Set secure cookie
    res.cookie('session', sessionToken, getSecureCookieOptions());

    logger.info({ userId: user.id }, 'User logged in');

    return res.status(200).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
        token: accessToken,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.session;
    if (sessionToken) {
      const prisma = getPrisma();
      await prisma.session.deleteMany({ where: { token: sessionToken } });
    }

    res.clearCookie('session');
    return res.status(200).json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const prisma = getPrisma();
    const userData = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    if (!userData) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, data: userData });
  } catch (error) {
    next(error);
  }
});

export const authRouter = router;
