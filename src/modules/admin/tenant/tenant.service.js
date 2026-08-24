import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';

export const getTenants = async (statusFilter, searchQuery) => {
  const where = {};

  if (statusFilter && statusFilter !== 'ALL') {
    where.subscriptionStatus = statusFilter;
  }

  if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
    const q = searchQuery.trim();
    where.OR = [
      { businessName: { contains: q, mode: 'insensitive' } },
      { ownerName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { mobileNumber: { contains: q, mode: 'insensitive' } }
    ];
  }

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      currentPackage: true,
      _count: { select: { employees: true, products: true, bills: true, customers: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return tenants.map(tenant => ({
    id: tenant.id,
    businessName: tenant.businessName || `${tenant.ownerName}'s Store`,
    ownerName: tenant.ownerName,
    email: tenant.email,
    mobileNumber: tenant.mobileNumber,
    registrationDate: tenant.createdAt,
    currentPackage: tenant.currentPackage,
    subscriptionStartDate: tenant.subscriptionStartDate,
    subscriptionExpiryDate: tenant.subscriptionExpiryDate,
    subscriptionStatus: tenant.subscriptionStatus,
    accountStatus: tenant.accountStatus,
    isProfileComplete: tenant.isProfileComplete,
    counts: {
      employees: tenant._count.employees,
      products: tenant._count.products,
      bills: tenant._count.bills,
      customers: tenant._count.customers
    }
  }));
};

export const getTenantDetails = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      currentPackage: true,
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      },
      subscriptionHistory: {
        include: { package: true },
        orderBy: { createdAt: 'desc' }
      },
      _count: { select: { employees: true, products: true, bills: true, customers: true } }
    }
  });

  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  return {
    id: tenant.id,
    businessInformation: {
      businessName: tenant.businessName,
      businessType: tenant.businessType,
      businessLogo: tenant.businessLogo,
      businessAddress: tenant.businessAddress,
      city: tenant.city,
      state: tenant.state,
      country: tenant.country,
      pincode: tenant.pincode,
      gstNumber: tenant.gstNumber,
      panNumber: tenant.panNumber,
      otherInvoiceInfo: tenant.otherInvoiceInfo,
      isProfileComplete: tenant.isProfileComplete
    },
    ownerInformation: {
      ownerName: tenant.ownerName,
      email: tenant.email,
      mobileNumber: tenant.mobileNumber
    },
    currentPackage: tenant.currentPackage,
    subscriptionDetails: {
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionStartDate: tenant.subscriptionStartDate,
      subscriptionExpiryDate: tenant.subscriptionExpiryDate
    },
    accountStatus: tenant.accountStatus,
    registrationDate: tenant.createdAt,
    lastActivityDate: tenant.updatedAt,
    counts: {
      employees: tenant._count.employees,
      products: tenant._count.products,
      bills: tenant._count.bills,
      customers: tenant._count.customers
    },
    users: tenant.users,
    paymentHistory: tenant.subscriptionHistory
  };
};

export const updateTenantSubscription = async (tenantId, data = {}) => {
  const {
    packageId,
    extensionDays,
    subscriptionStatus,
    newExpiryDate,
    amount,
    paymentMethod,
    transactionId
  } = data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { currentPackage: true }
  });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  const updateData = {};
  let targetPackage = tenant.currentPackage;

  if (packageId) {
    targetPackage = await prisma.package.findUnique({ where: { id: packageId } });
    if (!targetPackage) throw new ApiError(404, 'Selected package not found.');
    updateData.currentPackageId = targetPackage.id;
  }

  // Fallback to first available package if tenant has no package attached
  if (!targetPackage) {
    targetPackage = await prisma.package.findFirst({ where: { status: 'ACTIVE' } });
    if (targetPackage) {
      updateData.currentPackageId = targetPackage.id;
    }
  }

  if (subscriptionStatus) {
    updateData.subscriptionStatus = subscriptionStatus;
  }

  let finalExpiry = new Date(tenant.subscriptionExpiryDate || Date.now());
  if (newExpiryDate) {
    finalExpiry = new Date(newExpiryDate);
    updateData.subscriptionExpiryDate = finalExpiry;
  } else if (extensionDays) {
    finalExpiry.setDate(finalExpiry.getDate() + parseInt(extensionDays));
    updateData.subscriptionExpiryDate = finalExpiry;
  }

  return await prisma.$transaction(async (tx) => {
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: updateData,
      include: { currentPackage: true }
    });

    // Record Subscription History entry if package is available
    if (targetPackage && (packageId || subscriptionStatus === 'UPGRADED' || amount !== undefined)) {
      await tx.subscriptionHistory.create({
        data: {
          tenantId,
          packageId: targetPackage.id,
          amount: amount !== undefined ? parseFloat(amount) : (targetPackage.amount || 0),
          paymentMethod: paymentMethod || 'OTHER',
          paymentStatus: 'SUCCESS',
          transactionId: transactionId || `ADMIN_UPDATE_${Date.now()}`,
          startDate: updatedTenant.subscriptionStartDate,
          expiryDate: updatedTenant.subscriptionExpiryDate
        }
      });
    }

    return updatedTenant;
  });
};

export const updateTenantAccountStatus = async (tenantId, accountStatus) => {
  if (!['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
    throw new ApiError(400, 'Account status must be either ACTIVE or SUSPENDED.');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  return await prisma.tenant.update({
    where: { id: tenantId },
    data: { accountStatus },
    include: { currentPackage: true }
  });
};
