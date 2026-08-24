import * as authService from './auth.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { tokenBlacklist } from '../../services/tokenBlacklist.service.js';

export const handleSendLoginOTP = asyncHandler(async (req, res) => {
  const result = await authService.sendLoginOTP(req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Login OTP sent successfully via SMS.'));
});

export const handleVerifyLoginOTP = asyncHandler(async (req, res) => {
  const result = await authService.verifyLoginOTP(req.body);
  return res.status(200).json(new ApiResponse(200, result, 'OTP verified successfully. Login granted.'));
});

export const handleAdminLogin = asyncHandler(async (req, res) => {
  const result = await authService.adminLogin(req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Admin credentials verified. Login granted.'));
});

export const handleResendOTP = asyncHandler(async (req, res) => {
  const result = await authService.resendOTP(req.body);
  return res.status(200).json(new ApiResponse(200, result, 'New OTP resent successfully via SMS.'));
});

export const handleRefreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Access token refreshed successfully.'));
});

export const handleRegisterEmployee = asyncHandler(async (req, res) => {
  const result = await authService.registerEmployee(req.tenantId, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Employee registered successfully.'));
});

export const handleGetVendorProfile = asyncHandler(async (req, res) => {
  const profile = await authService.getVendorProfile(req.user.id);
  return res.status(200).json(new ApiResponse(200, profile, 'Vendor profile fetched successfully.'));
});

export const handleLogout = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const refreshTokenInput = req.body?.refreshToken;

  if (token) tokenBlacklist.revokeToken(token);
  if (refreshTokenInput) tokenBlacklist.revokeToken(refreshTokenInput);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  res.clearCookie('token', cookieOptions);
  res.clearCookie('accessToken', cookieOptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      { loggedOut: true, clearStorage: true },
      'Logged out successfully. Authentication token revoked.'
    )
  );
});
