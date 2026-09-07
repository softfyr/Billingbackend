import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './auth.controller.js';
import { authenticateToken } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { sendOTPSchema, verifyOTPSchema, adminLoginSchema, refreshTokenSchema } from './auth.validator.js';

const router = Router();

// Rate limiter specifically for OTP & Login endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 30, // Max 30 attempts per IP per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    success: false,
    message: 'Too many authentication/OTP requests from this IP. Please try again after 15 minutes.'
  }
});

// Public Vendor & Employee OTP Login Routes
router.post('/send-otp', authLimiter, validate(sendOTPSchema), authController.handleSendLoginOTP);
router.post('/verify-otp', authLimiter, validate(verifyOTPSchema), authController.handleVerifyLoginOTP);
router.post('/resend-otp', authLimiter, validate(sendOTPSchema), authController.handleResendOTP);
router.post('/refresh-token', validate(refreshTokenSchema), authController.handleRefreshToken);

// Public Admin (Email + Password) Login Route
router.post('/admin/login', authLimiter, validate(adminLoginSchema), authController.handleAdminLogin);

// Protected Auth Routes
router.get('/me', authenticateToken, authController.handleGetVendorProfile);
router.post('/logout', authenticateToken, authController.handleLogout);

export default router;
