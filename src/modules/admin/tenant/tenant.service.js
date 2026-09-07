import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';
import ExcelJS from 'exceljs';

/**
 * Log tenant activity event
 */
export const logTenantActivity = async (tenantId, actionType, description, performedBy = 'Admin', ipAddress = null) => {
  try {
    return await prisma.tenantActivityLog.create({
      data: {
        tenantId,
        actionType,
        description,
        performedBy,
        ipAddress
      }
    });
  } catch (error) {
    console.error('Failed to log tenant activity:', error);
  }
};

/**
 * Calculate summary counts for top stat cards
 */
export const getTenantsStats = async () => {
  const [all, freeTrial, freeTrialEnded, upgraded, planExpired] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { subscriptionStatus: 'FREE_TRIAL' } }),
    prisma.tenant.count({ where: { subscriptionStatus: 'FREE_TRIAL_ENDED' } }),
    prisma.tenant.count({ where: { subscriptionStatus: 'UPGRADED' } }),
    prisma.tenant.count({ where: { subscriptionStatus: 'EXPIRED' } })
  ]);

  return {
    all,
    totalTenants: all,
    freeTrial,
    freeTrialEnded,
    upgraded,
    planExpired
  };
};

/**
 * Get paginated & filtered tenants list
 */
export const getTenants = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    packageId,
    subscriptionStatus,
    accountStatus,
    startDate,
    endDate,
    includeStats = 'true'
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (subscriptionStatus && subscriptionStatus !== 'ALL') {
    where.subscriptionStatus = subscriptionStatus;
  }

  if (accountStatus && accountStatus !== 'ALL') {
    where.accountStatus = accountStatus;
  }

  if (packageId && packageId !== 'ALL') {
    where.currentPackageId = packageId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const eod = new Date(endDate);
      eod.setHours(23, 59, 59, 999);
      where.createdAt.lte = eod;
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim();
    const cleanCode = q.replace(/^TEN-/i, '');
    where.OR = [
      { businessName: { contains: q, mode: 'insensitive' } },
      { ownerName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { mobileNumber: { contains: q, mode: 'insensitive' } },
      { id: { contains: cleanCode, mode: 'insensitive' } }
    ];
  }

  const shouldIncludeStats = includeStats !== 'false' && includeStats !== false;

  const [total, tenants, summary] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        currentPackage: true,
        _count: { select: { employees: true, products: true, bills: true, customers: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    shouldIncludeStats ? getTenantsStats() : Promise.resolve(null)
  ]);

  const formattedTenants = tenants.map((tenant, index) => {
    const now = new Date();
    const expiry = tenant.subscriptionExpiryDate ? new Date(tenant.subscriptionExpiryDate) : now;
    const diffTime = expiry - now;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      index: skip + index + 1,
      id: tenant.id,
      tenantCode: `TEN-${tenant.id.slice(-6).toUpperCase()}`,
      businessName: tenant.businessName || `${tenant.ownerName}'s Store`,
      ownerName: tenant.ownerName,
      email: tenant.email || 'N/A',
      mobileNumber: tenant.mobileNumber,
      registrationDate: tenant.createdAt,
      currentPackage: tenant.currentPackage ? tenant.currentPackage.packageName : 'N/A',
      currentPackageDetails: tenant.currentPackage,
      subscriptionStatus: tenant.subscriptionStatus,
      accountStatus: tenant.accountStatus,
      daysRemaining,
      isProfileComplete: tenant.isProfileComplete,
      counts: {
        employees: tenant._count.employees,
        products: tenant._count.products,
        bills: tenant._count.bills,
        customers: tenant._count.customers
      }
    };
  });

  return {
    tenants: formattedTenants,
    summary,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Export filtered tenant list to Excel file buffer
 */
export const exportTenants = async (query = {}) => {
  const { tenants } = await getTenants({ ...query, limit: 10000, page: 1, includeStats: 'false' });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tenants');

  worksheet.columns = [
    { header: 'Tenant ID', key: 'tenantCode', width: 16 },
    { header: 'Business Name', key: 'businessName', width: 28 },
    { header: 'Owner Name', key: 'ownerName', width: 22 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Mobile', key: 'mobileNumber', width: 16 },
    { header: 'Registration Date', key: 'registrationDate', width: 20 },
    { header: 'Current Package', key: 'currentPackage', width: 20 },
    { header: 'Subscription Status', key: 'subscriptionStatus', width: 22 },
    { header: 'Account Status', key: 'accountStatus', width: 16 }
  ];

  // Professional Header Styling
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E293B' }
  };
  headerRow.height = 24;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  tenants.forEach(t => {
    const row = worksheet.addRow({
      tenantCode: t.tenantCode,
      businessName: t.businessName,
      ownerName: t.ownerName,
      email: t.email,
      mobileNumber: t.mobileNumber,
      registrationDate: t.registrationDate ? new Date(t.registrationDate).toLocaleDateString() : '',
      currentPackage: t.currentPackage,
      subscriptionStatus: t.subscriptionStatus,
      accountStatus: t.accountStatus
    });
    row.height = 20;
    row.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Get detailed view for a single tenant
 */
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
      notes: {
        orderBy: { createdAt: 'desc' }
      },
      activityLogs: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      },
      subscriptionHistory: {
        include: { package: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      },
      _count: { select: { employees: true, products: true, bills: true, customers: true } }
    }
  });

  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  const now = new Date();
  const expiry = tenant.subscriptionExpiryDate ? new Date(tenant.subscriptionExpiryDate) : now;
  const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

  return {
    id: tenant.id,
    tenantCode: `TEN-${tenant.id.slice(-6).toUpperCase()}`,
    businessInformation: {
      businessName: tenant.businessName || `${tenant.ownerName}'s Store`,
      businessType: tenant.businessType || 'General Business',
      businessLogo: tenant.businessLogo,
      businessAddress: tenant.businessAddress,
      city: tenant.city,
      state: tenant.state,
      country: tenant.country || 'India',
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
      currentPackageName: tenant.currentPackage ? tenant.currentPackage.packageName : 'Free Trial',
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionStartDate: tenant.subscriptionStartDate,
      subscriptionExpiryDate: tenant.subscriptionExpiryDate,
      daysRemaining,
      autoRenew: true,
      nextBillingDate: tenant.subscriptionExpiryDate
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
    notes: tenant.notes,
    activityLogs: tenant.activityLogs,
    paymentHistory: tenant.subscriptionHistory
  };
};

/**
 * Update tenant business info
 */
export const updateBusinessInfo = async (tenantId, data) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  const isProfileComplete = Boolean(
    (data.businessName !== undefined ? data.businessName : tenant.businessName) &&
    (data.businessAddress !== undefined ? data.businessAddress : tenant.businessAddress) &&
    (data.city !== undefined ? data.city : tenant.city) &&
    (data.state !== undefined ? data.state : tenant.state) &&
    (data.pincode !== undefined ? data.pincode : tenant.pincode)
  );

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...data,
      isProfileComplete
    }
  });

  await logTenantActivity(tenantId, 'PROFILE_UPDATED', 'Updated business profile information.');
  return updated;
};

/**
 * Update tenant owner info
 */
export const updateOwnerInfo = async (tenantId, data) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  if (data.email && data.email !== tenant.email) {
    const existingTenantEmail = await prisma.tenant.findFirst({ where: { email: data.email, NOT: { id: tenantId } } });
    const existingUserEmail = await prisma.user.findFirst({ where: { email: data.email, NOT: { tenantId } } });
    if (existingTenantEmail || existingUserEmail) {
      throw new ApiError(409, 'Email address is already registered with another account.');
    }
  }

  if (data.mobileNumber && data.mobileNumber !== tenant.mobileNumber) {
    const existingTenantMobile = await prisma.tenant.findFirst({ where: { mobileNumber: data.mobileNumber, NOT: { id: tenantId } } });
    const existingUserMobile = await prisma.user.findFirst({ where: { mobileNumber: data.mobileNumber, NOT: { tenantId } } });
    if (existingTenantMobile || existingUserMobile) {
      throw new ApiError(409, 'Mobile number is already registered with another account.');
    }
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data
  });

  if (data.ownerName || data.email || data.mobileNumber) {
    const userData = {};
    if (data.ownerName) userData.name = data.ownerName;
    if (data.email) userData.email = data.email;
    if (data.mobileNumber) userData.mobileNumber = data.mobileNumber;

    await prisma.user.updateMany({
      where: { tenantId, role: 'TENANT_ADMIN' },
      data: userData
    });
  }

  await logTenantActivity(tenantId, 'PROFILE_UPDATED', 'Updated owner contact information.');
  return updated;
};

/**
 * Update tenant account status (ACTIVE / SUSPENDED)
 */
export const updateTenantAccountStatus = async (tenantId, accountStatus) => {
  if (!['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
    throw new ApiError(400, 'Account status must be either ACTIVE or SUSPENDED.');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { accountStatus },
    include: { currentPackage: true }
  });

  await logTenantActivity(
    tenantId,
    'ACCOUNT_STATUS_CHANGED',
    `Account status changed to ${accountStatus}.`
  );

  return updated;
};

/**
 * Tenant Notes CRUD
 */
export const getTenantNotes = async (tenantId) => {
  return await prisma.tenantNote.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });
};

export const addTenantNote = async (tenantId, noteText, authorName = 'Admin') => {
  const note = await prisma.tenantNote.create({
    data: {
      tenantId,
      noteText,
      authorName
    }
  });
  await logTenantActivity(tenantId, 'NOTE_ADDED', 'Added internal admin note.');
  return note;
};

export const updateTenantNote = async (noteId, noteText) => {
  const existing = await prisma.tenantNote.findUnique({ where: { id: noteId } });
  if (!existing) throw new ApiError(404, 'Note not found.');

  return await prisma.tenantNote.update({
    where: { id: noteId },
    data: { noteText }
  });
};

export const deleteTenantNote = async (noteId) => {
  const existing = await prisma.tenantNote.findUnique({ where: { id: noteId } });
  if (!existing) throw new ApiError(404, 'Note not found.');

  return await prisma.tenantNote.delete({ where: { id: noteId } });
};

/**
 * Tenant Activity Logs
 */
export const getTenantActivityLogs = async (tenantId, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const [total, logs] = await Promise.all([
    prisma.tenantActivityLog.count({ where: { tenantId } }),
    prisma.tenantActivityLog.findMany({
      where: { tenantId },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return {
    logs,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Tenant Employees list for Employee Summary tab
 */
export const getTenantEmployees = async (tenantId) => {
  const employees = await prisma.employeeProfile.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
          role: true,
          status: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return employees.map(emp => ({
    id: emp.id,
    userId: emp.userId,
    name: emp.user?.name || 'N/A',
    email: emp.user?.email || 'N/A',
    mobileNumber: emp.user?.mobileNumber || 'N/A',
    role: emp.user?.role || 'EMPLOYEE',
    status: emp.user?.status || 'ACTIVE',
    monthlySalary: emp.monthlySalary,
    joiningDate: emp.createdAt
  }));
};

/**
 * Tenant Payment History (Paginated & Filterable)
 */
export const getTenantPayments = async (tenantId, query = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    paymentMethod,
    packageId,
    startDate,
    endDate
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNum - 1) * limitNum;

  const where = { tenantId };

  if (status && status !== 'ALL') {
    where.paymentStatus = status;
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    where.paymentMethod = paymentMethod;
  }

  if (packageId && packageId !== 'ALL') {
    where.packageId = packageId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const eod = new Date(endDate);
      eod.setHours(23, 59, 59, 999);
      where.createdAt.lte = eod;
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim();
    where.OR = [
      { transactionId: { contains: q, mode: 'insensitive' } },
      { package: { packageName: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [total, payments] = await Promise.all([
    prisma.subscriptionHistory.count({ where }),
    prisma.subscriptionHistory.findMany({
      where,
      skip,
      take: limitNum,
      include: { package: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const formattedPayments = payments.map((p, idx) => ({
    index: skip + idx + 1,
    id: p.id,
    transactionId: p.transactionId || `TXN${100000 + idx}`,
    date: p.createdAt,
    packageName: p.package ? p.package.packageName : 'Custom Plan',
    billingCycle: p.billingCycle || 'Monthly',
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paymentGateway: p.paymentGateway || 'Razorpay',
    status: p.paymentStatus,
    startDate: p.startDate,
    expiryDate: p.expiryDate,
    remarks: p.remarks
  }));

  return {
    payments: formattedPayments,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Export Tenant Payments
 */
export const exportTenantPayments = async (tenantId, query = {}) => {
  const { payments } = await getTenantPayments(tenantId, { ...query, limit: 10000, page: 1 });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payment History');

  worksheet.columns = [
    { header: 'Transaction ID', key: 'transactionId', width: 20 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Package', key: 'packageName', width: 20 },
    { header: 'Billing Cycle', key: 'billingCycle', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Payment Method', key: 'paymentMethod', width: 15 },
    { header: 'Payment Gateway', key: 'paymentGateway', width: 18 },
    { header: 'Status', key: 'status', width: 15 }
  ];

  payments.forEach(p => {
    worksheet.addRow({
      transactionId: p.transactionId,
      date: p.date ? new Date(p.date).toLocaleString() : '',
      packageName: p.packageName,
      billingCycle: p.billingCycle,
      amount: `₹${p.amount}`,
      paymentMethod: p.paymentMethod,
      paymentGateway: p.paymentGateway,
      status: p.status
    });
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Dedicated Subscription Quick Actions
 */

// General subscription update
export const updateTenantSubscription = async (tenantId, data = {}) => {
  const {
    packageId,
    extensionDays,
    subscriptionStatus,
    newExpiryDate,
    amount,
    paymentMethod,
    transactionId,
    remarks,
    actionType = 'SUBSCRIPTION_UPDATED'
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

  if (subscriptionStatus) {
    updateData.subscriptionStatus = subscriptionStatus;
  }

  let finalExpiry = new Date(tenant.subscriptionExpiryDate || Date.now());
  if (newExpiryDate) {
    finalExpiry = new Date(newExpiryDate);
    updateData.subscriptionExpiryDate = finalExpiry;
  } else if (extensionDays) {
    finalExpiry.setDate(finalExpiry.getDate() + parseInt(extensionDays, 10));
    updateData.subscriptionExpiryDate = finalExpiry;
  } else if (packageId && targetPackage) {
    const now = new Date();
    const baseDate = (tenant.subscriptionExpiryDate && new Date(tenant.subscriptionExpiryDate) > now)
      ? new Date(tenant.subscriptionExpiryDate)
      : now;
    const monthsToAdd = targetPackage.durationMonths || 1;
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
    finalExpiry = baseDate;
    updateData.subscriptionExpiryDate = finalExpiry;
  }

  return await prisma.$transaction(async (tx) => {
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: updateData,
      include: { currentPackage: true }
    });

    if (targetPackage) {
      await tx.subscriptionHistory.create({
        data: {
          tenantId,
          packageId: targetPackage.id,
          actionType,
          actionBy: 'Admin',
          remarks: remarks || `Subscription updated by admin.`,
          billingCycle: targetPackage.durationMonths === 12 ? 'Yearly' : targetPackage.durationMonths === 1 ? 'Monthly' : 'Free Trial',
          amount: amount !== undefined ? parseFloat(amount) : (targetPackage.amount || 0),
          paymentMethod: paymentMethod || 'OTHER',
          paymentGateway: 'Razorpay',
          paymentStatus: 'SUCCESS',
          transactionId: transactionId || `TXN_${Date.now()}`,
          startDate: updatedTenant.subscriptionStartDate,
          expiryDate: updatedTenant.subscriptionExpiryDate
        }
      });
    }

    await logTenantActivity(
      tenantId,
      actionType,
      remarks || `Updated subscription to ${targetPackage ? targetPackage.packageName : 'Package'}.`
    );

    return updatedTenant;
  });
};

// Unified Subscription Action Handler
export const processSubscriptionAction = async (tenantId, body = {}) => {
  const { action, packageId, days, extensionDays, newExpiryDate, remarks } = body;
  const numDays = days || extensionDays;

  switch (action) {
    case 'ASSIGN':
      return await assignPackage(tenantId, packageId, remarks);
    case 'UPGRADE':
      return await upgradePackage(tenantId, packageId, remarks);
    case 'EXTEND_TRIAL':
      return await extendFreeTrial(tenantId, numDays || 15, remarks);
    case 'EXTEND_SUBSCRIPTION':
      return await extendSubscription(tenantId, numDays || 30, remarks);
    case 'CHANGE_EXPIRY':
      return await changeExpiryDate(tenantId, newExpiryDate, remarks);
    case 'ACTIVATE':
      return await activateSubscription(tenantId, remarks);
    default:
      return await updateTenantSubscription(tenantId, body);
  }
};

// Assign Package
export const assignPackage = async (tenantId, packageId, remarks) => {
  return await updateTenantSubscription(tenantId, {
    packageId,
    subscriptionStatus: 'UPGRADED',
    actionType: 'PACKAGE_ASSIGNED',
    remarks: remarks || 'Assigned new package by Admin'
  });
};

// Upgrade Package
export const upgradePackage = async (tenantId, packageId, remarks) => {
  return await updateTenantSubscription(tenantId, {
    packageId,
    subscriptionStatus: 'UPGRADED',
    actionType: 'PACKAGE_UPGRADED',
    remarks: remarks || 'Upgraded package by Admin'
  });
};

// Extend Free Trial
export const extendFreeTrial = async (tenantId, days = 15, remarks) => {
  return await updateTenantSubscription(tenantId, {
    extensionDays: days,
    subscriptionStatus: 'FREE_TRIAL',
    actionType: 'TRIAL_EXTENDED',
    remarks: remarks || `Free trial extended by ${days} days.`
  });
};

// Extend Subscription
export const extendSubscription = async (tenantId, days = 30, remarks) => {
  return await updateTenantSubscription(tenantId, {
    extensionDays: days,
    actionType: 'SUBSCRIPTION_EXTENDED',
    remarks: remarks || `Subscription extended by ${days} days.`
  });
};

// Change Expiry Date
export const changeExpiryDate = async (tenantId, newExpiryDate, remarks) => {
  return await updateTenantSubscription(tenantId, {
    newExpiryDate,
    actionType: 'EXPIRY_CHANGED',
    remarks: remarks || `Subscription expiry date changed to ${newExpiryDate}.`
  });
};

// Activate Subscription
export const activateSubscription = async (tenantId, remarks) => {
  return await updateTenantSubscription(tenantId, {
    subscriptionStatus: 'UPGRADED',
    actionType: 'SUBSCRIPTION_ACTIVATED',
    remarks: remarks || 'Activated subscription by Admin'
  });
};

// Get Subscription Timeline History
export const getSubscriptionHistory = async (tenantId) => {
  const history = await prisma.subscriptionHistory.findMany({
    where: { tenantId },
    include: { package: true },
    orderBy: { createdAt: 'desc' }
  });

  return history.map(item => ({
    id: item.id,
    date: item.createdAt,
    action: item.actionType || 'Subscription Updated',
    package: item.package ? item.package.packageName : 'Free Trial',
    duration: item.package ? `${item.package.durationMonths} Months` : '15 Days',
    by: item.actionBy || 'System',
    remarks: item.remarks || (item.paymentStatus === 'SUCCESS' ? 'Payment Successful' : 'Action Performed'),
    amount: item.amount,
    transactionId: item.transactionId
  }));
};
