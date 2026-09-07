import { z } from 'zod';

export const createReservationSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(10, 'Maximum quantity is 10'),
  idempotencyKey: z.string().optional(),
});

export const createPaymentSchema = z.object({
  checkoutSessionId: z.string().min(1, 'Checkout session ID is required'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

export const confirmCheckoutSchema = z.object({
  reservationId: z.string().min(1, 'Reservation ID is required'),
  paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ConfirmCheckoutInput = z.infer<typeof confirmCheckoutSchema>;
