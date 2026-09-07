import * as taxService from './tax.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleCreateTax = asyncHandler(async (req, res) => {
  const tax = await taxService.createTax(req.tenantId, req.body);
  return ApiResponse.created(res, tax, 'Tax created successfully.');
});

export const handleGetTaxes = asyncHandler(async (req, res) => {
  const taxes = await taxService.getTaxes(req.tenantId);
  return ApiResponse.success(res, taxes, 'Taxes fetched successfully.');
});

export const handleGetTaxById = asyncHandler(async (req, res) => {
  const tax = await taxService.getTaxById(req.tenantId, req.params.taxId);
  return ApiResponse.success(res, tax, 'Tax details fetched successfully.');
});

export const handleUpdateTax = asyncHandler(async (req, res) => {
  const tax = await taxService.updateTax(req.tenantId, req.params.taxId, req.body);
  return ApiResponse.success(res, tax, 'Tax updated successfully.');
});

export const handleDeleteTax = asyncHandler(async (req, res) => {
  await taxService.deleteTax(req.tenantId, req.params.taxId);
  return ApiResponse.success(res, null, 'Tax deleted successfully.');
});
