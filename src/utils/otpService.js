import { prisma } from '../config/prisma.js';
import { ApiError } from './apiError.js';
import { sendSMS } from './sendSms.js';

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 45;
const MAX_VERIFICATION_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Generate a 6-digit OTP, store in database, and send via SMS
 * @param {string} mobileNumber - Recipient phone number
 * @param {string} [purpose='AUTH'] - Purpose of OTP
 * @param {object} [metadata=null] - Extra draft info (e.g. name, email)
 * @param {string} [customMessage=null] - Custom SMS message
 */
export const generateAndSendOTP = async (mobileNumber, purpose = 'AUTH', metadata = null, customMessage = null) => {
  if (!mobileNumber) {
    throw new ApiError(400, 'Mobile Number is required.');
  }

  const cleanMobile = mobileNumber.toString().trim();

  // Check if existing OTP record is under cooldown
  const existingRecord = await prisma.oTPVerification.findUnique({ where: { mobileNumber: cleanMobile } });

  if (existingRecord && existingRecord.lastSentAt) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(existingRecord.lastSentAt).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitTime = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      throw new ApiError(429, `Please wait ${waitTime} seconds before requesting a new OTP.`);
    }
  }

  // Generate 6-digit numeric OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Expiry time set to 5 minutes from now
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Preserve or merge metadata
  const mergedMetadata = metadata
    ? { ...(existingRecord?.metadata || {}), ...metadata }
    : existingRecord?.metadata || null;

  // Save/Update OTP record in database
  await prisma.oTPVerification.upsert({
    where: { mobileNumber: cleanMobile },
    update: {
      otpCode,
      expiresAt,
      isVerified: false,
      attempts: 0,
      lockedUntil: null,
      lastSentAt: new Date(),
      metadata: mergedMetadata
    },
    create: {
      mobileNumber: cleanMobile,
      otpCode,
      expiresAt,
      isVerified: false,
      attempts: 0,
      lockedUntil: null,
      lastSentAt: new Date(),
      metadata: mergedMetadata
    }
  });

  // Construct SMS message body
  const smsBody = customMessage || `Your Billing SaaS verification OTP is ${otpCode}. Valid for 5 minutes. Do not share it with anyone.`;

  // Dispatch SMS via Gateway
  await sendSMS(cleanMobile, smsBody);

  return {
    success: true,
    message: 'OTP generated and sent successfully via SMS.',
    mobileNumber: cleanMobile,
    otpCode,
    expiresAt,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS
  };
};

/**
 * Verify OTP code provided by user with lockout support
 * @param {string} mobileNumber - Recipient phone number
 * @param {string} otpCode - 6-digit OTP code entered by user
 */
export const verifyOTP = async (mobileNumber, otpCode) => {
  if (!mobileNumber || !otpCode) {
    throw new ApiError(400, 'Mobile Number and OTP code are required.');
  }

  const cleanMobile = mobileNumber.toString().trim();
  const cleanOTP = otpCode.toString().trim();

  const record = await prisma.oTPVerification.findUnique({ where: { mobileNumber: cleanMobile } });

  if (!record) {
    throw new ApiError(404, 'No OTP request found for this mobile number. Please register or request an OTP.');
  }

  // 1. Lockout check
  if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
    const remainingLockoutMins = Math.ceil((new Date(record.lockedUntil).getTime() - Date.now()) / (1000 * 60));
    throw new ApiError(429, `Maximum verification attempts reached. Temporary lockout active. Please try again after ${remainingLockoutMins} minute(s) or request a new OTP.`);
  }

  // 2. Expiry check
  if (new Date(record.expiresAt) < new Date()) {
    throw new ApiError(400, 'OTP code has expired. Please click "Resend OTP" to receive a new code.');
  }

  // 3. OTP Code Matching
  if (record.otpCode !== cleanOTP) {
    const newAttempts = record.attempts + 1;
    const isLocked = newAttempts >= MAX_VERIFICATION_ATTEMPTS;
    const lockedUntil = isLocked ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

    await prisma.oTPVerification.update({
      where: { mobileNumber: cleanMobile },
      data: {
        attempts: newAttempts,
        lockedUntil
      }
    });

    if (isLocked) {
      throw new ApiError(429, `Maximum verification attempts (${MAX_VERIFICATION_ATTEMPTS}) exceeded. Temporary lockout applied for ${LOCKOUT_MINUTES} minutes.`);
    } else {
      const attemptsLeft = MAX_VERIFICATION_ATTEMPTS - newAttempts;
      throw new ApiError(400, `Invalid OTP code. ${attemptsLeft} attempt(s) remaining.`);
    }
  }

  // 4. Mark record as verified & reset attempts
  await prisma.oTPVerification.update({
    where: { mobileNumber: cleanMobile },
    data: {
      isVerified: true,
      attempts: 0,
      lockedUntil: null
    }
  });

  return {
    success: true,
    message: 'OTP verified successfully.',
    mobileNumber: cleanMobile,
    isVerified: true,
    metadata: record.metadata
  };
};
