import * as dashboardService from './dashboard.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleGetGlobalDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getGlobalDashboardData(req.user, req.tenantId);
  return ApiResponse.success(res, data, 'Global dashboard data fetched successfully.');
});
