// ============ Timing Constants ============

/** Reservation TTL in milliseconds (10 minutes) */
export const RESERVATION_TTL_MS = 10 * 60 * 1000;

/** Payment window TTL in milliseconds (5 minutes) */
export const PAYMENT_WINDOW_TTL_MS = 5 * 60 * 1000;

/** Checkout session TTL in milliseconds (10 minutes) */
export const CHECKOUT_SESSION_TTL_MS = 10 * 60 * 1000;

/** Idempotency key TTL in milliseconds (24 hours) */
export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

/** Session TTL in milliseconds (7 days) */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** JWT access token expiry (15 minutes) */
export const JWT_ACCESS_TOKEN_EXPIRY = '15m';

/** JWT refresh token expiry (7 days) */
export const JWT_REFRESH_TOKEN_EXPIRY = '7d';

// ============ Rate Limits ============

/** Checkout rate limit: max requests per window per user */
export const CHECKOUT_RATE_LIMIT_MAX = 5;

/** Checkout rate limit window in milliseconds (1 minute) */
export const CHECKOUT_RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Auth rate limit: max login attempts per window */
export const AUTH_RATE_LIMIT_MAX = 10;

/** Auth rate limit window in milliseconds (15 minutes) */
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** General API rate limit per window */
export const API_RATE_LIMIT_MAX = 100;

/** General API rate limit window in milliseconds (1 minute) */
export const API_RATE_LIMIT_WINDOW_MS = 60 * 1000;

// ============ Pagination ============

/** Default page size */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size */
export const MAX_PAGE_SIZE = 100;

// ============ Redis Keys ============

/** Redis key prefix for distributed locks */
export const REDIS_LOCK_PREFIX = 'inventory:lock:';

/** Redis key prefix for rate limiting */
export const REDIS_RATE_LIMIT_PREFIX = 'rate:';

/** Redis key prefix for session cache */
export const REDIS_SESSION_PREFIX = 'session:';

/** Redis key prefix for inventory cache */
export const REDIS_INVENTORY_CACHE_PREFIX = 'inv:';

// ============ Queue Names ============

export const QUEUE_CHECKOUT_PROCESSING = 'checkout-processing';
export const QUEUE_PAYMENT_PROCESSING = 'payment-processing';
export const QUEUE_ORDER_FULFILLMENT = 'order-fulfillment';
export const QUEUE_RESERVATION_EXPIRATION = 'reservation-expiration';
export const QUEUE_WEBHOOK_RETRY = 'webhook-retry';
export const QUEUE_RECONCILIATION = 'reconciliation';

// ============ Event Types ============

export const EVENT_RESERVATION_CREATED = 'reservation.created';
export const EVENT_RESERVATION_EXPIRED = 'reservation.expired';
export const EVENT_PAYMENT_CONFIRMED = 'payment.confirmed';
export const EVENT_PAYMENT_FAILED = 'payment.failed';
export const EVENT_ORDER_CREATED = 'order.created';
export const EVENT_ORDER_CONFIRMED = 'order.confirmed';

// ============ Distributed Lock ============

/** Default lock TTL in milliseconds */
export const LOCK_TTL_MS = 5000;

/** Lock retry count */
export const LOCK_RETRY_COUNT = 3;

/** Lock retry delay in milliseconds */
export const LOCK_RETRY_DELAY_MS = 200;

/** Lock retry jitter in milliseconds */
export const LOCK_RETRY_JITTER_MS = 200;

// ============ Inventory ============

/** Default max quantity per user per flash sale */
export const MAX_QUANTITY_PER_USER = 1;

// ============ HTTP Status Codes ============

export const HTTP_OK = 200;
export const HTTP_CREATED = 201;
export const HTTP_ACCEPTED = 202;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_CONFLICT = 409;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_INTERNAL_ERROR = 500;
export const HTTP_SERVICE_UNAVAILABLE = 503;
