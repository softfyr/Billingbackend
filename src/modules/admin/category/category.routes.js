import { Router } from 'express';
import * as categoryController from './category.controller.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubCategorySchema,
  updateSubCategorySchema,
  addAdditionalFieldSchema,
  updateAdditionalFieldSchema
} from './category.validator.js';

const router = Router();

// --- MASTER CATEGORY ROUTES ---
router.post('/categories', validate(createCategorySchema), categoryController.handleCreateCategory);
router.get('/categories', categoryController.handleGetCategories);
router.get('/categories/:id', categoryController.handleGetCategoryById);
router.put('/categories/:id', validate(updateCategorySchema), categoryController.handleUpdateCategory);
router.delete('/categories/:id', categoryController.handleDeleteCategory);

// --- SUB-CATEGORY ROUTES ---
router.post('/sub-categories', validate(createSubCategorySchema), categoryController.handleCreateSubCategory);
router.get('/sub-categories', categoryController.handleGetSubCategories);
router.get('/sub-categories/:id', categoryController.handleGetSubCategoryById);
router.put('/sub-categories/:id', validate(updateSubCategorySchema), categoryController.handleUpdateSubCategory);
router.delete('/sub-categories/:id', categoryController.handleDeleteSubCategory);

// --- DYNAMIC ADDITIONAL FIELDS ROUTES ---
router.post('/sub-categories/:subCategoryId/fields', validate(addAdditionalFieldSchema), categoryController.handleAddAdditionalField);
router.put('/sub-categories/fields/:fieldId', validate(updateAdditionalFieldSchema), categoryController.handleUpdateAdditionalField);
router.delete('/sub-categories/fields/:fieldId', categoryController.handleDeleteAdditionalField);

export default router;
