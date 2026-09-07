// ============ Base Application Error ============

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============ Auth Errors ============

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}

// ============ Inventory/Checkout Errors ============

export class InsufficientInventoryError extends AppError {
  constructor(productId: string, available: number, requested: number) {
    super(
      `Insufficient inventory for product ${productId}. Available: ${available}, Requested: ${requested}`,
      409,
      'INSUFFICIENT_INVENTORY'
    );
  }
}

export class ReservationExpiredError extends AppError {
  constructor(reservationId: string) {
    super(
      `Reservation ${reservationId} has expired`,
      410,
      'RESERVATION_EXPIRED'
    );
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super(
      `Invalid state transition for ${entity}: ${from} → ${to}`,
      409,
      'INVALID_STATE_TRANSITION'
    );
  }
}

export class CheckoutSessionExpiredError extends AppError {
  constructor(sessionId: string) {
    super(
      `Checkout session ${sessionId} has expired`,
      410,
      'CHECKOUT_SESSION_EXPIRED'
    );
  }
}

// ============ Idempotency Errors ============

export class DuplicateRequestError extends AppError {
  constructor(key: string) {
    super(
      `Duplicate request with idempotency key: ${key}`,
      409,
      'DUPLICATE_REQUEST'
    );
  }
}

// ============ Lock Errors ============

export class LockAcquisitionError extends AppError {
  constructor(resource: string) {
    super(
      `Unable to acquire lock for resource: ${resource}. Please try again.`,
      503,
      'LOCK_ACQUISITION_FAILED'
    );
  }
}

// ============ Resource Errors ============

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(
      `${resource} not found: ${id}`,
      404,
      'NOT_FOUND'
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

// ============ Validation Errors ============

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

// ============ Payment Errors ============

export class PaymentError extends AppError {
  constructor(message: string, code: string = 'PAYMENT_ERROR') {
    super(message, 402, code);
  }
}

export class PaymentAlreadyProcessedError extends AppError {
  constructor(paymentIntentId: string) {
    super(
      `Payment already processed: ${paymentIntentId}`,
      409,
      'PAYMENT_ALREADY_PROCESSED'
    );
  }
}

// ============ Rate Limit Error ============

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}
