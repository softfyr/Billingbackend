import * as customerService from './customer.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleFindOrCreateCustomer = asyncHandler(async (req, res) => {
  const { mobileNumber, name, email, address, city, state, pincode } = req.body;
  const result = await customerService.findOrCreateCustomerByMobile(
    req.tenantId,
    mobileNumber,
    name,
    { email, address, city, state, pincode }
  );
  return ApiResponse.success(res, result, 'Customer lookup successful.');
});

export const handleGetCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const customers = await customerService.getCustomers(req.tenantId, search);
  return ApiResponse.success(res, customers, 'Customer list fetched successfully.');
});

export const handleGetCustomerDetails = asyncHandler(async (req, res) => {
  const details = await customerService.getCustomerDetails(req.tenantId, req.params.id);
  return ApiResponse.success(res, details, 'Customer details fetched successfully.');
});

export const handleUpdateCustomer = asyncHandler(async (req, res) => {
  const updated = await customerService.updateCustomer(req.tenantId, req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Customer updated successfully.');
});

export const handleDeleteCustomer = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.tenantId, req.params.id);
  return ApiResponse.success(res, null, 'Customer deleted successfully.');
});

import { exportToExcel, exportToCSV } from '../../utils/export.utility.js';

export const handleExportCustomers = asyncHandler(async (req, res) => {
  const exportData = await customerService.exportCustomers(req.tenantId, req.query.search);
  const format = (req.query.format || 'json').toLowerCase();

  const columns = [
    { header: 'Customer Name', key: 'name', width: 22 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'Email', key: 'email', width: 22 },
    { header: 'City', key: 'city', width: 15 },
    { header: 'State', key: 'state', width: 15 },
    { header: 'Total Invoices', key: 'totalInvoices', width: 14 },
    { header: 'Total Purchased (₹)', key: 'totalPurchaseAmount', width: 18 },
    { header: 'Total Paid (₹)', key: 'totalPaidAmount', width: 16 },
    { header: 'Pending Dues (₹)', key: 'totalDueAmount', width: 16 },
    { header: 'Last Purchase Date', key: 'lastPurchaseDate', width: 16 }
  ];

  if (format === 'excel' || format === 'xlsx') {
    return await exportToExcel(res, { filename: 'customers_directory', sheetName: 'Customers', columns, data: exportData });
  } else if (format === 'csv') {
    return exportToCSV(res, { filename: 'customers_directory', columns, data: exportData });
  }

  return ApiResponse.success(res, exportData, 'Customers export dataset generated successfully.');
});

