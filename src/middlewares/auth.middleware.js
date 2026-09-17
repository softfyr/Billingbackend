import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import { verifyAuthToken, verifyRefreshToken } from '../utils/auth.util.js';
import { tokenBlacklist } from '../services/tokenBlacklist.service.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    } else if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
      token = req.cookies.accessToken || req.cookies.token;
    } else if (req.headers.cookie) {
      const parsedCookies = Object.fromEntries(
        req.headers.cookie.split(';').map(c => {
          const [key, ...val] = c.trim().split('=');
          return [key, val.join('=')];
        })
      );
      token = parsedCookies.accessToken || parsedCookies.token || null;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token || token === 'undefined' || token === 'null' || token === '[object Object]') {
      throw new ApiError(401, 'Authentication token is missing or invalid. Please log in again.');
    }

    if (tokenBlacklist.isRevoked(token)) {
      throw new ApiError(401, 'Token has been revoked due to logout. Please log in again.');
    }

    let decoded;
    try {
      decoded = verifyAuthToken(token);
    } catch (jwtErr) {
      // Check if client accidentally sent a Refresh Token in Authorization header
      try {
        const refreshDecoded = verifyRefreshToken(token);
        if (refreshDecoded && refreshDecoded.tokenType === 'REFRESH') {
          return next(new ApiError(401, 'Refresh token provided where Access token is expected. Please use your accessToken in the Authorization header or request a new token via POST /auth/refresh-token.'));
        }
      } catch (refErr) {
        // Ignored: Not a valid refresh token either
      }
      throw jwtErr;
    }

    if (!decoded || !decoded.userId) {
      throw new ApiError(401, 'Invalid authentication token payload. Please log in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (!user) {
      throw new ApiError(401, 'User account no longer exists.');
    }

    if (user.status === 'SUSPENDED') {
      throw new ApiError(403, 'User account has been suspended.');
    }

    if (user.tenant && user.tenant.accountStatus === 'SUSPENDED') {
      throw new ApiError(403, 'Tenant account has been suspended by SaaS Admin.');
    }

    req.user = user;
    // Strict Tenant Isolation: Only allow x-tenant-id header override for SUPER_ADMIN role.
    // Regular users strictly use their assigned user.tenantId to prevent tenant spoofing.
    if (user.role === 'SUPER_ADMIN') {
      req.tenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'] || user.tenantId || null;
    } else {
      req.tenantId = user.tenantId || null;
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else if (error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Access token has expired. Please refresh your token or log in again.'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Invalid authentication token. Please log in again.'));
    } else {
      next(error);
    }
  }
};

export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized request.'));
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied. Role '${req.user.role}' is not authorized to perform this operation.`));
    }

    next();
  };
};

export const enforceEmployeeRestrictions = (req, res, next) => {
  if (req.user && req.user.role === 'EMPLOYEE') {
    // Restricted actions: DELETE operations, administrative cancellations
    if (req.method === 'DELETE' || req.originalUrl.includes('/cancel') || req.path.includes('/cancel')) {
      return next(new ApiError(403, 'Employees are not authorized to cancel or delete records.'));
    }
  }
  next();
};

/**
 * Subscription Access Middleware
 * - Allows GET (Read-Only) requests even if subscription is expired
 * - Blocks POST, PUT, PATCH, DELETE (Write actions) if subscription is EXPIRED or FREE_TRIAL_ENDED
 */
export const requireActiveSubscription = (req, res, next) => {
  // Super Admin is exempt from tenant subscription restrictions
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const tenant = req.user?.tenant;
  if (!tenant) {
    return next(new ApiError(403, 'No business tenant workspace associated with this user.'));
  }

  // 1. Account Status check
  if (tenant.accountStatus === 'SUSPENDED') {
    return next(new ApiError(403, 'Access denied. Store workspace has been suspended by SaaS Admin.'));
  }

  // 2. Subscription Expiry check
  const isStatusExpired = ['EXPIRED', 'FREE_TRIAL_ENDED'].includes(tenant.subscriptionStatus);
  const isDateExpired = tenant.subscriptionExpiryDate && new Date(tenant.subscriptionExpiryDate) < new Date();

  if (isStatusExpired || isDateExpired) {
    // If request is GET (Read-Only), allow access but attach flags
    if (req.method === 'GET') {
      req.isSubscriptionExpired = true;
      req.isReadOnly = true;
      return next();
    }

    // For WRITE operations (POST, PUT, PATCH, DELETE), block with 403 Forbidden
    return next(new ApiError(403, 'Subscription Plan Expired! Your store subscription has expired. Please renew your package to create bills, add products, or perform write actions.'));
  }

  next();
};

/**
 * Reusable composite middleware combining authentication & role checks
 * Usage: router.use(authGuard('SUPER_ADMIN'))
 */
export const authGuard = (...roles) => [
  authenticateToken,
  requireRole(roles.flat())
];
