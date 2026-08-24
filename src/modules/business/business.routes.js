import { Router } from 'express';
import * as businessController from './business.controller.js';
import { authenticateToken, requireRole, enforceEmployeeRestrictions } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createBusinessProfileSchema, createTaxSchema } from './business.validator.js';

const router = Router();

router.use(authenticateToken);

// Dashboard & Profile Info
router.get('/dashboard', businessController.handleGetVendorDashboard);
router.get('/info', businessController.handleGetBusinessInfo);
router.get('/profile', businessController.handleGetVendorProfile);

// Store Profile Setup & Updates (TENANT_ADMIN)
router.post('/create-profile', requireRole(['TENANT_ADMIN']), validate(createBusinessProfileSchema), businessController.handleCreateBusinessProfile);
router.put('/info', requireRole(['TENANT_ADMIN']), validate(createBusinessProfileSchema), businessController.handleUpdateBusinessInfo);

// Tax Management
router.post('/taxes', requireRole(['TENANT_ADMIN']), validate(createTaxSchema), businessController.handleCreateTax);
router.get('/taxes', businessController.handleGetTaxes);
router.put('/taxes/:taxId', requireRole(['TENANT_ADMIN']), businessController.handleUpdateTax);
router.delete('/taxes/:taxId', requireRole(['TENANT_ADMIN']), enforceEmployeeRestrictions, businessController.handleDeleteTax);

export default router;
