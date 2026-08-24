import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export const getAvailablePackagesForVendor = async () => {
  return await prisma.package.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { amount: 'asc' }
  });
};

export const chooseInitialPackage = async (tenantId, data) => {
  const { packageId, paymentMethod, transactionId } = data || {};

  if (!packageId) {
    throw new ApiError(400, 'Package selection is required.');
  }

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.status !== 'ACTIVE') {
    throw new ApiError(404, 'Selected package not found or inactive.');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ApiError(404, 'Business workspace tenant not found.');

  const startDate = new Date();
  const newExpiry = new Date();
  newExpiry.setMonth(newExpiry.getMonth() + (pkg.durationMonths || 1));

  return await prisma.$transaction(async (tx) => {
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        currentPackageId: pkg.id,
        subscriptionStatus: pkg.isFreeTrial ? 'FREE_TRIAL' : 'UPGRADED',
        subscriptionStartDate: startDate,
        subscriptionExpiryDate: newExpiry
      },
      include: { currentPackage: true }
    });

    const history = await tx.subscriptionHistory.create({
      data: {
        tenantId,
        packageId: pkg.id,
        amount: pkg.amount || 0,
        paymentMethod: paymentMethod || (pkg.isFreeTrial ? 'OTHER' : 'CARD'),
        paymentStatus: 'SUCCESS',
        transactionId: transactionId || (pkg.isFreeTrial ? `FREE_TRIAL_${Date.now()}` : `TXN_${Date.now()}`),
        startDate,
        expiryDate: newExpiry
      },
      include: { package: true }
    });

    return {
      success: true,
      message: 'Subscription package selected successfully.',
      hasSelectedPackage: true,
      isProfileComplete: updatedTenant.isProfileComplete || false,
      redirectUrl: updatedTenant.isProfileComplete ? '/vendor/dashboard' : '/create-business-profile',
      tenant: updatedTenant,
      history
    };
  });
};

export const upgradeVendorSubscription = async (tenantId, data) => {
  const { packageId, paymentMethod, transactionId } = data;

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.status !== 'ACTIVE') {
    throw new ApiError(404, 'Selected package not found or inactive.');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  // Calculate new Expiry Date: Current Expiry (or now) + Package Duration Months
  let startDate = new Date();
  let newExpiry = new Date();
  if (tenant.subscriptionExpiryDate && new Date(tenant.subscriptionExpiryDate) > startDate) {
    startDate = new Date(tenant.subscriptionExpiryDate);
    newExpiry = new Date(tenant.subscriptionExpiryDate);
  }

  newExpiry.setMonth(newExpiry.getMonth() + pkg.durationMonths);

  return await prisma.$transaction(async (tx) => {
    // 1. Update Tenant Subscription Status
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        currentPackageId: pkg.id,
        subscriptionStatus: 'UPGRADED',
        subscriptionStartDate: startDate,
        subscriptionExpiryDate: newExpiry
      },
      include: { currentPackage: true }
    });

    // 2. Log Payment Record
    const history = await tx.subscriptionHistory.create({
      data: {
        tenantId,
        packageId: pkg.id,
        amount: pkg.amount,
        paymentMethod: paymentMethod || 'CARD',
        paymentStatus: 'SUCCESS',
        transactionId: transactionId || `TXN-${Date.now()}`,
        startDate,
        expiryDate: newExpiry
      },
      include: { package: true }
    });

    return { tenant: updatedTenant, history };
  });
};

export const getVendorSubscriptionHistory = async (tenantId) => {
  return await prisma.subscriptionHistory.findMany({
    where: { tenantId },
    include: { package: true },
    orderBy: { createdAt: 'desc' }
  });
};
