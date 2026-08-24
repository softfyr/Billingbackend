import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    categoryId: z.string({ required_error: 'Category ID is required.' }).uuid({ message: 'Invalid Category ID format.' }),
    subCategoryId: z.string({ required_error: 'Sub-Category ID is required.' }).uuid({ message: 'Invalid Sub-Category ID format.' }),
    name: z.string({ required_error: 'Product Name is required.' }).min(2, { message: 'Product Name must be at least 2 characters.' }),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    unit: z.string().optional().default('Pcs'),
    purchasePrice: z.number().nonnegative({ message: 'Purchase price must be greater than or equal to 0.' }).optional().default(0),
    sellingPrice: z.number({ required_error: 'Selling Price is required.' }).positive({ message: 'Selling price must be greater than 0.' }),
    mrp: z.number().positive().optional().nullable(),
    taxType: z.string().optional().default('GST'),
    discountPercent: z.number().nonnegative().optional().default(0),
    taxId: z.string().uuid().optional().nullable(),
    openingStock: z.number().int().nonnegative().optional().default(0),
    maxStockLevel: z.number().int().nonnegative().optional().default(0),
    minStockLevel: z.number().int().nonnegative().optional().default(5),
    stockAlertQuantity: z.number().int().nonnegative().optional().default(5),
    enableStockAlert: z.boolean().optional().default(true),
    productImage: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    additionalValues: z.record(z.any()).optional().default({}),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DRAFT']).optional().default('ACTIVE')
  })
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    unit: z.string().optional(),
    purchasePrice: z.number().nonnegative().optional(),
    sellingPrice: z.number().positive().optional(),
    mrp: z.number().positive().optional().nullable(),
    taxType: z.string().optional(),
    discountPercent: z.number().nonnegative().optional(),
    taxId: z.string().uuid().optional().nullable(),
    maxStockLevel: z.number().int().nonnegative().optional(),
    minStockLevel: z.number().int().nonnegative().optional(),
    stockAlertQuantity: z.number().int().nonnegative().optional(),
    enableStockAlert: z.boolean().optional(),
    productImage: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    additionalValues: z.record(z.any()).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DRAFT']).optional()
  })
});

export const importProductsSchema = z.object({
  body: z.object({
    products: z.array(z.object({
      name: z.string({ required_error: 'Product Name is required.' }),
      categoryId: z.string().optional(),
      subCategoryId: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      brand: z.string().optional(),
      unit: z.string().optional(),
      purchasePrice: z.number().optional(),
      sellingPrice: z.number().optional(),
      mrp: z.number().optional(),
      taxType: z.string().optional(),
      discountPercent: z.number().optional(),
      openingStock: z.number().optional(),
      minStockLevel: z.number().optional()
    })).min(1, { message: 'At least one product record must be provided for import.' })
  })
});
