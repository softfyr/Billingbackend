import { z } from 'zod';

export const updateStockManualSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required.' }).uuid({ message: 'Invalid Product ID UUID format.' }),
    quantityChange: z.coerce.number({ invalid_type_error: 'Quantity Change must be a valid number.' }).refine(val => Number.isFinite(val) && val !== 0, { message: 'Quantity Change must be a non-zero valid finite number.' }),
    unit: z.string().optional().nullable(),
    reason: z.enum([
      'STOCK_ADJUSTMENT', 'OPENING_STOCK', 'PURCHASE', 'SALE', 'SALES_RETURN', 'PURCHASE_RETURN', 
      'DAMAGE', 'SPOILAGE', 'CORRECTION', 'CANCELLED_BILL', 'LOST',
      'MANUAL_ADJUSTMENT', 'NEW_PURCHASE', 'DAMAGED', 'RETURN', 'STOCK_CORRECTION', 'EXPIRED_DISCARD'
    ], {
      errorMap: () => ({ message: 'Reason is required and must be a valid stock movement reason.' })
    }),
    customReason: z.string().optional().nullable()
  })
});

export const reconcileStockSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required.' }).uuid({ message: 'Invalid Product ID UUID format.' }),
    physicalCount: z.coerce.number({ invalid_type_error: 'Physical Count must be a valid number.' }).refine(val => Number.isFinite(val) && val >= 0, { message: 'Physical Count must be a valid non-negative number.' }),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  })
});

export const damageStockSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required.' }).uuid({ message: 'Invalid Product ID UUID format.' }),
    damagedQuantity: z.coerce.number({ invalid_type_error: 'Damaged Quantity must be a valid number.' }).refine(val => Number.isFinite(val) && val > 0, { message: 'Damaged Quantity must be a valid positive number.' }),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    referenceId: z.string().optional().nullable()
  })
});

export const lostStockSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required.' }).uuid({ message: 'Invalid Product ID UUID format.' }),
    lostQuantity: z.coerce.number({ invalid_type_error: 'Lost Quantity must be a valid number.' }).refine(val => Number.isFinite(val) && val > 0, { message: 'Lost Quantity must be a valid positive number.' }),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    referenceId: z.string().optional().nullable()
  })
});

export const getExpiryAlertsSchema = z.object({
  query: z.object({
    days: z.coerce.number({ invalid_type_error: 'Days must be a valid positive integer.' })
      .int({ message: 'Days must be a positive integer.' })
      .positive({ message: 'Days must be a positive integer.' })
      .optional()
      .default(30)
  })
});

