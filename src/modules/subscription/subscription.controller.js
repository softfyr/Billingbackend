import * as subscriptionService from './subscription.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleGetAvailablePackagesForVendor = asyncHandler(async (req, res) => {
  const packages = await subscriptionService.getAvailablePackagesForVendor();
  return ApiResponse.success(res, packages, 'Available packages fetched successfully.');
});

export const handleChooseInitialPackage = asyncHandler(async (req, res) => {
  const result = await subscriptionService.chooseInitialPackage(req.tenantId, req.body);
  return ApiResponse.success(res, result, 'Subscription package selected successfully.');
});

export const handleUpgradeVendorSubscription = asyncHandler(async (req, res) => {
  const result = await subscriptionService.upgradeVendorSubscription(req.tenantId, req.body);
  return ApiResponse.success(res, result, 'Subscription upgraded successfully.');
});

export const handleGetVendorSubscriptionHistory = asyncHandler(async (req, res) => {
  const history = await subscriptionService.getVendorSubscriptionHistory(req.tenantId);
  return ApiResponse.success(res, history, 'Subscription payment history fetched successfully.');
});
