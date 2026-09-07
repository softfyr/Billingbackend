import { z } from 'zod';

export const updateStockManualSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required.' }).uuid({ message: 'Invalid Product ID UUID format.' }),
    quantityChange: z.number({ required_error: 'Quantity Change is required.' }).int({ message: 'Quantity Change must be a whole integer.' }).refine(val => val !== 0, { message: 'Quantity Change cannot be zero.' }),
    reason: z.enum(['MANUAL_ADJUSTMENT', 'NEW_PURCHASE', 'DAMAGED', 'LOST', 'STOCK_CORRECTION', 'RETURN', 'EXPIRED_DISCARD'], {
      errorMap: () => ({ message: 'Reason must be one of MANUAL_ADJUSTMENT, NEW_PURCHASE, DAMAGED, LOST, STOCK_CORRECTION, RETURN, EXPIRED_DISCARD.' })
    }).optional().default('MANUAL_ADJUSTMENT'),
    customReason: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  })
});
