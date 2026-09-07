import { Router } from 'express';
import * as uploadController from './upload.controller.js';
import { authenticateToken } from '../../middlewares/auth.middleware.js';
import { uploadSingleImage } from '../../middlewares/upload.middleware.js';

const router = Router();

router.use(authenticateToken);

// Support field names: 'image', 'file', 'businessLogo', 'productImage'
router.post('/image', uploadSingleImage('image'), uploadController.handleUploadImage);
router.post('/logo', uploadSingleImage('businessLogo'), uploadController.handleUploadImage);
router.post('/product-image', uploadSingleImage('productImage'), uploadController.handleUploadImage);

export default router;
