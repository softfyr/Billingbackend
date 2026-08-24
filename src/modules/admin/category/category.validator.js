import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Category name is required.' }).min(2, 'Category name must be at least 2 characters.'),
    description: z.string().optional().nullable()
  }).passthrough()
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional().nullable()
  }).passthrough()
});

export const createSubCategorySchema = z.object({
  body: z.object({
    categoryId: z.string({ required_error: 'Parent Category ID is required.' }),
    name: z.string({ required_error: 'Sub-Category name is required.' }).min(2, 'Sub-Category name must be at least 2 characters.'),
    description: z.string().optional().nullable(),
    enableExpiryDate: z.boolean().optional().default(false),
    additionalFields: z.array(z.object({
      labelName: z.string(),
      inputType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'BOOLEAN']).optional().default('TEXT'),
      isRequired: z.boolean().optional().default(false)
    })).optional()
  }).passthrough()
});

export const updateSubCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    enableExpiryDate: z.boolean().optional()
  }).passthrough()
});

export const addAdditionalFieldSchema = z.object({
  body: z.object({
    labelName: z.string({ required_error: 'Label name is required for dynamic custom field.' }),
    inputType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'BOOLEAN']).optional().default('TEXT'),
    isRequired: z.boolean().optional().default(false),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional().default('ACTIVE')
  }).passthrough()
});

export const updateAdditionalFieldSchema = z.object({
  body: z.object({
    labelName: z.string().optional(),
    inputType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'BOOLEAN']).optional(),
    isRequired: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
  }).passthrough()
});
