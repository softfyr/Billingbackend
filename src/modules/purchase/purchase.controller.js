import * as purchaseService from './purchase.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { exportToExcel, exportToCSV, exportToPDFTable } from '../../utils/export.utility.js';

export const handleCreatePurchaseInvoice = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.createPurchaseInvoice(req.tenantId, req.user.id, req.body);
  const msg = purchase.purchaseStatus === 'DRAFT'
    ? 'Purchase bill saved as DRAFT successfully.'
    : 'Purchase bill created successfully. Inventory stock updated.';
  return ApiResponse.created(res, purchase, msg);
});

export const handleConfirmPurchaseInvoice = asyncHandler(async (req, res) => {
  const confirmedInvoice = await purchaseService.confirmPurchaseInvoice(req.tenantId, req.user.id, req.params.id);
  return ApiResponse.success(res, confirmedInvoice, 'Draft purchase bill confirmed successfully. Inventory stock increased.');
});

export const handleGetPurchaseInvoices = asyncHandler(async (req, res) => {
  const data = await purchaseService.getPurchaseInvoices(req.tenantId, req.query);
  return ApiResponse.success(res, data, 'Purchase bills list fetched successfully.');
});

export const handleExportPurchaseInvoices = asyncHandler(async (req, res) => {
  const exportData = await purchaseService.exportPurchaseInvoices(req.tenantId, req.query);
  const format = (req.query.format || 'json').toLowerCase();

  const columns = [
    { header: 'Purchase Number', key: 'purchaseNumber', width: 20 },
    { header: 'Supplier Invoice No', key: 'supplierInvoiceNumber', width: 20 },
    { header: 'Supplier Name', key: 'supplierName', width: 22 },
    { header: 'Company Name', key: 'companyName', width: 22 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'GSTIN', key: 'gstin', width: 18 },
    { header: 'Invoice Date', key: 'invoiceDate', width: 14 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
    { header: 'Subtotal (₹)', key: 'subtotal', width: 15 },
    { header: 'Tax Amount (₹)', key: 'taxAmount', width: 15 },
    { header: 'Discount (₹)', key: 'discountAmount', width: 15 },
    { header: 'Total Amount (₹)', key: 'totalAmount', width: 18 },
    { header: 'Paid Amount (₹)', key: 'paidAmount', width: 16 },
    { header: 'Due Amount (₹)', key: 'dueAmount', width: 16 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Bill Status', key: 'purchaseStatus', width: 15 },
    { header: 'Items Count', key: 'totalItems', width: 12 }
  ];

  if (format === 'excel' || format === 'xlsx') {
    return await exportToExcel(res, { filename: 'purchase_bills', sheetName: 'Purchase Invoices', columns, data: exportData });
  } else if (format === 'csv') {
    return exportToCSV(res, { filename: 'purchase_bills', columns, data: exportData });
  } else if (format === 'pdf') {
    return await exportToPDFTable(res, { filename: 'purchase_bills', title: 'Purchase Bills Report', columns, data: exportData });
  }

  return ApiResponse.success(res, exportData, 'Purchase bills export data fetched successfully.');
});

export const handleGetPurchaseInvoiceDetails = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchaseInvoiceDetails(req.tenantId, req.params.id);
  return ApiResponse.success(res, purchase, 'Purchase bill details fetched successfully.');
});

export const handleRecordPurchaseInvoicePayment = asyncHandler(async (req, res) => {
  const updatedInvoice = await purchaseService.recordPurchaseInvoicePayment(req.tenantId, req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, updatedInvoice, 'Supplier payment recorded successfully towards purchase bill.');
});

export const handleCreatePurchaseReturn = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    ...(req.params.id && { purchaseInvoiceId: req.params.id })
  };
  const purchaseReturn = await purchaseService.createPurchaseReturn(req.tenantId, req.user.id, payload);
  return ApiResponse.created(res, purchaseReturn, 'Purchase return / cancellation processed successfully. Stock updated.');
});

export const handleGetPurchaseReturns = asyncHandler(async (req, res) => {
  const data = await purchaseService.getPurchaseReturns(req.tenantId, req.query);
  return ApiResponse.success(res, data, 'Purchase returns list fetched successfully.');
});

export const handleCancelPurchaseInvoice = asyncHandler(async (req, res) => {
  const cancelledInvoice = await purchaseService.cancelPurchaseInvoice(req.tenantId, req.user.id, req.params.id);
  return ApiResponse.success(res, cancelledInvoice, 'Purchase bill cancelled successfully. Stock addition reversed.');
});

export const handleUpdatePurchaseInvoice = asyncHandler(async (req, res) => {
  const updatedInvoice = await purchaseService.updatePurchaseInvoice(req.tenantId, req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, updatedInvoice, 'Purchase bill updated successfully.');
});

export const handleDeletePurchaseInvoice = asyncHandler(async (req, res) => {
  const result = await purchaseService.deletePurchaseInvoice(req.tenantId, req.user.id, req.params.id);
  return ApiResponse.success(res, result, 'Purchase bill deleted successfully. Stock & dues adjusted.');
});

export const handleGetPurchaseReturnDetails = asyncHandler(async (req, res) => {
  const returnDetails = await purchaseService.getPurchaseReturnDetails(req.tenantId, req.params.id);
  return ApiResponse.success(res, returnDetails, 'Purchase return details fetched successfully.');
});

export const handleExportPurchaseReturns = asyncHandler(async (req, res) => {
  const exportData = await purchaseService.exportPurchaseReturns(req.tenantId, req.query);
  const format = (req.query.format || 'json').toLowerCase();

  const columns = [
    { header: 'Return Number', key: 'returnNumber', width: 20 },
    { header: 'Purchase Number', key: 'purchaseNumber', width: 20 },
    { header: 'Supplier Name', key: 'supplierName', width: 22 },
    { header: 'Company Name', key: 'companyName', width: 22 },
    { header: 'Return Date', key: 'returnDate', width: 14 },
    { header: 'Return Reason', key: 'returnReason', width: 22 },
    { header: 'Refund Type', key: 'refundType', width: 18 },
    { header: 'Total Return Amount (₹)', key: 'totalReturnAmount', width: 20 },
    { header: 'Refund Amount (₹)', key: 'refundAmount', width: 18 },
    { header: 'Total Items Returned', key: 'totalItemsReturned', width: 18 },
    { header: 'Created By', key: 'createdBy', width: 18 }
  ];

  if (format === 'excel' || format === 'xlsx') {
    return await exportToExcel(res, { filename: 'purchase_returns', sheetName: 'Purchase Returns', columns, data: exportData });
  } else if (format === 'csv') {
    return exportToCSV(res, { filename: 'purchase_returns', columns, data: exportData });
  } else if (format === 'pdf') {
    return await exportToPDFTable(res, { filename: 'purchase_returns', title: 'Purchase Returns Report', columns, data: exportData });
  }

  return ApiResponse.success(res, exportData, 'Purchase returns export data fetched successfully.');
});

export const handleDeletePurchasePayment = asyncHandler(async (req, res) => {
  const result = await purchaseService.deletePurchasePayment(req.tenantId, req.user.id, req.params.paymentId);
  return ApiResponse.success(res, result, 'Supplier payment entry deleted successfully. Supplier balance restored.');
});


