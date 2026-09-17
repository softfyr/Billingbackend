import { z } from 'zod';
import { normalizeMobileNumber } from '../../utils/mobile.utility.js';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const stateCodeRegex = /^[0-9]{2}$/;

const preprocessMobile = (val, ctx) => {
  if (val === undefined || val === null || val === '') return undefined;
  try {
    return normalizeMobileNumber(val);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err.message || 'Invalid mobile number format. Must be a valid 10-digit Indian mobile number.'
    });
    return z.NEVER;
  }
};

const preprocessGstin = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  }
  return val;
}, z.string().regex(gstinRegex, 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 27AAAAA0000A1Z5).').optional().or(z.literal('')).nullable());

const preprocessPan = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  }
  return val;
}, z.string().regex(panRegex, 'Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).').optional().or(z.literal('')).nullable());

const preprocessBillPayload = (val, ctx) => {
  if (!val || typeof val !== 'object') return val;
  const data = { ...val };

  // 1. Mobile Aliases & Mismatch Check: customerMobile, mobile, phone
  const mobileEntries = [];
  if (data.customerMobile !== undefined && data.customerMobile !== null && data.customerMobile !== '') mobileEntries.push({ key: 'customerMobile', val: data.customerMobile });
  if (data.mobile !== undefined && data.mobile !== null && data.mobile !== '') mobileEntries.push({ key: 'mobile', val: data.mobile });
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') mobileEntries.push({ key: 'phone', val: data.phone });

  if (mobileEntries.length > 1) {
    const normalizedList = [];
    for (const entry of mobileEntries) {
      try {
        normalizedList.push({ key: entry.key, norm: normalizeMobileNumber(entry.val) });
      } catch (err) { }
    }
    if (normalizedList.length > 1) {
      const first = normalizedList[0].norm;
      const mismatch = normalizedList.some(item => item.norm !== first);
      if (mismatch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conflicting mobile number fields provided: ${mobileEntries.map(e => `${e.key}='${e.val}'`).join(', ')}.`,
          path: ['customerMobile']
        });
      }
    }
  }

  if (mobileEntries.length > 0) {
    data.customerMobile = mobileEntries[0].val;
    delete data.mobile;
    delete data.phone;
  }

  // 2. Customer Name Aliases: customerName, name
  const custNameStr = typeof data.customerName === 'string' ? data.customerName.trim() : (data.customerName || '');
  const nameStr = typeof data.name === 'string' ? data.name.trim() : (data.name || '');

  if (custNameStr && nameStr && custNameStr !== nameStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conflicting customerName ('${custNameStr}') and name ('${nameStr}') provided.`,
      path: ['customerName']
    });
  } else if (nameStr) {
    data.customerName = nameStr;
    delete data.name;
  }

  // 3. BillType Aliases: billType, customerType, type
  if (typeof data.type === 'string') data.type = data.type.toUpperCase();
  if (typeof data.customerType === 'string') data.customerType = data.customerType.toUpperCase();
  if (typeof data.billType === 'string') data.billType = data.billType.toUpperCase();

  const typeVal = data.billType || data.customerType || data.type;
  if (typeVal) {
    data.billType = typeVal;
    delete data.type;
    delete data.customerType;
  }

  return data;
};

export const generateBillSchema = z.object({
  body: z.preprocess(preprocessBillPayload, z.object({
    customerMobile: z.preprocess(preprocessMobile, z.string({ required_error: 'Customer mobile number is required.' })),
    customerName: z.string().trim().min(2, 'Customer Name must be at least 2 characters long.').optional().nullable(),
    billType: z.enum(['B2C', 'B2B'], {
      errorMap: () => ({ message: "Invalid billType. Must be 'B2C' or 'B2B'." })
    }).optional().default('B2C'),
    businessName: z.string().trim().optional().nullable(),
    gstin: preprocessGstin,
    contactPerson: z.string().trim().optional().nullable(),
    shippingAddress: z.string().trim().optional().nullable(),
    panNumber: preprocessPan,
    stateCode: z.string().trim().regex(stateCodeRegex, 'State Code must be a 2-digit number (e.g., 27 for Maharashtra).').optional().or(z.literal('')).nullable(),
    creditPeriodDays: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().int().min(0).optional().nullable()),
    creditLimit: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().min(0).optional().nullable()),
    items: z.array(
      z.object({
        productId: z.string({ required_error: 'Product ID is required.' }).uuid('Invalid Product ID format.'),
        quantity: z.preprocess((val) => {
          if (typeof val === 'string') return parseFloat(val);
          return val;
        }, z.number({ required_error: 'Item quantity is required.' }).positive('Quantity must be greater than zero.')),
        unitPrice: z.preprocess((val) => {
          if (val === undefined || val === null || val === '') return undefined;
          return typeof val === 'string' ? parseFloat(val) : val;
        }, z.number().nonnegative('Unit price cannot be negative.').optional()),
        discountAmount: z.preprocess((val) => {
          if (val === undefined || val === null || val === '') return 0;
          return typeof val === 'string' ? parseFloat(val) : val;
        }, z.number().nonnegative('Discount amount cannot be negative.').optional().default(0)),
        taxType: z.string().optional()
      })
    ).min(1, 'At least one bill item is required to generate an invoice.'),
    discountType: z.enum(['NONE', 'PERCENTAGE', 'FIXED']).optional().default('NONE'),
    discountValue: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') return 0;
      return typeof val === 'string' ? parseFloat(val) : val;
    }, z.number().nonnegative('Discount value cannot be negative.').optional().default(0)),
    paymentStatus: z.enum(['PAID', 'UNPAID', 'PARTIALLY_PAID', 'CANCELLED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED']).optional().default('PAID'),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).optional().default('CASH'),
    paidAmountInput: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return typeof val === 'string' ? parseFloat(val) : val;
    }, z.number().nonnegative('Paid amount input cannot be negative.').optional())
  }).superRefine((data, ctx) => {
    // GSTIN StateCode vs stateCode Mismatch Check
    if (data.gstin && data.gstin.length >= 2 && data.stateCode) {
      const gstinPrefix = data.gstin.slice(0, 2);
      if (gstinPrefix !== data.stateCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `GSTIN state code prefix '${gstinPrefix}' does not match provided stateCode '${data.stateCode}'.`,
          path: ['stateCode']
        });
      }
    }
  }))
});

export const processReturnSchema = z.object({
  body: z.object({
    billId: z.string().uuid('Invalid Bill ID format.').optional().nullable(),
    returnItems: z.array(
      z.object({
        productId: z.string({ required_error: 'Product ID is required.' }).uuid('Invalid Product ID format.'),
        returnQuantity: z.preprocess((val) => {
          if (typeof val === 'string') return parseFloat(val);
          return val;
        }, z.number({ required_error: 'Return quantity is required.' }).positive('Return quantity must be greater than zero.')),
        reason: z.string().optional().nullable()
      })
    ).min(1, 'At least one return item must be provided.').superRefine((items, ctx) => {
      const seen = new Set();
      for (let i = 0; i < items.length; i++) {
        if (seen.has(items[i].productId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate product ID '${items[i].productId}' found in return items. Return items must contain unique product IDs.`,
            path: [i, 'productId']
          });
          break;
        }
        seen.add(items[i].productId);
      }
    })
  })
});

export const cancelBillSchema = z.object({
  body: z.object({
    reason: z.string().optional().nullable()
  })
});
