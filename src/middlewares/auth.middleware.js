import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import { verifyAuthToken } from '../utils/auth.util.js';
import { tokenBlacklist } from '../services/tokenBlacklist.service.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      throw new ApiError(401, 'Authentication token is missing or invalid.');
    }

    if (tokenBlacklist.isRevoked(token)) {
      throw new ApiError(401, 'Token has been revoked due to logout. Please log in again.');
    }

    const decoded = verifyAuthToken(token);

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
    req.tenantId = user.tenantId;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Invalid or expired token. Please log in again.'));
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
    // Restricted actions: DELETE operations, administrative modifications
    if (req.method === 'DELETE') {
      return next(new ApiError(403, 'Employees are not authorized to delete records.'));
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
