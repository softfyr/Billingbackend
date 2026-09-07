import * as packageService from './package.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleCreatePackage = asyncHandler(async (req, res) => {
  const pkg = await packageService.createPackage(req.body);
  return ApiResponse.created(res, pkg, 'Subscription Package created successfully.');
});

export const handleGetPackages = asyncHandler(async (req, res) => {
  const packages = await packageService.getPackages();
  return ApiResponse.success(res, packages, 'Subscription Packages fetched successfully.');
});

export const handleGetPackageById = asyncHandler(async (req, res) => {
  const pkg = await packageService.getPackageById(req.params.id);
  return ApiResponse.success(res, pkg, 'Package details fetched successfully.');
});

export const handleUpdatePackage = asyncHandler(async (req, res) => {
  const pkg = await packageService.updatePackage(req.params.id, req.body);
  return ApiResponse.success(res, pkg, 'Package updated successfully.');
});

export const handleDeletePackage = asyncHandler(async (req, res) => {
  await packageService.deletePackage(req.params.id);
  return ApiResponse.success(res, null, 'Package deactivated successfully.');
});
