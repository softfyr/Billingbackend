import * as supplierService from './supplier.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { exportToExcel, exportToCSV } from '../../utils/export.utility.js';

export const handleCreateSupplier = asyncHandler(async (req, res) => {
  const supplier = await supplierService.createSupplier(req.tenantId, req.body);
  return res.status(201).json(new ApiResponse(201, supplier, 'Supplier registered successfully.'));
});

export const handleGetSuppliers = asyncHandler(async (req, res) => {
  const data = await supplierService.getSuppliers(req.tenantId, req.query);
  return res.status(200).json(new ApiResponse(200, data, 'Suppliers list fetched successfully.'));
});



export const handleExportSuppliers = asyncHandler(async (req, res) => {
  const exportData = await supplierService.exportSuppliers(req.tenantId, req.query);
  const format = (req.query.format || 'json').toLowerCase();

  const columns = [
    { header: 'Supplier Name', key: 'name', width: 22 },
    { header: 'Company Name', key: 'companyName', width: 22 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'Email', key: 'email', width: 22 },
    { header: 'GSTIN', key: 'gstin', width: 18 },
    { header: 'PAN', key: 'pan', width: 14 },
    { header: 'City', key: 'city', width: 15 },
    { header: 'State', key: 'state', width: 15 },
    { header: 'Supplier Type', key: 'supplierType', width: 15 },
    { header: 'Credit Limit (₹)', key: 'creditLimit', width: 16 },
    { header: 'Payment Terms', key: 'paymentTerms', width: 15 },
    { header: 'Total Purchases (₹)', key: 'totalPurchases', width: 20 },
    { header: 'Total Paid (₹)', key: 'totalPaid', width: 18 },
    { header: 'Total Payable (₹)', key: 'totalPayable', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Joining Date', key: 'joiningDate', width: 14 }
  ];

  if (format === 'excel' || format === 'xlsx') {
    return await exportToExcel(res, { filename: 'suppliers_directory', sheetName: 'Suppliers', columns, data: exportData });
  } else if (format === 'csv') {
    return exportToCSV(res, { filename: 'suppliers_directory', columns, data: exportData });
  }

  return res.status(200).json(new ApiResponse(200, exportData, 'Suppliers export dataset generated successfully.'));
});

export const handleImportSuppliers = asyncHandler(async (req, res) => {
  const { suppliers } = req.body || {};
  const result = await supplierService.importSuppliers(req.tenantId, suppliers);
  return res.status(201).json(new ApiResponse(201, result, 'Suppliers bulk imported successfully.'));
});

export const handleGetSupplierDetails = asyncHandler(async (req, res) => {
  const details = await supplierService.getSupplierDetails(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, details, 'Supplier details fetched successfully.'));
});

export const handleGetSupplierLedger = asyncHandler(async (req, res) => {
  const ledger = await supplierService.getSupplierLedger(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, ledger, 'Supplier account ledger generated successfully.'));
});

export const handleRecordSupplierPayment = asyncHandler(async (req, res) => {
  const payment = await supplierService.recordSupplierPayment(req.tenantId, req.user.id, req.params.id, req.body);
  return res.status(201).json(new ApiResponse(201, payment, 'Supplier payment recorded successfully. Dues updated.'));
});

export const handleUpdateSupplier = asyncHandler(async (req, res) => {
  const updated = await supplierService.updateSupplier(req.tenantId, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, updated, 'Supplier details updated successfully.'));
});

export const handleDeleteSupplier = asyncHandler(async (req, res) => {
  await supplierService.deleteSupplier(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Supplier record deleted successfully.'));
});
