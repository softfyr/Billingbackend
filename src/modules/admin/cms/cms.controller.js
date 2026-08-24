import * as cmsService from './cms.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleUpdatePolicy = asyncHandler(async (req, res) => {
  const { type, title, content } = req.body;
  const policy = await cmsService.updatePolicy(type, title, content);
  return res.status(200).json(new ApiResponse(200, policy, 'Policy updated successfully.'));
});

export const handleGetPolicies = asyncHandler(async (req, res) => {
  const policies = await cmsService.getPolicies();
  return res.status(200).json(new ApiResponse(200, policies, 'Policies fetched successfully.'));
});

export const handleUpdateContactInfo = asyncHandler(async (req, res) => {
  const contact = await cmsService.updateContactInfo(req.body);
  return res.status(200).json(new ApiResponse(200, contact, 'Contact info updated successfully.'));
});

export const handleGetContactInfo = asyncHandler(async (req, res) => {
  const contact = await cmsService.getContactInfo();
  return res.status(200).json(new ApiResponse(200, contact, 'Contact info fetched successfully.'));
});
