/**
 * 🛠️ Validation Utility
 * Utility routines for strict numerical and date validation.
 */

/**
 * Validates whether a value is a valid finite number (not NaN, Infinity, or -Infinity).
 * @param {any} val
 * @returns {boolean}
 */
export const isFiniteNumber = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  return Number.isFinite(num);
};

/**
 * Safely parses and validates a date value or returns null if invalid.
 * @param {any} dateVal
 * @returns {Date|null}
 */
export const parseSafeDate = (dateVal) => {
  if (!dateVal) return null;
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? null : parsed;
};
