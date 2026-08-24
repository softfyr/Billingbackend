import * as dashboardService from './dashboard.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleGetDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getAdminDashboardData();
  return res.status(200).json(new ApiResponse(200, data, 'Super Admin Dashboard KPIs fetched successfully.'));
});
