import { getAdminDashboardData } from '../admin/dashboard/dashboard.service.js';
import { getVendorDashboard } from '../business/business.service.js';

export const getGlobalDashboardData = async (user, tenantId) => {
  if (user && user.role === 'SUPER_ADMIN') {
    const adminData = await getAdminDashboardData();
    return {
      type: 'SUPER_ADMIN_DASHBOARD',
      scope: 'GLOBAL_SAAS_PLATFORM',
      ...adminData
    };
  }

  const vendorData = await getVendorDashboard(tenantId);
  return {
    type: 'VENDOR_STORE_DASHBOARD',
    scope: 'SINGLE_STORE_TENANT',
    ...vendorData
  };
};
