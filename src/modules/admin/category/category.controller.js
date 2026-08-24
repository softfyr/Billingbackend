import * as categoryService from './category.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

// --- CATEGORY CONTROLLERS ---

export const handleCreateCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const category = await categoryService.createCategory(name, description);
  return res.status(201).json(new ApiResponse(201, category, 'Category created successfully.'));
});

export const handleGetCategories = asyncHandler(async (req, res) => {
  const { search, q } = req.query;
  const categories = await categoryService.getCategories(search || q);
  return res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully.'));
});

export const handleGetCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return res.status(200).json(new ApiResponse(200, category, 'Category details fetched successfully.'));
});

export const handleUpdateCategory = asyncHandler(async (req, res) => {
  const updated = await categoryService.updateCategory(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, updated, 'Category updated successfully.'));
});

export const handleDeleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Category deleted successfully.'));
});


// --- SUB-CATEGORY CONTROLLERS ---

export const handleCreateSubCategory = asyncHandler(async (req, res) => {
  const { categoryId, name, description, enableExpiryDate, additionalFields } = req.body;
  const subCategory = await categoryService.createSubCategory(categoryId, name, description, enableExpiryDate, additionalFields);
  return res.status(201).json(new ApiResponse(201, subCategory, 'Sub-Category created successfully.'));
});

export const handleGetSubCategories = asyncHandler(async (req, res) => {
  const { categoryId } = req.query;
  const subCategories = await categoryService.getSubCategories(categoryId);
  return res.status(200).json(new ApiResponse(200, subCategories, 'Sub-Categories fetched successfully.'));
});

export const handleGetSubCategoryById = asyncHandler(async (req, res) => {
  const subCategory = await categoryService.getSubCategoryById(req.params.id);
  return res.status(200).json(new ApiResponse(200, subCategory, 'Sub-Category details fetched successfully.'));
});

export const handleUpdateSubCategory = asyncHandler(async (req, res) => {
  const updated = await categoryService.updateSubCategory(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, updated, 'Sub-Category updated successfully.'));
});

export const handleDeleteSubCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteSubCategory(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Sub-Category deleted successfully.'));
});


// --- DYNAMIC ADDITIONAL FIELD CONTROLLERS ---

export const handleAddAdditionalField = asyncHandler(async (req, res) => {
  const field = await categoryService.addAdditionalField(req.params.subCategoryId, req.body);
  return res.status(201).json(new ApiResponse(201, field, 'Additional field configuration added to sub-category.'));
});

export const handleUpdateAdditionalField = asyncHandler(async (req, res) => {
  const field = await categoryService.updateAdditionalField(req.params.fieldId, req.body);
  return res.status(200).json(new ApiResponse(200, field, 'Additional field updated successfully.'));
});

export const handleDeleteAdditionalField = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteAdditionalField(req.params.fieldId);
  return res.status(200).json(new ApiResponse(200, result, 'Additional field deleted successfully.'));
});
