import * as businessService from './business.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseRequestBody } from '../../utils/request.util.js';

export const handleGetVendorDashboard = asyncHandler(async (req, res) => {
  const data = await businessService.getVendorDashboard(req.tenantId);
  return ApiResponse.success(res, data, 'Vendor dashboard data fetched successfully.');
});

export const handleGetBusinessInfo = asyncHandler(async (req, res) => {
  const info = await businessService.getBusinessInfo(req.tenantId);
  return ApiResponse.success(res, info, 'Business info fetched successfully.');
});

export const handleGetVendorProfile = asyncHandler(async (req, res) => {
  const profile = await businessService.getVendorProfile(req.user.id);
  return ApiResponse.success(res, profile, 'Vendor profile fetched successfully.');
});

export const handleCreateBusinessProfile = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);
  const logoInput = req.file || bodyData.businessLogo || bodyData.logo;
  const step = req.query.step || bodyData.step;
  const profile = await businessService.createBusinessProfile(req.tenantId, {
    ...bodyData,
    ...(logoInput && { businessLogo: logoInput }),
    ...(step && { step })
  });
  return ApiResponse.created(res, profile, 'Business store profile created successfully.');
});

export const handleCreateBusinessProfileStep1 = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);
  const profile = await businessService.createBusinessProfileStep1(req.tenantId, bodyData);
  return ApiResponse.created(res, profile, 'Business store profile step 1 saved successfully.');
});

export const handleCreateBusinessProfileStep2 = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);
  const logoInput = req.file || bodyData.businessLogo || bodyData.logo;
  const profile = await businessService.createBusinessProfileStep2(req.tenantId, {
    ...bodyData,
    ...(logoInput && { businessLogo: logoInput })
  });
  return ApiResponse.created(res, profile, 'Business store profile step 2 saved successfully.');
});

export const handleUpdateBusinessInfo = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);
  const logoInput = req.file || bodyData.businessLogo || bodyData.logo;
  const updated = await businessService.updateBusinessInfo(req.tenantId, {
    ...bodyData,
    ...(logoInput && { businessLogo: logoInput })
  });
  return ApiResponse.success(res, updated, 'Business info updated successfully.');
});

