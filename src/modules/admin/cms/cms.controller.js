import * as cmsService from './cms.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleUpdatePolicy = asyncHandler(async (req, res) => {
  const { type, title, content } = req.body;
  const policy = await cmsService.updatePolicy(type, title, content);
  return ApiResponse.success(res, policy, 'Policy updated successfully.');
});

export const handleGetPolicies = asyncHandler(async (req, res) => {
  const policies = await cmsService.getPolicies();
  return ApiResponse.success(res, policies, 'Policies fetched successfully.');
});

export const handleUpdateContactInfo = asyncHandler(async (req, res) => {
  const contact = await cmsService.updateContactInfo(req.body);
  return ApiResponse.success(res, contact, 'Contact info updated successfully.');
});

export const handleGetContactInfo = asyncHandler(async (req, res) => {
  const contact = await cmsService.getContactInfo();
  return ApiResponse.success(res, contact, 'Contact info fetched successfully.');
});
