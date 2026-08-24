import * as tenantService from './tenant.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleGetTenants = asyncHandler(async (req, res) => {
  const { status, search, q } = req.query;
  const tenants = await tenantService.getTenants(status, search || q);
  return res.status(200).json(new ApiResponse(200, tenants, 'Tenants list fetched successfully.'));
});

export const handleGetTenantDetails = asyncHandler(async (req, res) => {
  const tenant = await tenantService.getTenantDetails(req.params.id);
  return res.status(200).json(new ApiResponse(200, tenant, 'Tenant details fetched successfully.'));
});

export const handleUpdateTenantSubscription = asyncHandler(async (req, res) => {
  const updated = await tenantService.updateTenantSubscription(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, updated, 'Tenant subscription updated successfully.'));
});

export const handleUpdateTenantAccountStatus = asyncHandler(async (req, res) => {
  const { accountStatus } = req.body;
  const updated = await tenantService.updateTenantAccountStatus(req.params.id, accountStatus);
  return res.status(200).json(new ApiResponse(200, updated, `Tenant account status updated to ${accountStatus}.`));
});
