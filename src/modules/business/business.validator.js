import { z } from 'zod';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Preprocessor for GSTIN / GST Number to handle uppercase conversion & flexible empty input
const preprocessGstin = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  }
  return val;
}, z.string().regex(gstinRegex, 'Invalid GSTIN format. GSTIN is typically 15 alphanumeric characters (e.g. 22AAAAA0000A1Z5).').optional().or(z.literal('')).nullable());

// Preprocessor for PAN Number to handle uppercase conversion & flexible empty input
const preprocessPan = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  }
  return val;
}, z.string().regex(panRegex, 'Invalid PAN format. PAN is typically 10 alphanumeric characters (e.g. AAAAA0000A).').optional().or(z.literal('')).nullable());

// Step 1: Owner Information
export const step1ProfileSchema = z.object({
  body: z.object({
    ownerName: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email('Invalid email address format.').optional().or(z.literal('')),
    mobileNumber: z.string().optional()
  }).passthrough()
});

// Step 2: Business Information
export const step2ProfileSchema = z.object({
  body: z.object({
    businessName: z.string().optional(),
    storeName: z.string().optional(),
    business_name: z.string().optional(),
    businessType: z.string().optional(),
    category: z.string().optional(),
    businessLogo: z.any().optional().nullable(),
    businessAddress: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    gstNumber: preprocessGstin,
    gstin: preprocessGstin,
    panNumber: preprocessPan,
    otherInvoiceInfo: z.string().optional(),
    invoiceTerms: z.string().optional()
  }).passthrough()
});

export const createBusinessProfileSchema = z.object({
  body: z.object({
    step: z.union([z.number(), z.string()]).optional(),
    businessName: z.string().optional(),
    storeName: z.string().optional(),
    name: z.string().optional(),
    business_name: z.string().optional(),
    businessType: z.string().optional(),
    category: z.string().optional(),
    ownerName: z.string().optional(),
    mobileNumber: z.string().optional(),
    email: z.string().email('Invalid email address format.').optional().or(z.literal('')),
    businessLogo: z.any().optional().nullable(),
    businessAddress: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    gstNumber: preprocessGstin,
    gstin: preprocessGstin,
    panNumber: preprocessPan,
    otherInvoiceInfo: z.string().optional(),
    invoiceTerms: z.string().optional()
  }).passthrough()
});

