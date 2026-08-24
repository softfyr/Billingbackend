import * as packageService from './package.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleCreatePackage = asyncHandler(async (req, res) => {
  const pkg = await packageService.createPackage(req.body);
  return res.status(201).json(new ApiResponse(201, pkg, 'Subscription Package created successfully.'));
});

export const handleGetPackages = asyncHandler(async (req, res) => {
  const packages = await packageService.getPackages();
  return res.status(200).json(new ApiResponse(200, packages, 'Subscription Packages fetched successfully.'));
});

export const handleGetPackageById = asyncHandler(async (req, res) => {
  const pkg = await packageService.getPackageById(req.params.id);
  return res.status(200).json(new ApiResponse(200, pkg, 'Package details fetched successfully.'));
});

export const handleUpdatePackage = asyncHandler(async (req, res) => {
  const pkg = await packageService.updatePackage(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, pkg, 'Package updated successfully.'));
});

export const handleDeletePackage = asyncHandler(async (req, res) => {
  await packageService.deletePackage(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Package deactivated successfully.'));
});
