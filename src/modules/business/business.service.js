import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';

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
    step,
    businessName: bName,
    storeName,
    name,
    business_name,
    businessType,
    category,
    ownerName,
    businessLogo,
    mobileNumber,
    email,
    businessAddress,
    address,
    city,
    state,
    country,
    pincode,
    gstNumber,
    gstin,
    panNumber,
    otherInvoiceInfo,
    invoiceTerms
  } = data || {};

  const cleanMobile = mobileNumber ? mobileNumber.toString().trim().replace(/\D/g, '').slice(-10) : null;
  if (cleanMobile && cleanMobile.length === 10 && cleanMobile !== existingTenant.mobileNumber) {
    throw new ApiError(400, 'Registered mobile number cannot be modified. Your phone number is locked as your primary login identity.');
  }

  const cleanEmail = (email && typeof email === 'string' && email.trim()) ? email.trim().toLowerCase() : null;
  if (cleanEmail && cleanEmail !== existingTenant.email) {
    const existingTenantEmail = await prisma.tenant.findFirst({ where: { email: cleanEmail, NOT: { id: tenantId } } });
    const existingUserEmail = await prisma.user.findFirst({ where: { email: cleanEmail, NOT: { tenantId } } });
    if (existingTenantEmail || existingUserEmail) {
      throw new ApiError(409, 'Email address is already registered with another account.');
    }
  }

  const targetStep = Number(step) || (step === 'step1' ? 1 : (step === 'step2' ? 2 : null));

  const inputOwnerName = ownerName || name;
  const cleanOwnerName = (inputOwnerName && typeof inputOwnerName === 'string' && inputOwnerName.trim())
    ? inputOwnerName.trim()
    : null;

  if (targetStep === 1) {
    // Step 1: Owner Information Setup
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(cleanOwnerName && { ownerName: cleanOwnerName }),
        ...(cleanEmail && { email: cleanEmail }),
        profileStep: 2,
        isProfileComplete: false
      },
      include: { currentPackage: true }
    });

    if (cleanOwnerName || cleanEmail) {
      await prisma.user.updateMany({
        where: { tenantId, role: 'TENANT_ADMIN' },
        data: {
          ...(cleanOwnerName && { name: cleanOwnerName }),
          ...(cleanEmail && { email: cleanEmail })
        }
      });
    }

    const hasSelectedPackage = !!updatedTenant.currentPackageId;
    return {
      ...updatedTenant,
      redirectUrl: '/create-business-profile/step-2',
      profileStep: 2,
      isProfileComplete: false,
      hasSelectedPackage
    };
  }

  // Step 2 / Full Profile Setup & Completion
  const inputBusinessName = bName || storeName || business_name;
  const finalBusinessName = (inputBusinessName && typeof inputBusinessName === 'string' && inputBusinessName.trim())
    ? inputBusinessName.trim()
    : existingTenant.businessName;

  const finalBusinessType = (businessType || category || '').toString().trim();
  const finalAddress = (businessAddress || address || '').toString().trim();
  const finalGst = (gstNumber || gstin || '').toString().trim().toUpperCase();
  const finalInvoiceInfo = (otherInvoiceInfo || invoiceTerms || '').toString().trim();

  // Process Business Logo Upload to Cloudinary if provided
  let uploadedLogoUrl = existingTenant.businessLogo;
  if (businessLogo) {
    const uploadRes = await uploadToCloudinary(businessLogo, 'billing_saas/logos');
    if (uploadRes && uploadRes.url) {
      if (existingTenant.businessLogo && existingTenant.businessLogo !== uploadRes.url) {
        await deleteFromCloudinary(existingTenant.businessLogo);
      }
      uploadedLogoUrl = uploadRes.url;
    }
  }

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      businessName: finalBusinessName || `${cleanOwnerName || existingTenant.ownerName || 'Vendor'}'s Store`,
      ...(finalBusinessType && { businessType: finalBusinessType }),
      ...(uploadedLogoUrl && { businessLogo: uploadedLogoUrl }),
      ...(cleanEmail && { email: cleanEmail }),
      ...(finalAddress && { businessAddress: finalAddress }),
      ...(city && { city: city.toString().trim() }),
      ...(state && { state: state.toString().trim() }),
      ...(country && { country: country.toString().trim() }),
      ...(pincode && { pincode: pincode.toString().trim() }),
      ...(finalGst && { gstNumber: finalGst }),
      ...(panNumber && { panNumber: panNumber.toString().trim().toUpperCase() }),
      ...(finalInvoiceInfo && { otherInvoiceInfo: finalInvoiceInfo }),
      ...(cleanOwnerName && { ownerName: cleanOwnerName }),
      profileStep: 2,
      isProfileComplete: true
    },
    include: { currentPackage: true }
  });

  if (cleanOwnerName || cleanEmail) {
    await prisma.user.updateMany({
      where: { tenantId, role: 'TENANT_ADMIN' },
      data: {
        ...(cleanOwnerName && { name: cleanOwnerName }),
        ...(cleanEmail && { email: cleanEmail })
      }
    });
  }

  const hasSelectedPackage = !!updatedTenant.currentPackageId;
  const redirectUrl = hasSelectedPackage ? '/vendor/dashboard' : '/choose-package';

  return {
    ...updatedTenant,
    redirectUrl,
    profileStep: 2,
    isProfileComplete: true,
    hasSelectedPackage
  };
};

export const createBusinessProfileStep1 = async (tenantId, data = {}) => {
  return createBusinessProfile(tenantId, { ...data, step: 1 });
};

export const createBusinessProfileStep2 = async (tenantId, data = {}) => {
  return createBusinessProfile(tenantId, { ...data, step: 2 });
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
    category,
    ownerName,
    businessLogo,
    mobileNumber,
    email,
    businessAddress,
    address,
    city,
    state,
    country,
    pincode,
    gstNumber,
    gstin,
    panNumber,
    otherInvoiceInfo,
    invoiceTerms
  } = data || {};

  const cleanMobile = mobileNumber ? mobileNumber.toString().trim().replace(/\D/g, '').slice(-10) : null;
  if (cleanMobile && cleanMobile.length === 10 && cleanMobile !== existingTenant.mobileNumber) {
    throw new ApiError(400, 'Registered mobile number cannot be modified. Your phone number is locked as your primary login identity.');
  }

  const cleanEmail = (email && typeof email === 'string' && email.trim()) ? email.trim().toLowerCase() : null;
  if (cleanEmail && cleanEmail !== existingTenant.email) {
    const existingTenantEmail = await prisma.tenant.findFirst({ where: { email: cleanEmail, NOT: { id: tenantId } } });
    const existingUserEmail = await prisma.user.findFirst({ where: { email: cleanEmail, NOT: { tenantId } } });
    if (existingTenantEmail || existingUserEmail) {
      throw new ApiError(409, 'Email address is already registered with another account.');
    }
  }

  const inputBusinessName = bName || storeName || name || business_name;
  const finalBusinessType = (businessType || category || '').toString().trim();
  const finalAddress = (businessAddress || address || '').toString().trim();
  const finalGst = (gstNumber || gstin || '').toString().trim().toUpperCase();
  const finalInvoiceInfo = (otherInvoiceInfo || invoiceTerms || '').toString().trim();

  // Process Business Logo Upload to Cloudinary if provided
  let uploadedLogoUrl = existingTenant.businessLogo;
  if (businessLogo) {
    const uploadRes = await uploadToCloudinary(businessLogo, 'billing_saas/logos');
    if (uploadRes && uploadRes.url) {
      if (existingTenant.businessLogo && existingTenant.businessLogo !== uploadRes.url) {
        await deleteFromCloudinary(existingTenant.businessLogo);
      }
      uploadedLogoUrl = uploadRes.url;
    }
  }

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(inputBusinessName && { businessName: inputBusinessName.toString().trim() }),
      ...(finalBusinessType && { businessType: finalBusinessType }),
      ...(ownerName && { ownerName: ownerName.toString().trim() }),
      ...(uploadedLogoUrl && { businessLogo: uploadedLogoUrl }),
      ...(cleanEmail && { email: cleanEmail }),
      ...(finalAddress && { businessAddress: finalAddress }),
      ...(city && { city: city.toString().trim() }),
      ...(state && { state: state.toString().trim() }),
      ...(country && { country: country.toString().trim() }),
      ...(pincode && { pincode: pincode.toString().trim() }),
      ...(finalGst && { gstNumber: finalGst }),
      ...(panNumber && { panNumber: panNumber.toString().trim().toUpperCase() }),
      ...(finalInvoiceInfo && { otherInvoiceInfo: finalInvoiceInfo }),
      isProfileComplete: true
    },
    include: { currentPackage: true }
  });

  if (ownerName || cleanEmail) {
    await prisma.user.updateMany({
      where: { tenantId, role: 'TENANT_ADMIN' },
      data: {
        ...(ownerName && { name: ownerName.toString().trim() }),
        ...(cleanEmail && { email: cleanEmail })
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
