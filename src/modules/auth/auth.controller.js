import * as authService from './auth.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { tokenBlacklist } from '../../services/tokenBlacklist.service.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const handleSendLoginOTP = asyncHandler(async (req, res) => {
  const result = await authService.sendLoginOTP(req.body);
  return ApiResponse.success(res, result, 'Login OTP sent successfully via SMS.');
});

export const handleVerifyLoginOTP = asyncHandler(async (req, res) => {
  const result = await authService.verifyLoginOTP(req.body);
  if (result.accessToken) {
    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('token', result.accessToken, COOKIE_OPTIONS);
  }
  if (result.refreshToken) {
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  }
  return ApiResponse.success(res, result, 'OTP verified successfully. Login granted.');
});

export const handleAdminLogin = asyncHandler(async (req, res) => {
  const result = await authService.adminLogin(req.body);
  if (result.accessToken) {
    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('token', result.accessToken, COOKIE_OPTIONS);
  }
  if (result.refreshToken) {
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  }
  return ApiResponse.success(res, result, 'Admin credentials verified. Login granted.');
});

export const handleResendOTP = asyncHandler(async (req, res) => {
  const result = await authService.resendOTP(req.body);
  return ApiResponse.success(res, result, 'New OTP resent successfully via SMS.');
});

export const handleRefreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body);
  if (result.accessToken) {
    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('token', result.accessToken, COOKIE_OPTIONS);
  }
  if (result.refreshToken) {
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  }
  return ApiResponse.success(res, result, 'Access token refreshed successfully.');
});


export const handleGetVendorProfile = asyncHandler(async (req, res) => {
  const profile = await authService.getVendorProfile(req.user.id);
  return ApiResponse.success(res, profile, 'Vendor profile fetched successfully.');
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

  return ApiResponse.success(res, { loggedOut: true, clearStorage: true },
      'Logged out successfully. Authentication token revoked.');
});
