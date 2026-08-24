import * as purchaseService from './purchase.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleCreatePurchaseInvoice = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.createPurchaseInvoice(req.tenantId, req.user.id, req.body);
  const msg = purchase.purchaseStatus === 'DRAFT'
    ? 'Purchase bill saved as DRAFT successfully.'
    : 'Purchase bill created successfully. Inventory stock updated.';
  return res.status(201).json(new ApiResponse(201, purchase, msg));
});

export const handleConfirmPurchaseInvoice = asyncHandler(async (req, res) => {
  const confirmedInvoice = await purchaseService.confirmPurchaseInvoice(req.tenantId, req.user.id, req.params.id);
  return res.status(200).json(new ApiResponse(200, confirmedInvoice, 'Draft purchase bill confirmed successfully. Inventory stock increased.'));
});

export const handleGetPurchaseInvoices = asyncHandler(async (req, res) => {
  const data = await purchaseService.getPurchaseInvoices(req.tenantId, req.query);
  return res.status(200).json(new ApiResponse(200, data, 'Purchase bills list fetched successfully.'));
});

import { exportToExcel, exportToCSV } from '../../utils/export.utility.js';

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
  }

  return res.status(200).json(new ApiResponse(200, exportData, 'Purchase bills export data fetched successfully.'));
});

export const handleGetPurchaseInvoiceDetails = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchaseInvoiceDetails(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, purchase, 'Purchase bill details fetched successfully.'));
});

export const handleRecordPurchaseInvoicePayment = asyncHandler(async (req, res) => {
  const updatedInvoice = await purchaseService.recordPurchaseInvoicePayment(req.tenantId, req.user.id, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, updatedInvoice, 'Supplier payment recorded successfully towards purchase bill.'));
});

export const handleCreatePurchaseReturn = asyncHandler(async (req, res) => {
  const purchaseReturn = await purchaseService.createPurchaseReturn(req.tenantId, req.user.id, req.body);
  return res.status(201).json(new ApiResponse(201, purchaseReturn, 'Purchase return / cancellation processed successfully. Stock updated.'));
});

export const handleGetPurchaseReturns = asyncHandler(async (req, res) => {
  const data = await purchaseService.getPurchaseReturns(req.tenantId, req.query);
  return res.status(200).json(new ApiResponse(200, data, 'Purchase returns list fetched successfully.'));
});

export const handleCancelPurchaseInvoice = asyncHandler(async (req, res) => {
  const cancelledInvoice = await purchaseService.cancelPurchaseInvoice(req.tenantId, req.user.id, req.params.id);
  return res.status(200).json(new ApiResponse(200, cancelledInvoice, 'Purchase bill cancelled successfully. Stock addition reversed.'));
});
