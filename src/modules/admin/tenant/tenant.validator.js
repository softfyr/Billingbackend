import { z } from 'zod';

export const updateTenantSubscriptionSchema = z.object({
  body: z.object({
    packageId: z.string().optional(),
    subscriptionStatus: z.enum(['FREE_TRIAL', 'FREE_TRIAL_ENDED', 'UPGRADED', 'EXPIRED']).optional(),
    extensionDays: z.number().or(z.string().transform(val => parseInt(val, 10))).optional(),
    newExpiryDate: z.string().optional(),
    amount: z.number().or(z.string().transform(val => parseFloat(val))).optional(),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).optional(),
    transactionId: z.string().optional(),
    remarks: z.string().optional()
  }).passthrough()
});

export const updateTenantStatusSchema = z.object({
  body: z.object({
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED'], {
      required_error: 'Account status must be either ACTIVE or SUSPENDED.'
    })
  }).passthrough()
});

export const updateBusinessInfoSchema = z.object({
  body: z.object({
    businessName: z.string().min(1, 'Business name cannot be empty.').optional(),
    businessType: z.string().optional(),
    businessLogo: z.any().optional().nullable(),
    businessAddress: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    gstNumber: z.string().optional().nullable(),
    gstin: z.string().optional().nullable(),
    panNumber: z.string().optional().nullable(),
    otherInvoiceInfo: z.string().optional()
  }).passthrough()
});

export const updateOwnerInfoSchema = z.object({
  body: z.object({
    ownerName: z.string().min(1, 'Owner name cannot be empty.').optional(),
    email: z.string().email('Invalid email address format.').optional(),
    mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits.').optional()
  }).passthrough()
});

export const createNoteSchema = z.object({
  body: z.object({
    noteText: z.string().min(1, 'Note text cannot be empty.')
  }).passthrough()
});

export const updateNoteSchema = z.object({
  body: z.object({
    noteText: z.string().min(1, 'Note text cannot be empty.')
  }).passthrough()
});

export const subscriptionActionSchema = z.object({
  body: z.object({
    action: z.enum([
      'ASSIGN',
      'UPGRADE',
      'EXTEND_TRIAL',
      'EXTEND_SUBSCRIPTION',
      'CHANGE_EXPIRY',
      'ACTIVATE',
      'UPDATE'
    ]).optional(),
    packageId: z.string().optional(),
    durationMonths: z.number().optional(),
    days: z.number().or(z.string().transform(val => parseInt(val, 10))).optional(),
    extensionDays: z.number().or(z.string().transform(val => parseInt(val, 10))).optional(),
    newExpiryDate: z.string().optional(),
    amount: z.number().or(z.string().transform(val => parseFloat(val))).optional(),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).optional(),
    paymentGateway: z.string().optional(),
    transactionId: z.string().optional(),
    remarks: z.string().optional()
  }).passthrough()
});
