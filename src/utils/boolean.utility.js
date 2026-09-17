/**
 * Safely parses boolean values from various data types (string "true"/"false", number 1/0, boolean).
 * Useful for handling multipart/form-data field inputs.
 *
 * @param {any} val - Input value to parse
 * @param {boolean} defaultValue - Default fallback if val is undefined/null/empty
 * @returns {boolean}
 */
export const parseBoolean = (val, defaultValue = false) => {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const clean = val.trim().toLowerCase();
    if (clean === 'true' || clean === '1' || clean === 'yes') return true;
    if (clean === 'false' || clean === '0' || clean === 'no') return false;
  }
  return Boolean(val);
};
