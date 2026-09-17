import * as inventoryService from './inventory.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { exportToExcel, exportToCSV } from '../../utils/export.utility.js';

export const handleGetInventory = asyncHandler(async (req, res) => {
  const { categoryId, subCategoryId, statusFilter, search } = req.query;
  const items = await inventoryService.getInventory(req.tenantId, { categoryId, subCategoryId, statusFilter, search });
  return ApiResponse.success(res, items, 'Inventory items fetched successfully.');
});

export const handleUpdateStockManual = asyncHandler(async (req, res) => {
  const result = await inventoryService.updateStockManual(req.tenantId, req.user.id, req.body);
  return ApiResponse.success(res, result, 'Stock updated manually successfully.');
});

export const handleReconcileStock = asyncHandler(async (req, res) => {
  const result = await inventoryService.reconcilePhysicalStock(req.tenantId, req.user.id, req.body);
  return ApiResponse.success(res, result, result.message || 'Physical stock reconciliation completed successfully.');
});

export const handleDamageStock = asyncHandler(async (req, res) => {
  const result = await inventoryService.recordDamageStock(req.tenantId, req.user.id, req.body);
  return ApiResponse.success(res, result, 'Damaged stock written off successfully.');
});

export const handleProcessProductReturn = asyncHandler(async (req, res) => {
  const result = await inventoryService.recordLostStock(req.tenantId, req.user.id, req.body);
  return ApiResponse.success(res, result, 'Lost stock written off successfully.');
});

export const handleLostStock = asyncHandler(async (req, res) => {
  const result = await inventoryService.recordLostStock(req.tenantId, req.user.id, req.body);
  return ApiResponse.success(res, result, 'Lost stock written off successfully.');
});

export const handleGetExpiryAlerts = asyncHandler(async (req, res) => {
  const alerts = await inventoryService.getExpiryAlerts(req.tenantId, req.query);
  return ApiResponse.success(res, alerts, 'Expiry alerts fetched successfully.');
});

export const handleExportInventoryLogs = asyncHandler(async (req, res) => {
  const exportData = await inventoryService.exportInventoryLogs(req.tenantId, req.query);
  const format = (req.query.format || 'json').toLowerCase();

  const columns = [
    { header: 'Date & Time', key: 'date', width: 20 },
    { header: 'Product Name', key: 'productName', width: 22 },
    { header: 'SKU Code', key: 'sku', width: 16 },
    { header: 'Previous Stock', key: 'previousStock', width: 15 },
    { header: 'Change (+/-)', key: 'changeQty', width: 14 },
    { header: 'Updated Stock', key: 'updatedStock', width: 15 },
    { header: 'Reason', key: 'reason', width: 18 },
    { header: 'Updated By', key: 'updatedBy', width: 18 }
  ];

  if (format === 'excel' || format === 'xlsx') {
    return await exportToExcel(res, { filename: 'inventory_audit_logs', sheetName: 'Stock Logs', columns, data: exportData });
  } else if (format === 'csv') {
    return exportToCSV(res, { filename: 'inventory_audit_logs', columns, data: exportData });
  }

  return ApiResponse.success(res, exportData, 'Inventory audit logs export dataset generated successfully.');
});

