import { Router } from 'express';
import * as businessController from './business.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadSingleImage } from '../../middlewares/upload.middleware.js';
import { createBusinessProfileSchema, step1ProfileSchema, step2ProfileSchema } from './business.validator.js';

const router = Router();

router.use(authenticateToken);

// Dashboard & Profile Info
router.get('/dashboard', businessController.handleGetVendorDashboard);
router.get('/info', businessController.handleGetBusinessInfo);
router.get('/profile', businessController.handleGetVendorProfile);

// Store Profile Setup & Updates (TENANT_ADMIN)
router.post('/create-profile/step-1', requireRole(['TENANT_ADMIN']), validate(step1ProfileSchema), businessController.handleCreateBusinessProfileStep1);
router.post('/create-profile/step-2', requireRole(['TENANT_ADMIN']), uploadSingleImage('businessLogo'), validate(step2ProfileSchema), businessController.handleCreateBusinessProfileStep2);
router.post('/create-profile', requireRole(['TENANT_ADMIN']), uploadSingleImage('businessLogo'), validate(createBusinessProfileSchema), businessController.handleCreateBusinessProfile);
router.put('/info', requireRole(['TENANT_ADMIN']), uploadSingleImage('businessLogo'), validate(createBusinessProfileSchema), businessController.handleUpdateBusinessInfo);

export default router;
