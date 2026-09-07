import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must not exceed 200 characters'),
  description: z.string().max(5000, 'Description must not exceed 5000 characters').default(''),
  price: z.number().positive('Price must be positive').max(999999.99, 'Price too large'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('USD'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  inventory: z.object({
    quantity: z.number().int().min(0, 'Quantity cannot be negative').max(100000),
  }),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().max(999999.99).optional(),
  imageUrl: z.string().url().optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMING_SOON']).optional(),
});

export const updateInventorySchema = z.object({
  totalQuantity: z.number().int().min(0).max(100000),
  availableQuantity: z.number().int().min(0).max(100000),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
