import { uploadToCloudinary } from '../../utils/cloudinary.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseRequestBody } from '../../utils/request.util.js';

export const handleUploadImage = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);

  const fileInput = req.file || bodyData.image || bodyData.file || bodyData.base64 || bodyData.businessLogo || bodyData.productImage || bodyData.url;
  
  // Intelligent folder resolution based on input or query parameters
  let targetFolder = req.query.folder || bodyData.folder;
  if (!targetFolder) {
    if ((req.file && (req.file.fieldname === 'businessLogo' || req.file.fieldname === 'logo')) || bodyData.businessLogo) {
      targetFolder = 'billing_saas/logos';
    } else if ((req.file && (req.file.fieldname === 'productImage' || req.file.fieldname === 'image')) || bodyData.productImage) {
      targetFolder = 'billing_saas/products';
    } else {
      targetFolder = 'billing_saas/uploads';
    }
  }

  if (!fileInput) {
    throw new ApiError(400, 'Please provide an image file (multipart/form-data) or an image string (base64/URL) in request body.');
  }

  const result = await uploadToCloudinary(fileInput, targetFolder);

  return ApiResponse.success(res, {
    url: result.url,
    public_id: result.public_id,
    folder: targetFolder
  }, 'Image uploaded to Cloudinary successfully.');
});
