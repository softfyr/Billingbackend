import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { sendOTPSchema, verifyOTPSchema, adminLoginSchema, registerEmployeeSchema, refreshTokenSchema } from './auth.validator.js';

const router = Router();

// Public Vendor & Employee OTP Login Routes
router.post('/send-otp', validate(sendOTPSchema), authController.handleSendLoginOTP);
router.post('/verify-otp', validate(verifyOTPSchema), authController.handleVerifyLoginOTP);
router.post('/resend-otp', validate(sendOTPSchema), authController.handleResendOTP);
router.post('/refresh-token', validate(refreshTokenSchema), authController.handleRefreshToken);

// Public Admin (Email + Password) Login Route
router.post('/admin/login', validate(adminLoginSchema), authController.handleAdminLogin);

// Protected Auth Routes
router.get('/me', authenticateToken, authController.handleGetVendorProfile);
router.post('/logout', authenticateToken, authController.handleLogout);
router.post('/employee/register', authenticateToken, requireRole(['TENANT_ADMIN']), validate(registerEmployeeSchema), authController.handleRegisterEmployee);

export default router;
