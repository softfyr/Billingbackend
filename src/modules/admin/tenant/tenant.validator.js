import { z } from 'zod';

export const updateTenantSubscriptionSchema = z.object({
  body: z.object({
    packageId: z.string().optional(),
    subscriptionStatus: z.enum(['FREE_TRIAL', 'FREE_TRIAL_ENDED', 'UPGRADED', 'EXPIRED']).optional(),
    extensionDays: z.number().or(z.string().transform(val => parseInt(val))).optional(),
    newExpiryDate: z.string().optional(),
    amount: z.number().or(z.string().transform(val => parseFloat(val))).optional(),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).optional(),
    transactionId: z.string().optional()
  }).passthrough()
});

export const updateTenantStatusSchema = z.object({
  body: z.object({
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED'], {
      required_error: 'Account status must be either ACTIVE or SUSPENDED.'
    })
  }).passthrough()
});
