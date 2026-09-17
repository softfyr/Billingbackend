import { ApiError } from './apiError.js';

const mobileRegex = /^[6-9]\d{9}$/;

/**
 * 📱 Normalizes and validates Indian 10-digit mobile numbers.
 * Strips country code (+91, 91), leading zeros, spaces, dashes, and parens.
 * 
 * @param {string|number} input - Raw mobile number input
 * @returns {string} Clean 10-digit mobile string (e.g. "9876543210")
 * @throws {ApiError} 400 Bad Request if format is invalid
 */
export const normalizeMobileNumber = (input) => {
  if (!input) {
    throw new ApiError(400, 'Mobile number is required.');
  }

  // Convert to string and strip all non-numeric characters
  let digits = String(input).replace(/\D/g, '');

  // Strip leading 0 if present (e.g. "09876543210" -> "9876543210")
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Strip leading country code 91 if 12 digits (e.g. "919876543210" -> "9876543210")
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  if (!mobileRegex.test(digits)) {
    throw new ApiError(400, `Invalid mobile number '${input}'. Must be a valid 10-digit Indian mobile number.`);
  }

  return digits;
};
