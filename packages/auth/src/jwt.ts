import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;     // User ID
  email: string;
  username: string;
  role: 'CUSTOMER' | 'ADMIN';
  sessionId: string;
}

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

/**
 * Generate a JWT access token.
 */
export function generateAccessToken(
  payload: TokenPayload,
  secret?: string,
  expiresIn?: string
): string {
  const jwtSecret = secret || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const options: SignOptions = {
    expiresIn: expiresIn || DEFAULT_ACCESS_EXPIRY,
    algorithm: 'HS256',
    issuer: 'flash-sale-platform',
    audience: 'flash-sale-api',
  };

  return jwt.sign(payload, jwtSecret, options);
}

/**
 * Generate a JWT refresh token.
 */
export function generateRefreshToken(
  payload: Pick<TokenPayload, 'sub' | 'sessionId'>,
  secret?: string,
  expiresIn?: string
): string {
  const jwtSecret = secret || process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const options: SignOptions = {
    expiresIn: expiresIn || DEFAULT_REFRESH_EXPIRY,
    algorithm: 'HS256',
    issuer: 'flash-sale-platform',
    audience: 'flash-sale-api',
  };

  return jwt.sign({ sub: payload.sub, sessionId: payload.sessionId, type: 'refresh' }, jwtSecret, options);
}

/**
 * Verify and decode a JWT token.
 * Returns the decoded payload or throws if invalid/expired.
 */
export function verifyToken(
  token: string,
  secret?: string
): TokenPayload & JwtPayload {
  const jwtSecret = secret || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'flash-sale-platform',
    audience: 'flash-sale-api',
  }) as TokenPayload & JwtPayload;
}

/**
 * Decode a token without verification (useful for reading expired tokens).
 */
export function decodeToken(token: string): TokenPayload | null {
  const decoded = jwt.decode(token);
  return decoded as TokenPayload | null;
}
