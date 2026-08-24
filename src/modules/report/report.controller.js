import * as reportService from './report.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleGetSalesReport = asyncHandler(async (req, res) => {
  const report = await reportService.getSalesReport(req.tenantId, req.query);
  return res.status(200).json(new ApiResponse(200, report, 'Sales report generated successfully.'));
});

export const handleExportSalesReportPDF = asyncHandler(async (req, res) => {
  await reportService.generateSalesReportPDF(req.tenantId, req.query, res);
});

export const handleExportSalesReportExcel = asyncHandler(async (req, res) => {
  await reportService.generateSalesReportExcel(req.tenantId, req.query, res);
});
