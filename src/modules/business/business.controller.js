import * as businessService from './business.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleGetVendorDashboard = asyncHandler(async (req, res) => {
  const data = await businessService.getVendorDashboard(req.tenantId);
  return res.status(200).json(new ApiResponse(200, data, 'Vendor dashboard data fetched successfully.'));
});

export const handleGetBusinessInfo = asyncHandler(async (req, res) => {
  const info = await businessService.getBusinessInfo(req.tenantId);
  return res.status(200).json(new ApiResponse(200, info, 'Business info fetched successfully.'));
});

export const handleGetVendorProfile = asyncHandler(async (req, res) => {
  const profile = await businessService.getVendorProfile(req.user.id);
  return res.status(200).json(new ApiResponse(200, profile, 'Vendor profile fetched successfully.'));
});

export const handleCreateBusinessProfile = asyncHandler(async (req, res) => {
  let bodyData = req.body || {};
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) {}
  }
  const profile = await businessService.createBusinessProfile(req.tenantId, bodyData);
  return res.status(201).json(new ApiResponse(201, profile, 'Business store profile created successfully.'));
});

export const handleUpdateBusinessInfo = asyncHandler(async (req, res) => {
  let bodyData = req.body || {};
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) {}
  }
  const updated = await businessService.updateBusinessInfo(req.tenantId, bodyData);
  return res.status(200).json(new ApiResponse(200, updated, 'Business info updated successfully.'));
});

export const handleCreateTax = asyncHandler(async (req, res) => {
  const tax = await businessService.createTax(req.tenantId, req.body);
  return res.status(201).json(new ApiResponse(201, tax, 'Tax created successfully.'));
});

export const handleGetTaxes = asyncHandler(async (req, res) => {
  const taxes = await businessService.getTaxes(req.tenantId);
  return res.status(200).json(new ApiResponse(200, taxes, 'Taxes fetched successfully.'));
});

export const handleUpdateTax = asyncHandler(async (req, res) => {
  const tax = await businessService.updateTax(req.tenantId, req.params.taxId, req.body);
  return res.status(200).json(new ApiResponse(200, tax, 'Tax updated successfully.'));
});

export const handleDeleteTax = asyncHandler(async (req, res) => {
  await businessService.deleteTax(req.tenantId, req.params.taxId);
  return res.status(200).json(new ApiResponse(200, null, 'Tax deleted successfully.'));
});
