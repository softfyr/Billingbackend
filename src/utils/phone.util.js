/**
 * Utility function to sanitize and normalize phone numbers
 * Returns a clean 10-digit mobile number string or null/empty
 * @param {string|number} phone 
 * @returns {string|null}
 */
export const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  const cleaned = phone.toString().trim().replace(/\D/g, '').slice(-10);
  return cleaned.length === 10 ? cleaned : null;
};
