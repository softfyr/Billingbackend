import * as tenantService from './tenant.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleGetTenants = asyncHandler(async (req, res) => {
  const result = await tenantService.getTenants(req.query);
  return ApiResponse.success(res, result, 'Tenants list fetched successfully.');
});

export const handleExportTenants = asyncHandler(async (req, res) => {
  const buffer = await tenantService.exportTenants(req.query);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="tenants_${Date.now()}.xlsx"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  return res.send(buffer);
});

export const handleGetTenantDetails = asyncHandler(async (req, res) => {
  const tenant = await tenantService.getTenantDetails(req.params.id);
  return ApiResponse.success(res, tenant, 'Tenant details fetched successfully.');
});

export const handleUpdateBusinessInfo = asyncHandler(async (req, res) => {
  const updated = await tenantService.updateBusinessInfo(req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Tenant business information updated successfully.');
});

export const handleUpdateOwnerInfo = asyncHandler(async (req, res) => {
  const updated = await tenantService.updateOwnerInfo(req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Tenant owner information updated successfully.');
});

export const handleUpdateTenantAccountStatus = asyncHandler(async (req, res) => {
  const { accountStatus } = req.body;
  const updated = await tenantService.updateTenantAccountStatus(req.params.id, accountStatus);
  return ApiResponse.success(res, updated, `Tenant account status updated to ${accountStatus}.`);
});

export const handleGetTenantNotes = asyncHandler(async (req, res) => {
  const notes = await tenantService.getTenantNotes(req.params.id);
  return ApiResponse.success(res, notes, 'Tenant notes fetched successfully.');
});

export const handleAddTenantNote = asyncHandler(async (req, res) => {
  const authorName = req.user ? req.user.name : 'Admin';
  const note = await tenantService.addTenantNote(req.params.id, req.body.noteText, authorName);
  return ApiResponse.created(res, note, 'Tenant note added successfully.');
});

export const handleUpdateTenantNote = asyncHandler(async (req, res) => {
  const updated = await tenantService.updateTenantNote(req.params.noteId, req.body.noteText);
  return ApiResponse.success(res, updated, 'Tenant note updated successfully.');
});

export const handleDeleteTenantNote = asyncHandler(async (req, res) => {
  await tenantService.deleteTenantNote(req.params.noteId);
  return ApiResponse.success(res, null, 'Tenant note deleted successfully.');
});

export const handleGetTenantActivityLogs = asyncHandler(async (req, res) => {
  const result = await tenantService.getTenantActivityLogs(req.params.id, req.query);
  return ApiResponse.success(res, result, 'Tenant activity logs fetched successfully.');
});

export const handleGetTenantEmployees = asyncHandler(async (req, res) => {
  const employees = await tenantService.getTenantEmployees(req.params.id);
  return ApiResponse.success(res, employees, 'Tenant employee summary fetched successfully.');
});

export const handleGetTenantPayments = asyncHandler(async (req, res) => {
  const result = await tenantService.getTenantPayments(req.params.id, req.query);
  return ApiResponse.success(res, result, 'Tenant payment history fetched successfully.');
});

export const handleExportTenantPayments = asyncHandler(async (req, res) => {
  const buffer = await tenantService.exportTenantPayments(req.params.id, req.query);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="tenant_payments_${req.params.id}_${Date.now()}.xlsx"`);
  return res.send(buffer);
});

export const handleGetSubscriptionHistory = asyncHandler(async (req, res) => {
  const history = await tenantService.getSubscriptionHistory(req.params.id);
  return ApiResponse.success(res, history, 'Subscription history fetched successfully.');
});

export const handleUpdateTenantSubscription = asyncHandler(async (req, res) => {
  const updated = await tenantService.updateTenantSubscription(req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Tenant subscription updated successfully.');
});

export const handleSubscriptionAction = asyncHandler(async (req, res) => {
  const updated = await tenantService.processSubscriptionAction(req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Subscription action processed successfully.');
});
