import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export const getVendorDashboard = async (tenantId) => {
  const totalCustomers = await prisma.customer.count({ where: { tenantId } });
  const totalBills = await prisma.bill.count({ where: { tenantId } });
  const totalProducts = await prisma.product.count({ where: { tenantId, status: 'ACTIVE' } });
  const totalEmployees = await prisma.employeeProfile.count({ where: { tenantId } });

  // Today's Sales
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaySalesAgg = await prisma.bill.aggregate({
    where: {
      tenantId,
      createdAt: { gte: startOfToday },
      status: { notIn: ['CANCELLED'] }
    },
    _sum: { grandTotal: true }
  });
  const todaySales = todaySalesAgg._sum.grandTotal || 0;

  // Pending / Due Amount
  const dueAgg = await prisma.bill.aggregate({
    where: { tenantId, dueAmount: { gt: 0 }, status: { notIn: ['CANCELLED'] } },
    _sum: { dueAmount: true }
  });
  const pendingDueAmount = dueAgg._sum.dueAmount || 0;

  // Low Stock Products
  const products = await prisma.product.findMany({
    where: { tenantId, status: 'ACTIVE' }
  });
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockLevel).length;

  // Recent Bills
  const recentBills = await prisma.bill.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { customer: { select: { name: true, mobileNumber: true } } }
  });

  return {
    kpis: {
      totalCustomers,
      totalBills,
      todaySales,
      totalProducts,
      lowStockProducts: lowStockCount,
      totalEmployees,
      pendingDueAmount
    },
    recentBills
  };
};

export const createBusinessProfile = async (tenantId, data = {}) => {
  const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existingTenant) {
    throw new ApiError(404, 'Business tenant workspace not found.');
  }

  const {
    businessName: bName,
    storeName,
    name,
    business_name,
    businessType,
    ownerName,
    businessLogo,
    mobileNumber,
    email,
    businessAddress,
    city,
    state,
    country,
    pincode,
    gstNumber,
    panNumber,
    otherInvoiceInfo,
    skipSetup
  } = data || {};

  const inputBusinessName = bName || storeName || name || business_name;
  const finalBusinessName = (inputBusinessName && typeof inputBusinessName === 'string' && inputBusinessName.trim())
    ? inputBusinessName.trim()
    : existingTenant.businessName;

  // Fallback: If package wasn't chosen prior, auto assign default free trial
  let packageIdToAssign = existingTenant.currentPackageId;
  if (!packageIdToAssign) {
    let freeTrialPkg = await prisma.package.findFirst({ where: { isFreeTrial: true, status: 'ACTIVE' } });
    if (!freeTrialPkg) {
      freeTrialPkg = await prisma.package.create({
        data: {
          packageName: 'Free Trial',
          description: 'Standard 30-Day Free Trial Package',
          durationMonths: 1,
          amount: 0,
          isFreeTrial: true,
          status: 'ACTIVE'
        }
      });
    }
    packageIdToAssign = freeTrialPkg.id;
  }

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      businessName: finalBusinessName || `${existingTenant.ownerName || 'Vendor'}'s Store`,
      currentPackageId: packageIdToAssign,
      ...(businessType && { businessType: businessType.trim() }),
      ...(ownerName && { ownerName: ownerName.trim() }),
      ...(businessLogo && { businessLogo }),
      ...(mobileNumber && { mobileNumber }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(businessAddress && { businessAddress: businessAddress.trim() }),
      ...(city && { city: city.trim() }),
      ...(state && { state: state.trim() }),
      ...(country && { country: country.trim() }),
      ...(pincode && { pincode: pincode.trim() }),
      ...(gstNumber && { gstNumber: gstNumber.trim().toUpperCase() }),
      ...(panNumber && { panNumber: panNumber.trim().toUpperCase() }),
      ...(otherInvoiceInfo && { otherInvoiceInfo }),
      isProfileComplete: true
    },
    include: { currentPackage: true }
  });

  // Keep primary User account in sync with Owner Name & Email
  if (ownerName || email) {
    await prisma.user.updateMany({
      where: { tenantId, role: 'TENANT_ADMIN' },
      data: {
        ...(ownerName && { name: ownerName.trim() }),
        ...(email && { email: email.trim().toLowerCase() })
      }
    });
  }

  return {
    ...updatedTenant,
    redirectUrl: '/vendor/dashboard',
    isProfileComplete: true,
    hasSelectedPackage: true
  };
};

export const updateBusinessInfo = async (tenantId, data = {}) => {
  const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existingTenant) {
    throw new ApiError(404, 'Business tenant workspace not found.');
  }

  const {
    businessName: bName,
    storeName,
    name,
    business_name,
    businessType,
    ownerName,
    businessLogo,
    mobileNumber,
    email,
    businessAddress,
    city,
    state,
    country,
    pincode,
    gstNumber,
    panNumber,
    otherInvoiceInfo
  } = data || {};

  const inputBusinessName = bName || storeName || name || business_name;

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(inputBusinessName && { businessName: inputBusinessName.trim() }),
      ...(businessType && { businessType: businessType.trim() }),
      ...(ownerName && { ownerName: ownerName.trim() }),
      ...(businessLogo && { businessLogo }),
      ...(mobileNumber && { mobileNumber }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(businessAddress && { businessAddress: businessAddress.trim() }),
      ...(city && { city: city.trim() }),
      ...(state && { state: state.trim() }),
      ...(country && { country: country.trim() }),
      ...(pincode && { pincode: pincode.trim() }),
      ...(gstNumber && { gstNumber: gstNumber.trim().toUpperCase() }),
      ...(panNumber && { panNumber: panNumber.trim().toUpperCase() }),
      ...(otherInvoiceInfo && { otherInvoiceInfo }),
      isProfileComplete: true
    },
    include: { currentPackage: true }
  });

  if (ownerName || email) {
    await prisma.user.updateMany({
      where: { tenantId, role: 'TENANT_ADMIN' },
      data: {
        ...(ownerName && { name: ownerName.trim() }),
        ...(email && { email: email.trim().toLowerCase() })
      }
    });
  }

  return updatedTenant;
};

export const getBusinessInfo = async (tenantId) => {
  return await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { currentPackage: true }
  });
};

export const getVendorProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      role: true,
      status: true,
      createdAt: true,
      tenant: {
        include: {
          currentPackage: true,
          _count: {
            select: {
              products: { where: { status: 'ACTIVE' } },
              customers: true,
              employees: true,
              bills: true
            }
          }
        }
      }
    }
  });

  if (!user) throw new ApiError(404, 'User profile not found.');

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt
    },
    business: user.tenant ? {
      id: user.tenant.id,
      businessName: user.tenant.businessName,
      ownerName: user.tenant.ownerName,
      email: user.tenant.email,
      mobileNumber: user.tenant.mobileNumber,
      businessLogo: user.tenant.businessLogo,
      businessAddress: user.tenant.businessAddress,
      city: user.tenant.city,
      state: user.tenant.state,
      country: user.tenant.country,
      pincode: user.tenant.pincode,
      gstNumber: user.tenant.gstNumber,
      panNumber: user.tenant.panNumber,
      otherInvoiceInfo: user.tenant.otherInvoiceInfo,
      subscriptionStatus: user.tenant.subscriptionStatus,
      accountStatus: user.tenant.accountStatus,
      subscriptionStartDate: user.tenant.subscriptionStartDate,
      subscriptionExpiryDate: user.tenant.subscriptionExpiryDate,
      currentPackage: user.tenant.currentPackage,
      summary: {
        totalProducts: user.tenant._count.products,
        totalCustomers: user.tenant._count.customers,
        totalEmployees: user.tenant._count.employees,
        totalBills: user.tenant._count.bills
      }
    } : null
  };
};

// --- Tax Management ---
export const createTax = async (tenantId, data) => {
  const { name, percentage, type, status } = data;

  return await prisma.tax.create({
    data: {
      tenantId,
      name,
      percentage: parseFloat(percentage),
      type: type || 'PERCENTAGE',
      status: status || 'ACTIVE'
    }
  });
};

export const getTaxes = async (tenantId) => {
  return await prisma.tax.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' }
  });
};

export const updateTax = async (tenantId, taxId, data) => {
  const tax = await prisma.tax.findFirst({ where: { id: taxId, tenantId } });
  if (!tax) throw new ApiError(404, 'Tax record not found.');

  return await prisma.tax.update({
    where: { id: taxId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.percentage !== undefined && { percentage: parseFloat(data.percentage) }),
      ...(data.type && { type: data.type }),
      ...(data.status && { status: data.status })
    }
  });
};

export const deleteTax = async (tenantId, taxId) => {
  const tax = await prisma.tax.findFirst({ where: { id: taxId, tenantId } });
  if (!tax) throw new ApiError(404, 'Tax record not found.');

  return await prisma.tax.delete({ where: { id: taxId } });
};
