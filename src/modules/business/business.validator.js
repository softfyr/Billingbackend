import { z } from 'zod';

export const createBusinessProfileSchema = z.object({
  body: z.object({
    businessName: z.string().optional(),
    storeName: z.string().optional(),
    name: z.string().optional(),
    businessType: z.string().optional(),
    ownerName: z.string().optional(),
    mobileNumber: z.string().optional(),
    email: z.string().email('Invalid email address format.').optional().or(z.literal('')),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    gstNumber: z.string().optional()
  }).passthrough()
});

export const createTaxSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Tax name is required.' }).min(1, 'Tax name cannot be empty.'),
    percentage: z.number({ required_error: 'Tax percentage is required.' })
      .or(z.string().transform(val => parseFloat(val))),
    type: z.enum(['PERCENTAGE', 'FIXED']).optional()
  }).passthrough()
});
