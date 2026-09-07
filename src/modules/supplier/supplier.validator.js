import { z } from 'zod';

const mobileRegex = /^[6-9]\d{9}$/;
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const preprocessGstin = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  }
  return val;
}, z.string().regex(gstinRegex, 'Invalid GSTIN format. GSTIN is typically 15 alphanumeric characters (e.g. 08AAAAA0000A1Z5).').optional().or(z.literal('')).nullable());

const preprocessPan = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  }
  return val;
}, z.string().regex(panRegex, 'Invalid PAN format. PAN is typically 10 alphanumeric characters (e.g. AAAAA0000A).').optional().or(z.literal('')).nullable());

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Supplier Name is required.' })
      .trim()
      .min(2, 'Supplier Name must be at least 2 characters long.'),
    companyName: z.string().optional().nullable(),
    mobileNumber: z.string({ required_error: 'Mobile Number is required.' })
      .trim()
      .regex(mobileRegex, 'Invalid 10-digit mobile number format. Must start with 6-9.'),
    email: z.string().trim().email('Invalid email address format.').optional().or(z.literal('')).nullable(),
    gstin: preprocessGstin,
    pan: preprocessPan,
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    supplierType: z.string().optional().default('Local'),
    creditLimit: z.number().nonnegative().optional().default(0),
    paymentTerms: z.string().optional().default('30 Days')
  }).passthrough()
});

export const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Supplier Name must be at least 2 characters long.').optional(),
    companyName: z.string().optional().nullable(),
    mobileNumber: z.string().trim().regex(mobileRegex, 'Invalid 10-digit mobile number format.').optional(),
    email: z.string().trim().email('Invalid email address format.').optional().or(z.literal('')).nullable(),
    gstin: preprocessGstin,
    pan: preprocessPan,
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    supplierType: z.string().optional(),
    creditLimit: z.number().nonnegative().optional(),
    paymentTerms: z.string().optional(),
    status: z.preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])).optional()
  }).passthrough()
});

export const recordSupplierPaymentSchema = z.object({
  body: z.object({
    amount: z.number({ required_error: 'Payment amount is required.' })
      .positive('Payment amount must be greater than zero.')
      .or(z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val > 0, { message: 'Payment amount must be a positive number.' })),
    paymentMethod: z.enum(['CASH', 'UPI', 'BANK', 'CARD', 'OTHER']).optional().default('CASH'),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  }).passthrough()
});

export const importSuppliersSchema = z.object({
  body: z.object({
    suppliers: z.array(
      z.object({
        name: z.string({ required_error: 'Supplier Name is required.' }).trim().min(2),
        companyName: z.string().optional().nullable(),
        mobileNumber: z.string().trim().regex(mobileRegex, 'Invalid 10-digit mobile number format.'),
        email: z.string().trim().email().optional().or(z.literal('')).nullable(),
        gstin: z.string().trim().toUpperCase().optional().or(z.literal('')).nullable(),
        pan: z.string().trim().toUpperCase().optional().or(z.literal('')).nullable(),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        pincode: z.string().optional().nullable(),
        supplierType: z.string().optional().default('Local'),
        creditLimit: z.number().optional().default(0),
        paymentTerms: z.string().optional().default('30 Days')
      })
    ).min(1, 'At least one supplier record is required for bulk import.')
  }).passthrough()
});

