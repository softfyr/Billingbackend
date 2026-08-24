import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-softfyr-billing-saas';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '-refresh-secret-key');

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate Access Token (Short-lived JWT)
 */
export const generateAccessToken = (payload = {}, expiresIn = ACCESS_TOKEN_EXPIRES_IN) => {
  return jwt.sign({ ...payload, tokenType: 'ACCESS' }, JWT_SECRET, { expiresIn });
};

/**
 * Generate Refresh Token (Long-lived JWT)
 */
export const generateRefreshToken = (payload = {}, expiresIn = REFRESH_TOKEN_EXPIRES_IN) => {
  return jwt.sign({ ...payload, tokenType: 'REFRESH' }, JWT_REFRESH_SECRET, { expiresIn });
};

/**
 * Helper to generate both Access & Refresh tokens
 */
export const generateAuthTokens = (payload = {}) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken
  };
};

/**
 * Generate legacy single auth token (Alias for generateAccessToken)
 */
export const generateAuthToken = (payload = {}, expiresIn = ACCESS_TOKEN_EXPIRES_IN) => {
  return generateAccessToken(payload, expiresIn);
};

/**
 * Verify and decode Access Token
 */
export const verifyAuthToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Verify and decode Refresh Token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

/**
 * Reusable Subscription Expiry & Read-Only status checker for a Tenant
 */
export const checkSubscriptionExpiry = (tenant) => {
  if (!tenant) {
    return { isSubscriptionExpired: false, isReadOnly: false, prompt: null };
  }

  const isStatusExpired = ['EXPIRED', 'FREE_TRIAL_ENDED'].includes(tenant.subscriptionStatus);
  const isDateExpired = tenant.subscriptionExpiryDate && new Date(tenant.subscriptionExpiryDate) < new Date();

  if (isStatusExpired || isDateExpired) {
    return {
      isSubscriptionExpired: true,
      isReadOnly: true,
      prompt: 'Your store subscription plan has expired. Operations are restricted to read-only mode. Please renew your package.'
    };
  }

  return { isSubscriptionExpired: false, isReadOnly: false, prompt: null };
};

/**
 * Standardized user & tenant object formatter for Auth API responses
 */
export const formatUserResponse = (user, tenant = null, extraProps = {}) => {
  return {
    ...extraProps,
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: extraProps.role || user.role
    } : null,
    tenant: tenant ? {
      id: tenant.id,
      businessName: tenant.businessName,
      subscriptionStatus: tenant.subscriptionStatus,
      isProfileComplete: tenant.isProfileComplete,
      currentPackageId: tenant.currentPackageId || null
    } : null
  };
};
