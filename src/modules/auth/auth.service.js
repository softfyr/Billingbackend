import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { cleanPhoneNumber } from '../../utils/phone.util.js';
import { generateAndSendOTP, verifyOTP } from '../../utils/otpService.js';
import {
  generateAuthTokens,
  verifyRefreshToken,
  checkSubscriptionExpiry,
  formatUserResponse
} from '../../utils/auth.util.js';

export const resendOTP = async (data) => {
  const mobileNumber = typeof data === 'string' ? data : (data?.mobileNumber || data?.phone || data?.phoneNumber);

  const cleanMobile = cleanPhoneNumber(mobileNumber);
  if (!cleanMobile) {
    throw new ApiError(400, 'Phone number must be a valid 10-digit number.');
  }

  const otpResult = await generateAndSendOTP(cleanMobile, 'RESEND');

  return {
    success: true,
    message: 'New OTP generated and sent via SMS.',
    mobileNumber: cleanMobile,
    ...(process.env.NODE_ENV === 'development' && { otpCode: otpResult.otpCode }),
    expiresAt: otpResult.expiresAt,
    cooldownSeconds: otpResult.cooldownSeconds
  };
};

export const sendLoginOTP = async (data) => {
  const mobileNumber = typeof data === 'string' ? data : (data?.mobileNumber || data?.phone || data?.phoneNumber);

  const cleanMobile = cleanPhoneNumber(mobileNumber);
  if (!cleanMobile) {
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
    ...(process.env.NODE_ENV === 'development' && { otpCode: otpRes.otpCode }),
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

  const cleanMobile = cleanPhoneNumber(rawMobile);
  if (!cleanMobile) {
    throw new ApiError(400, 'Phone number must be a valid 10-digit number.');
  }

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
    const businessName = (verifyRes.metadata && verifyRes.metadata.businessName) || null;
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
      message: 'Mobile OTP verified. Vendor registered. Please create your business store profile to proceed.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: 'vendor',
      isExistingUser: false,
      hasSelectedPackage: false,
      isProfileComplete: false,
      profileStep: 1,
      redirectUrl: '/create-business-profile/step-1'
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
    const profileStep = user.tenant?.profileStep || 1;

    if (!isProfileComplete) {
      redirectUrl = profileStep === 2 ? '/create-business-profile/step-2' : '/create-business-profile/step-1';
    } else if (!hasSelectedPackage) {
      redirectUrl = '/choose-package';
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

  // Find Super Admin user in Database
  const adminUser = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
      role: 'SUPER_ADMIN'
    }
  });

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

export { getVendorProfile } from '../business/business.service.js';

