import * as dashboardService from './dashboard.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleGetDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getAdminDashboardData();
  return ApiResponse.success(res, data, 'Super Admin Dashboard KPIs fetched successfully.');
});
