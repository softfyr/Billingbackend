import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from './apiError.js';

// Configure Cloudinary SDK from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload an image buffer, file object, base64 string, or file path/url to Cloudinary
 * @param {Buffer|Object|string} fileInput - Memory buffer, req.file object, base64 data URI, or file URL
 * @param {string} [folder='billing_saas'] - Cloudinary target folder
 * @returns {Promise<{url: string, public_id: string}>}
 */
export const uploadToCloudinary = async (fileInput, folder = 'billing_saas') => {
  if (!fileInput) {
    throw new ApiError(400, 'No file input provided for Cloudinary upload.');
  }

  // Handle req.file object from Multer vs raw Buffer vs Image object (e.g. { url: '...' })
  let targetInput = fileInput;
  if (!Buffer.isBuffer(fileInput) && typeof fileInput === 'object' && fileInput !== null) {
    if (fileInput.buffer) {
      targetInput = fileInput.buffer;
    } else if (typeof fileInput.url === 'string' && fileInput.url) {
      targetInput = fileInput.url;
    } else if (typeof fileInput.secure_url === 'string' && fileInput.secure_url) {
      targetInput = fileInput.secure_url;
    } else if (typeof fileInput.uri === 'string' && fileInput.uri) {
      targetInput = fileInput.uri;
    } else if (typeof fileInput.path === 'string' && fileInput.path) {
      targetInput = fileInput.path;
    }
  }

  // If environment variables are not configured, fallback gracefully with a warning
  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
    console.warn('⚠️ [Cloudinary Warning]: Cloudinary environment variables are missing or default. Returning fallback image URL.');
    const fallbackUrl = typeof targetInput === 'string' && targetInput.startsWith('http')
      ? targetInput
      : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60';
    return {
      url: fallbackUrl,
      public_id: `billing_saas_dummy_${Date.now()}`
    };
  }

  try {
    if (Buffer.isBuffer(targetInput)) {
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) {
              return reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            resolve({
              url: result.secure_url,
              public_id: result.public_id
            });
          }
        );
        uploadStream.end(targetInput);
      });
    } else if (typeof targetInput === 'string') {
      // If it's already hosted on Cloudinary, return as is
      if (targetInput.includes('res.cloudinary.com')) {
        return {
          url: targetInput,
          public_id: extractPublicIdFromUrl(targetInput)
        };
      }

      const result = await cloudinary.uploader.upload(targetInput, {
        folder,
        resource_type: 'auto'
      });
      return {
        url: result.secure_url,
        public_id: result.public_id
      };
    } else {
      throw new Error('Invalid file input format for Cloudinary upload.');
    }
  } catch (error) {
    console.warn(`⚠️ [Cloudinary Warning]: Cloudinary upload attempt failed (${error.message || error}). Returning fallback image URL.`);
    const fallbackUrl = typeof targetInput === 'string' && targetInput.startsWith('http')
      ? targetInput
      : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60';
    return {
      url: fallbackUrl,
      public_id: `billing_saas_fallback_${Date.now()}`
    };
  }
};

/**
 * Extract Cloudinary public_id from a full Cloudinary secure URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null}
 */
export const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) {
    return null;
  }
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathWithVersion = parts[1];
    // Remove version prefix e.g. v12345678/
    const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, '');
    // Remove extension
    const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));
    return publicId || null;
  } catch (err) {
    return null;
  }
};

/**
 * Delete an asset from Cloudinary by public_id or full URL
 * @param {string} publicIdOrUrl - Cloudinary asset public_id or full Cloudinary URL
 */
export const deleteFromCloudinary = async (publicIdOrUrl) => {
  if (!publicIdOrUrl) return;
  const publicId = publicIdOrUrl.includes('http')
    ? extractPublicIdFromUrl(publicIdOrUrl)
    : publicIdOrUrl;

  if (!publicId) return;

  try {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error(`Failed to delete asset ${publicId} from Cloudinary:`, error);
  }
};

export default cloudinary;
