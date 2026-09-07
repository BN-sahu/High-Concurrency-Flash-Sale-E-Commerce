import { randomBytes } from 'crypto';

/**
 * Generate a unique order number.
 * Format: FS-YYYYMMDD-XXXXXX (e.g., FS-20240115-A3B9F2)
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `FS-${dateStr}-${suffix}`;
}

/**
 * Format amount in cents to currency string.
 */
export function formatCurrency(amountCents: number, currency: string = 'USD'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Generate a cryptographically secure idempotency key.
 */
export function generateIdempotencyKey(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Sleep utility for retry logic.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter for retry delays.
 */
export function exponentialBackoff(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * delay * 0.1;
  return delay + jitter;
}

/**
 * Calculate remaining time in milliseconds.
 */
export function timeRemaining(expiresAt: Date | string): number {
  const expiry = new Date(expiresAt).getTime();
  return Math.max(0, expiry - Date.now());
}

/**
 * Check if a date/timestamp has expired.
 */
export function isExpired(expiresAt: Date | string): boolean {
  return timeRemaining(expiresAt) <= 0;
}

/**
 * Sanitize user input to prevent XSS.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Mask sensitive data for logging.
 */
export function maskSensitive(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) {
    return '****';
  }
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

/**
 * Parse pagination parameters with defaults and bounds.
 */
export function parsePagination(
  page?: number | string,
  limit?: number | string,
  defaultLimit: number = 20,
  maxLimit: number = 100
): { page: number; limit: number; skip: number } {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, Number(limit) || defaultLimit));
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
}
