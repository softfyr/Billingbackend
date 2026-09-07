import { z } from 'zod';

export const createTaxSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Tax name is required.' }).min(1, 'Tax name cannot be empty.'),
    percentage: z.number({ required_error: 'Tax percentage is required.' })
      .or(z.string().transform(val => parseFloat(val))),
    type: z.enum(['PERCENTAGE', 'FIXED']).optional().default('PERCENTAGE'),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional().default('ACTIVE')
  })
});

export const updateTaxSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Tax name cannot be empty.').optional(),
    percentage: z.number().or(z.string().transform(val => parseFloat(val))).optional(),
    type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
  })
});
