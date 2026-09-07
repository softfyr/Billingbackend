import { z } from 'zod';

// Helper preprocessors to support multipart/form-data string inputs
const preprocessNumber = (schema) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string') {
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  }, schema);

const preprocessBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
}, z.boolean().optional());

const preprocessJson = z.preprocess((val) => {
  if (typeof val === 'string' && val.trim()) {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val;
}, z.record(z.any()).optional());

export const createProductSchema = z.object({
  body: z.object({
    categoryId: z.string({ required_error: 'Category ID is required.' }).uuid({ message: 'Invalid Category ID format.' }),
    subCategoryId: z.string({ required_error: 'Sub-Category ID is required.' }).uuid({ message: 'Invalid Sub-Category ID format.' }),
    name: z.string({ required_error: 'Product Name is required.' }).min(2, { message: 'Product Name must be at least 2 characters.' }),
    sku: z.string().optional().nullable(),
    hsnCode: z.string({ required_error: 'HSN Code is required.' }).min(2, { message: 'HSN Code must be at least 2 characters.' }),
    brand: z.string().optional().nullable(),
    unit: z.string().optional().default('Pcs'),
    hasSecondaryUnit: preprocessBoolean.default(false),
    secondaryUnit: z.string().optional().nullable(),
    conversionFactor: preprocessNumber(z.number().positive({ message: 'Conversion factor must be greater than 0.' })).optional().default(1),
    secondaryPurchasePrice: preprocessNumber(z.number().positive({ message: 'Secondary purchase price must be greater than 0.' })).optional().nullable(),
    purchasePrice: preprocessNumber(z.number().nonnegative({ message: 'Purchase price must be greater than or equal to 0.' })).optional().default(0),
    sellingPrice: preprocessNumber(z.number({ required_error: 'Selling Price is required.' }).positive({ message: 'Selling price must be greater than 0.' })),
    mrp: preprocessNumber(z.number().positive()).optional().nullable(),
    taxType: z.string().optional().default('GST'),
    taxMode: z.enum(['INCLUSIVE', 'EXCLUSIVE']).optional().default('EXCLUSIVE'),
    taxPercent: preprocessNumber(z.number().nonnegative()).optional().default(18),
    discountPercent: preprocessNumber(z.number().nonnegative()).optional().default(0),
    taxId: z.string().uuid().optional().nullable().or(z.literal('')),
    openingStock: preprocessNumber(z.number().nonnegative()).optional().default(0),
    maxStockLevel: preprocessNumber(z.number().nonnegative()).optional().default(0),
    minStockLevel: preprocessNumber(z.number().nonnegative()).optional().default(5),
    stockAlertQuantity: preprocessNumber(z.number().nonnegative()).optional().default(5),
    enableStockAlert: preprocessBoolean.default(true),
    productImage: z.any().optional().nullable(),
    description: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    additionalValues: preprocessJson.default({}),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DRAFT']).optional().default('ACTIVE')
  }).passthrough().superRefine((data, ctx) => {
    if (data.hasSecondaryUnit) {
      if (!data.secondaryUnit || !data.secondaryUnit.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Secondary Unit is required when Multi-Unit is enabled.',
          path: ['secondaryUnit']
        });
      }
      if (!data.conversionFactor || data.conversionFactor <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conversion factor must be greater than 0 when Multi-Unit is enabled.',
          path: ['conversionFactor']
        });
      }
      if (!data.secondaryPurchasePrice || data.secondaryPurchasePrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Secondary purchase price must be greater than 0 when Multi-Unit is enabled.',
          path: ['secondaryPurchasePrice']
        });
      }
    }
  })
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    sku: z.string().optional().nullable(),
    hsnCode: z.string().min(2).optional().nullable(),
    brand: z.string().optional().nullable(),
    unit: z.string().optional(),
    hasSecondaryUnit: preprocessBoolean,
    secondaryUnit: z.string().optional().nullable(),
    conversionFactor: preprocessNumber(z.number().positive()).optional(),
    secondaryPurchasePrice: preprocessNumber(z.number().positive()).optional().nullable(),
    purchasePrice: preprocessNumber(z.number().nonnegative()).optional(),
    sellingPrice: preprocessNumber(z.number().positive()).optional(),
    mrp: preprocessNumber(z.number().positive()).optional().nullable(),
    taxType: z.string().optional(),
    taxMode: z.enum(['INCLUSIVE', 'EXCLUSIVE']).optional(),
    taxPercent: preprocessNumber(z.number().nonnegative()).optional(),
    discountPercent: preprocessNumber(z.number().nonnegative()).optional(),
    taxId: z.string().uuid().optional().nullable().or(z.literal('')),
    maxStockLevel: preprocessNumber(z.number().nonnegative()).optional(),
    minStockLevel: preprocessNumber(z.number().nonnegative()).optional(),
    stockAlertQuantity: preprocessNumber(z.number().nonnegative()).optional(),
    enableStockAlert: preprocessBoolean,
    productImage: z.any().optional().nullable(),
    description: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    additionalValues: preprocessJson,
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DRAFT']).optional()
  }).passthrough()
});

export const stockAdjustmentSchema = z.object({
  body: z.object({
    quantityChange: preprocessNumber(z.number({ required_error: 'Quantity change is required.' })),
    reason: z.enum(['STOCK_ADJUSTMENT', 'OPENING_STOCK', 'PURCHASE', 'SALE', 'SALES_RETURN', 'PURCHASE_RETURN', 'DAMAGE', 'SPOILAGE', 'CORRECTION', 'MANUAL_ADJUSTMENT']).optional().default('STOCK_ADJUSTMENT'),
    notes: z.string().optional().nullable()
  })
});

export const importProductsSchema = z.object({
  body: z.object({
    products: z.array(z.object({
      name: z.string({ required_error: 'Product Name is required.' }),
      categoryId: z.string().optional(),
      subCategoryId: z.string().optional(),
      categoryName: z.string().optional(),
      subCategoryName: z.string().optional(),
      sku: z.string().optional(),
      hsnCode: z.string().optional(),
      brand: z.string().optional(),
      unit: z.string().optional(),
      hasSecondaryUnit: preprocessBoolean,
      secondaryUnit: z.string().optional(),
      conversionFactor: preprocessNumber(z.number()).optional(),
      secondaryPurchasePrice: preprocessNumber(z.number()).optional(),
      purchasePrice: preprocessNumber(z.number()).optional(),
      sellingPrice: preprocessNumber(z.number()).optional(),
      mrp: preprocessNumber(z.number()).optional(),
      taxType: z.string().optional(),
      taxMode: z.string().optional(),
      taxPercent: preprocessNumber(z.number()).optional(),
      discountPercent: preprocessNumber(z.number()).optional(),
      openingStock: preprocessNumber(z.number()).optional(),
      minStockLevel: preprocessNumber(z.number()).optional(),
      expiryDate: z.string().optional()
    })).min(1, { message: 'At least one product record must be provided for import.' })
  }).passthrough()
});
