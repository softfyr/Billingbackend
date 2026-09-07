import * as categoryService from './category.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

// --- CATEGORY CONTROLLERS ---

export const handleCreateCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const category = await categoryService.createCategory(name, description);
  return ApiResponse.created(res, category, 'Category created successfully.');
});

export const handleGetCategories = asyncHandler(async (req, res) => {
  const { search, q } = req.query;
  const categories = await categoryService.getCategories(search || q);
  return ApiResponse.success(res, categories, 'Categories fetched successfully.');
});

export const handleGetCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return ApiResponse.success(res, category, 'Category details fetched successfully.');
});

export const handleUpdateCategory = asyncHandler(async (req, res) => {
  const updated = await categoryService.updateCategory(req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Category updated successfully.');
});

export const handleDeleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(req.params.id);
  return ApiResponse.success(res, result, 'Category deleted successfully.');
});


// --- SUB-CATEGORY CONTROLLERS ---

export const handleCreateSubCategory = asyncHandler(async (req, res) => {
  const { categoryId, name, description, enableExpiryDate, additionalFields } = req.body;
  const subCategory = await categoryService.createSubCategory(categoryId, name, description, enableExpiryDate, additionalFields);
  return ApiResponse.created(res, subCategory, 'Sub-Category created successfully.');
});

export const handleGetSubCategories = asyncHandler(async (req, res) => {
  const { categoryId } = req.query;
  const subCategories = await categoryService.getSubCategories(categoryId);
  return ApiResponse.success(res, subCategories, 'Sub-Categories fetched successfully.');
});

export const handleGetSubCategoryById = asyncHandler(async (req, res) => {
  const subCategory = await categoryService.getSubCategoryById(req.params.id);
  return ApiResponse.success(res, subCategory, 'Sub-Category details fetched successfully.');
});

export const handleUpdateSubCategory = asyncHandler(async (req, res) => {
  const updated = await categoryService.updateSubCategory(req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Sub-Category updated successfully.');
});

export const handleDeleteSubCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteSubCategory(req.params.id);
  return ApiResponse.success(res, result, 'Sub-Category deleted successfully.');
});


// --- DYNAMIC ADDITIONAL FIELD CONTROLLERS ---

export const handleAddAdditionalField = asyncHandler(async (req, res) => {
  const field = await categoryService.addAdditionalField(req.params.subCategoryId, req.body);
  return ApiResponse.created(res, field, 'Additional field configuration added to sub-category.');
});

export const handleUpdateAdditionalField = asyncHandler(async (req, res) => {
  const field = await categoryService.updateAdditionalField(req.params.fieldId, req.body);
  return ApiResponse.success(res, field, 'Additional field updated successfully.');
});

export const handleDeleteAdditionalField = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteAdditionalField(req.params.fieldId);
  return ApiResponse.success(res, result, 'Additional field deleted successfully.');
});
