import { z } from 'zod';
import { normalizeMobileNumber } from '../../utils/mobile.utility.js';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;
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

const preprocessCustomerPayload = (val, ctx) => {
  if (!val || typeof val !== 'object') return val;
  const data = { ...val };

  // 1. Mobile Aliases & Mismatch Check: mobileNumber, mobile, phone
  const mobileEntries = [];
  if (data.mobileNumber !== undefined && data.mobileNumber !== null && data.mobileNumber !== '') mobileEntries.push({ key: 'mobileNumber', val: data.mobileNumber });
  if (data.mobile !== undefined && data.mobile !== null && data.mobile !== '') mobileEntries.push({ key: 'mobile', val: data.mobile });
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') mobileEntries.push({ key: 'phone', val: data.phone });

  if (mobileEntries.length > 1) {
    const normalizedList = [];
    for (const entry of mobileEntries) {
      try {
        normalizedList.push({ key: entry.key, norm: normalizeMobileNumber(entry.val) });
      } catch (err) {
        // Validation error will be handled by preprocessMobile
      }
    }
    if (normalizedList.length > 1) {
      const first = normalizedList[0].norm;
      const mismatch = normalizedList.some(item => item.norm !== first);
      if (mismatch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conflicting mobile number fields provided: ${mobileEntries.map(e => `${e.key}='${e.val}'`).join(', ')}.`,
          path: ['mobileNumber']
        });
      }
    }
  }

  if (mobileEntries.length > 0) {
    data.mobileNumber = mobileEntries[0].val;
    delete data.mobile;
    delete data.phone;
  }

  // 2. CustomerType Aliases & Mismatch Check: customerType, type
  if (typeof data.type === 'string') {
    data.type = data.type.toUpperCase();
  }
  if (typeof data.customerType === 'string') {
    data.customerType = data.customerType.toUpperCase();
  }

  if (data.customerType !== undefined && data.type !== undefined && data.customerType !== data.type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conflicting customerType ('${data.customerType}') and type ('${data.type}') provided.`,
      path: ['customerType']
    });
  } else if (data.type !== undefined) {
    data.customerType = data.type;
    delete data.type;
  }

  // 3. Address Aliases & Mismatch Check: address, billingAddress
  const addrStr = typeof data.address === 'string' ? data.address.trim() : (data.address || '');
  const billAddrStr = typeof data.billingAddress === 'string' ? data.billingAddress.trim() : (data.billingAddress || '');

  if (addrStr && billAddrStr && addrStr !== billAddrStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conflicting address ('${addrStr}') and billingAddress ('${billAddrStr}') provided.`,
      path: ['address']
    });
  } else if (billAddrStr) {
    data.address = billAddrStr;
    delete data.billingAddress;
  }

  // 4. PAN Aliases & Mismatch Check: pan, panNumber
  const panStr = typeof data.pan === 'string' ? data.pan.trim().toUpperCase() : (data.pan || '');
  const panNumStr = typeof data.panNumber === 'string' ? data.panNumber.trim().toUpperCase() : (data.panNumber || '');

  if (panStr && panNumStr && panStr !== panNumStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conflicting pan ('${panStr}') and panNumber ('${panNumStr}') provided.`,
      path: ['panNumber']
    });
  } else if (panStr) {
    data.panNumber = panStr;
    delete data.pan;
  }

  // 5. Name Aliases & Mismatch Check: name, customerName
  const nameStr = typeof data.name === 'string' ? data.name.trim() : (data.name || '');
  const custNameStr = typeof data.customerName === 'string' ? data.customerName.trim() : (data.customerName || '');

  if (nameStr && custNameStr && nameStr !== custNameStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conflicting name ('${nameStr}') and customerName ('${custNameStr}') provided.`,
      path: ['name']
    });
  } else if (custNameStr) {
    data.name = custNameStr;
    delete data.customerName;
  }

  return data;
};

export const lookupCustomerSchema = z.object({
  body: z.preprocess(preprocessCustomerPayload, z.object({
    mobileNumber: z.preprocess(preprocessMobile, z.string({ required_error: 'Customer mobile number is required.' })),
    name: z.string().trim().min(2, 'Customer Name must be at least 2 characters long.').max(100, 'Customer Name cannot exceed 100 characters.').optional(),
    businessName: z.string().trim().max(150, 'Business Name cannot exceed 150 characters.').optional().nullable(),
    contactPerson: z.string().trim().max(100, 'Contact Person cannot exceed 100 characters.').optional().nullable(),
    email: z.string().trim().email('Invalid email address format.').optional().or(z.literal('')).nullable(),
    gstin: preprocessGstin,
    address: z.string().trim().max(500, 'Address cannot exceed 500 characters.').optional().nullable(),
    shippingAddress: z.string().trim().max(500, 'Shipping Address cannot exceed 500 characters.').optional().nullable(),
    city: z.string().trim().max(100, 'City cannot exceed 100 characters.').optional().nullable(),
    state: z.string().trim().max(100, 'State cannot exceed 100 characters.').optional().nullable(),
    country: z.string().trim().max(100, 'Country cannot exceed 100 characters.').optional().nullable(),
    pincode: z.string().trim().regex(pincodeRegex, 'Invalid Indian Pincode. Must be a 6-digit number starting with 1-9.').optional().or(z.literal('')).nullable(),
    customerType: z.enum(['B2C', 'B2B'], {
      errorMap: () => ({ message: "Invalid customerType. Must be 'B2C' or 'B2B'." })
    }).optional().default('B2C'),
    panNumber: preprocessPan,
    stateCode: z.string().trim().regex(stateCodeRegex, 'State Code must be a 2-digit number (e.g., 27 for Maharashtra).').optional().or(z.literal('')).nullable(),
    creditPeriodDays: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().int({ message: 'Credit period days must be an integer.' }).min(0, 'Credit period days cannot be negative.').optional().nullable()),
    creditLimit: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().min(0, 'Credit limit cannot be negative.').optional().nullable())
  }).superRefine((data, ctx) => {
    // 1. Mandatory GSTIN for B2B Registration
    if (data.customerType === 'B2B' && (!data.gstin || !data.gstin.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GSTIN is required for B2B customer registration.',
        path: ['gstin']
      });
    }

    // 2. GSTIN StateCode vs stateCode Mismatch Check
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

export const updateCustomerSchema = z.object({
  body: z.preprocess(preprocessCustomerPayload, z.object({
    name: z.string().trim().min(2, 'Customer Name must be at least 2 characters long.').max(100, 'Customer Name cannot exceed 100 characters.').optional(),
    mobileNumber: z.preprocess(preprocessMobile, z.string().optional()),
    email: z.string().trim().email('Invalid email address format.').optional().or(z.literal('')).nullable(),
    customerType: z.enum(['B2C', 'B2B'], {
      errorMap: () => ({ message: "Invalid customerType. Must be 'B2C' or 'B2B'." })
    }).optional(),
    businessName: z.string().trim().max(150, 'Business Name cannot exceed 150 characters.').optional().nullable(),
    gstin: preprocessGstin,
    contactPerson: z.string().trim().max(100, 'Contact Person cannot exceed 100 characters.').optional().nullable(),
    address: z.string().trim().max(500, 'Address cannot exceed 500 characters.').optional().nullable(),
    shippingAddress: z.string().trim().max(500, 'Shipping Address cannot exceed 500 characters.').optional().nullable(),
    city: z.string().trim().max(100, 'City cannot exceed 100 characters.').optional().nullable(),
    state: z.string().trim().max(100, 'State cannot exceed 100 characters.').optional().nullable(),
    country: z.string().trim().max(100, 'Country cannot exceed 100 characters.').optional().nullable(),
    pincode: z.string().trim().regex(pincodeRegex, 'Invalid Indian Pincode. Must be a 6-digit number starting with 1-9.').optional().or(z.literal('')).nullable(),
    panNumber: preprocessPan,
    stateCode: z.string().trim().regex(stateCodeRegex, 'State Code must be a 2-digit number (e.g., 27 for Maharashtra).').optional().or(z.literal('')).nullable(),
    creditPeriodDays: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().int({ message: 'Credit period days must be an integer.' }).min(0, 'Credit period days cannot be negative.').optional().nullable()),
    creditLimit: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().min(0, 'Credit limit cannot be negative.').optional().nullable())
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update.',
    path: []
  }).superRefine((data, ctx) => {
    // GSTIN StateCode vs stateCode Mismatch Check on Update
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
