import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { generateAndSendOTP, verifyOTP } from '../../utils/otpService.js';
import {
  generateAuthTokens,
  verifyRefreshToken,
  checkSubscriptionExpiry,
  formatUserResponse
} from '../../utils/auth.util.js';
import { createEmployee } from '../employee/employee.service.js';

export const resendOTP = async (data) => {
  const mobileNumber = typeof data === 'string' ? data : (data?.mobileNumber || data?.phone || data?.phoneNumber);

  if (!mobileNumber) {
    throw new ApiError(400, 'Phone number is required to resend OTP.');
  }

  const cleanMobile = mobileNumber.toString().trim().replace(/\D/g, '').slice(-10);
  if (cleanMobile.length !== 10) {
    throw new ApiError(400, 'Phone number must be a valid 10-digit number.');
  }

  const otpResult = await generateAndSendOTP(cleanMobile, 'RESEND');

  return {
    success: true,
    message: 'New OTP generated and sent via SMS.',
    mobileNumber: cleanMobile,
    otpCode: otpResult.otpCode,
    expiresAt: otpResult.expiresAt,
    cooldownSeconds: otpResult.cooldownSeconds
  };
};

export const sendLoginOTP = async (data) => {
  const mobileNumber = typeof data === 'string' ? data : (data?.mobileNumber || data?.phone || data?.phoneNumber);

  if (!mobileNumber) {
    throw new ApiError(400, 'Phone number is required.');
  }

  const cleanMobile = mobileNumber.toString().trim().replace(/\D/g, '').slice(-10);
  if (cleanMobile.length !== 10) {
    throw new ApiError(400, 'Phone number must be a valid 10-digit number.');
  }

  // Lookup phone number in Users table
  const user = await prisma.user.findUnique({
    where: { mobileNumber: cleanMobile },
    include: { tenant: true }
  });

  const isExistingUser = !!user;
  const roleName = user ? (user.role === 'TENANT_ADMIN' ? 'vendor' : (user.role === 'EMPLOYEE' ? 'employee' : 'admin')) : 'vendor';

  // Generate and send OTP via SMS (5-min expiry, resend cooldown)
  const otpRes = await generateAndSendOTP(cleanMobile, 'LOGIN', {
    role: roleName,
    userId: user?.id || null,
    tenantId: user?.tenantId || null
  });

  return {
    success: true,
    message: isExistingUser
      ? `OTP sent successfully to registered phone number. Role identified: ${roleName}`
      : 'OTP sent successfully to mobile number.',
    mobileNumber: cleanMobile,
    isExistingUser,
    role: roleName,
    tenantId: user?.tenantId || null,
    otpCode: otpRes.otpCode,
    expiresAt: otpRes.expiresAt,
    cooldownSeconds: otpRes.cooldownSeconds
  };
};

export const verifyLoginOTP = async (data) => {
  const { mobileNumber: mobileInput, phone, phoneNumber, otpCode: otpInput, otp } = data;
  const rawMobile = mobileInput || phone || phoneNumber;
  const otpCode = otpInput || otp;

  if (!rawMobile || !otpCode) {
    throw new ApiError(400, 'Phone number and 6-digit OTP code are required.');
  }

  const cleanMobile = rawMobile.toString().trim().replace(/\D/g, '').slice(-10);

  // Verify OTP code (handles 5-min expiry, max 5 attempts lockout)
  const verifyRes = await verifyOTP(cleanMobile, otpCode);

  // Fetch User with Tenant & Employee Profile
  let user = await prisma.user.findUnique({
    where: { mobileNumber: cleanMobile },
    include: {
      tenant: {
        include: { currentPackage: true }
      },
      employeeProfile: true
    }
  });

  // If user is not yet created in DB, auto-register new vendor and tenant
  if (!user) {
    const ownerName = (verifyRes.metadata && (verifyRes.metadata.name || verifyRes.metadata.ownerName)) || 'Vendor Owner';
    const email = (verifyRes.metadata && verifyRes.metadata.email) || null;
    const businessName = `${ownerName}'s Store`;
    const defaultPasswordHash = await bcrypt.hash(`OTP_VERIFIED_${cleanMobile}_${Date.now()}`, 10);

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          businessName,
          ownerName,
          email,
          mobileNumber: cleanMobile,
          country: 'India',
          subscriptionStatus: 'FREE_TRIAL',
          accountStatus: 'ACTIVE',
          currentPackageId: null, // No package chosen yet
          subscriptionStartDate: new Date(),
          subscriptionExpiryDate: expiryDate,
          isProfileComplete: false
        }
      });

      const newUser = await tx.user.create({
        data: {
          name: ownerName,
          email,
          mobileNumber: cleanMobile,
          passwordHash: defaultPasswordHash,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
          tenantId: tenant.id
        }
      });

      return { user: newUser, tenant };
    });

    const tokens = generateAuthTokens({
      userId: result.user.id,
      role: 'vendor',
      userRoleEnum: result.user.role,
      tenantId: result.tenant.id
    });

    return formatUserResponse(result.user, result.tenant, {
      success: true,
      message: 'Mobile OTP verified. Vendor registered. Please select a package to proceed.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: 'vendor',
      isExistingUser: false,
      hasSelectedPackage: false,
      isProfileComplete: false,
      redirectUrl: '/choose-package'
    });
  }

  let roleName = 'vendor';
  let redirectUrl = '/vendor/dashboard';
  let isSubscriptionExpired = false;
  let isReadOnly = false;
  let prompt = null;
  let hasSelectedPackage = true;
  let isProfileComplete = false;

  if (user.role === 'TENANT_ADMIN') {
    roleName = 'vendor';
    hasSelectedPackage = !!user.tenant?.currentPackageId;
    isProfileComplete = user.tenant?.isProfileComplete || false;

    if (!hasSelectedPackage) {
      redirectUrl = '/choose-package';
    } else if (!isProfileComplete) {
      redirectUrl = '/create-business-profile';
    } else {
      redirectUrl = '/vendor/dashboard';
    }

    // Account Status check for Vendor
    if (user.status === 'SUSPENDED') {
      throw new ApiError(403, 'Account suspended. Your vendor account has been suspended by SaaS Admin.');
    }
    if (user.tenant && user.tenant.accountStatus === 'SUSPENDED') {
      throw new ApiError(403, 'Account suspended. Store workspace has been suspended by SaaS Admin.');
    }

    // Subscription Status check for Vendor
    const subCheck = checkSubscriptionExpiry(user.tenant);
    isSubscriptionExpired = subCheck.isSubscriptionExpired;
    isReadOnly = subCheck.isReadOnly;
    prompt = subCheck.prompt;

  } else if (user.role === 'EMPLOYEE') {
    roleName = 'employee';
    redirectUrl = '/employee/pos';
    hasSelectedPackage = true;
    isProfileComplete = true;

    // Status check for Employee
    if (user.status === 'SUSPENDED') {
      throw new ApiError(403, 'Account deactivated. Your employee account has been deactivated by store admin.');
    }

    // Parent Tenant checks for Employee
    if (!user.tenant) {
      throw new ApiError(403, 'Employee account is not associated with any store tenant.');
    }

    if (user.tenant.accountStatus === 'SUSPENDED') {
      throw new ApiError(403, 'Access blocked. Parent store workspace is currently suspended by SaaS Admin.');
    }

    const subCheck = checkSubscriptionExpiry(user.tenant);
    isSubscriptionExpired = subCheck.isSubscriptionExpired;
    isReadOnly = subCheck.isReadOnly;
    prompt = subCheck.prompt ? 'Parent store subscription plan has expired. Billing interface is restricted.' : null;

  } else if (user.role === 'SUPER_ADMIN') {
    roleName = 'admin';
    redirectUrl = '/admin/dashboard';
    hasSelectedPackage = true;
    isProfileComplete = true;
  }

  // Issue Access & Refresh JWT Tokens
  const tokens = generateAuthTokens({
    userId: user.id,
    role: roleName,
    userRoleEnum: user.role,
    tenantId: user.tenantId,
    isSubscriptionExpired,
    isReadOnly
  });

  return formatUserResponse(user, user.tenant, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    role: roleName,
    redirectUrl,
    isExistingUser: true,
    hasSelectedPackage,
    isProfileComplete: user.tenant?.isProfileComplete || false,
    isSubscriptionExpired,
    isReadOnly,
    ...(prompt && { prompt })
  });
};

export const adminLogin = async (data) => {
  const { email, password, otpCode } = data;

  if (!email || !password) {
    throw new ApiError(400, 'Admin email address and password are required.');
  }

  const cleanEmail = email.trim().toLowerCase();

  // Find Super Admin user
  let adminUser = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
      role: 'SUPER_ADMIN'
    }
  });

  // Seed / fallback for super admin if none exists
  if (!adminUser && cleanEmail === 'admin@softfyr.com') {
    const hashedPwd = await bcrypt.hash('admin123', 10);
    adminUser = await prisma.user.create({
      data: {
        name: 'SaaS Platform Admin',
        email: 'admin@softfyr.com',
        mobileNumber: '9000000000',
        passwordHash: hashedPwd,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });
  }

  if (!adminUser) {
    throw new ApiError(401, 'Invalid email address or password.');
  }

  if (adminUser.status === 'SUSPENDED') {
    throw new ApiError(403, 'Admin account has been suspended.');
  }

  const isPasswordValid = await bcrypt.compare(password, adminUser.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email address or password.');
  }

  // 2FA Verification (if 2FA otpCode provided or required)
  if (otpCode) {
    await verifyOTP(adminUser.mobileNumber, otpCode);
  }

  const tokens = generateAuthTokens({
    userId: adminUser.id,
    role: 'admin',
    userRoleEnum: adminUser.role,
    tenantId: null
  });

  return {
    success: true,
    message: 'Admin credentials verified. Login granted.',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    role: 'admin',
    redirectUrl: '/admin/dashboard',
    user: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: 'admin',
      status: adminUser.status
    }
  };
};

export const refreshAccessToken = async (data = {}) => {
  const refreshTokenInput = data.refreshToken || data.token;

  if (!refreshTokenInput) {
    throw new ApiError(400, 'Refresh token is required.');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshTokenInput);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token. Please log in again.');
  }

  if (!decoded || decoded.tokenType !== 'REFRESH' || !decoded.userId) {
    throw new ApiError(401, 'Invalid refresh token structure. Please log in again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { tenant: true }
  });

  if (!user || user.status === 'SUSPENDED') {
    throw new ApiError(403, 'Account deactivated or suspended. Please contact admin.');
  }

  if (user.tenant && user.tenant.accountStatus === 'SUSPENDED') {
    throw new ApiError(403, 'Store workspace suspended. Please contact admin.');
  }

  let isSubscriptionExpired = false;
  let isReadOnly = false;
  if (user.tenant) {
    const subCheck = checkSubscriptionExpiry(user.tenant);
    isSubscriptionExpired = subCheck.isSubscriptionExpired;
    isReadOnly = subCheck.isReadOnly;
  }

  const roleName = user.role === 'TENANT_ADMIN' ? 'vendor' : (user.role === 'EMPLOYEE' ? 'employee' : 'admin');

  const tokens = generateAuthTokens({
    userId: user.id,
    role: roleName,
    userRoleEnum: user.role,
    tenantId: user.tenantId,
    isSubscriptionExpired,
    isReadOnly
  });

  return {
    success: true,
    message: 'Access token refreshed successfully.',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
};

export const registerEmployee = async (tenantId, data) => {
  return await createEmployee(tenantId, data);
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
