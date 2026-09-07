// ============ User Types ============
export interface UserPayload {
  id: string;
  email: string;
  username: string;
  role: 'CUSTOMER' | 'ADMIN';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

// ============ Product Types ============
export interface ProductListItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'COMING_SOON';
  availableQuantity: number;
  flashSale?: {
    isFlashSale: boolean;
    startTime: string;
    endTime: string;
    flashPrice: number;
    originalPrice: number;
    maxPerUser: number;
  };
}

export interface ProductDetail extends ProductListItem {
  mongoId: string | null;
  specifications: Array<{ key: string; value: string }>;
  images: Array<{ url: string; alt: string; isPrimary: boolean }>;
  ratings: { average: number; count: number };
  category: string;
  tags: string[];
}

// ============ Inventory Types ============
export interface InventoryState {
  id: string;
  productId: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  versionLock: number;
}

// ============ Reservation Types ============
export type ReservationState = 'RESERVED' | 'PAYMENT_PENDING' | 'SOLD' | 'EXPIRED' | 'FAILED';

export interface ReservationResponse {
  id: string;
  productId: string;
  quantity: number;
  state: ReservationState;
  expiresAt: string;
  idempotencyKey: string;
}

// ============ Checkout Types ============
export interface CheckoutReserveRequest {
  productId: string;
  quantity: number;
  idempotencyKey?: string;
}

export interface CheckoutReserveResponse {
  success: boolean;
  checkoutSessionId?: string;
  reservationId?: string;
  expiresIn?: number;
  idempotencyKey?: string;
  error?: string;
}

export interface CheckoutPaymentRequest {
  checkoutSessionId: string;
  idempotencyKey: string;
}

export interface CheckoutPaymentResponse {
  success: boolean;
  clientSecret?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

// ============ Order Types ============
export type OrderStatusType = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatusType;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    imageUrl?: string;
  }>;
  payment?: {
    status: string;
    confirmedAt?: string;
  };
  shippingAddress?: string;
}

// ============ Payment Types ============
export type PaymentStatusType = 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';

// ============ Admin Types ============
export interface AdminProductCreateRequest {
  name: string;
  description: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  inventory: { quantity: number };
  category?: string;
  tags?: string[];
}

export interface AdminProductUpdateRequest {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'COMING_SOON';
}

export interface AdminInventoryUpdateRequest {
  totalQuantity: number;
  availableQuantity: number;
}

// ============ API Response Wrappers ============
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============ Health Check ============
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
  services: {
    postgres: boolean;
    redis: boolean;
    mongo: boolean;
    queue: boolean;
  };
}

// ============ Queue Message Types ============
export interface QueueMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: string;
  attempt: number;
}

export interface PaymentProcessingMessage {
  reservationId: string;
  paymentIntentId: string;
  idempotencyKey: string;
  userId: string;
  orderId: string;
}

export interface OrderFulfillmentMessage {
  orderId: string;
  userId: string;
}

export interface ReservationExpirationMessage {
  reservationId: string;
  inventoryId: string;
  quantity: number;
}
