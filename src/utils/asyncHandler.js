/**
 * Higher-order function to handle async errors in Express controllers.
 * Eliminates repetitive try-catch blocks across all controllers.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
