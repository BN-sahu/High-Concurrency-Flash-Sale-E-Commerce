import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Calculate session expiry date.
 * @param ttlMs Time-to-live in milliseconds (default: 7 days)
 */
export function getSessionExpiry(ttlMs: number = 7 * 24 * 60 * 60 * 1000): Date {
  return new Date(Date.now() + ttlMs);
}

/**
 * Cookie configuration for secure session cookies.
 */
export function getSecureCookieOptions(isProduction: boolean = process.env.NODE_ENV === 'production') {
  return {
    httpOnly: true,       // Prevent XSS access to cookie
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax' as const,  // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

/**
 * Cookie configuration for refresh token.
 */
export function getRefreshCookieOptions(isProduction: boolean = process.env.NODE_ENV === 'production') {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth/refresh',
  };
}
