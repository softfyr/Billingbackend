import { ApiError } from '../utils/apiError.js';

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  } catch (error) {
    if (error.errors && Array.isArray(error.errors)) {
      const errorMessage = error.errors
        .map(err => {
          const field = err.path.slice(1).join('.');
          return field ? `${field}: ${err.message}` : err.message;
        })
        .join('; ');
      return next(new ApiError(400, `Validation Failed: ${errorMessage}`));
    }
    return next(new ApiError(400, error.message || 'Invalid request payload.'));
  }
};
