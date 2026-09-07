import multer from 'multer';
import { ApiError } from '../utils/apiError.js';

// Configure Multer in-memory storage so uploaded files are accessible as req.file.buffer
const storage = multer.memoryStorage();

// File filter to allow only image mime types
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only image files (JPEG, PNG, WEBP, GIF, SVG) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max file size limit
    fieldSize: 10 * 1024 * 1024  // 10 MB max form field value size limit
  },
  fileFilter: imageFileFilter
});

/**
 * Middleware to handle optional single image upload.
 * Does not error if no file was uploaded.
 * @param {string} [fieldName='image']
 */
export const uploadSingleImage = (fieldName = 'image') => {
  return (req, res, next) => {
    const anyUpload = upload.any();
    anyUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(400, 'File size too large. Maximum allowed image size is 10MB.'));
        }
        if (err.code === 'LIMIT_FIELD_VALUE') {
          return next(new ApiError(400, 'Form field value too long. Maximum allowed size is 10MB.'));
        }
        return next(new ApiError(400, `Image Upload Error: ${err.message}`));
      } else if (err) {
        return next(err);
      }

      if (req.files && req.files.length > 0) {
        // Prefer exact fieldName match, or pick the first uploaded file
        req.file = req.files.find(f => f.fieldname === fieldName) || req.files[0];
      }
      next();
    });
  };
};

export default upload;
