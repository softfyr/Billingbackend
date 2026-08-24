import { Router } from 'express';
import * as subscriptionController from './subscription.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { choosePackageSchema, upgradeSubscriptionSchema } from './subscription.validator.js';

const router = Router();

router.use(authenticateToken);

router.get('/packages', subscriptionController.handleGetAvailablePackagesForVendor);

// Package Selection during Onboarding
router.post('/choose-package', requireRole(['TENANT_ADMIN']), validate(choosePackageSchema), subscriptionController.handleChooseInitialPackage);
router.post('/select-package', requireRole(['TENANT_ADMIN']), validate(choosePackageSchema), subscriptionController.handleChooseInitialPackage);

// Subscriptions upgrade reserved for Vendor TENANT_ADMIN
router.post('/upgrade', requireRole(['TENANT_ADMIN']), validate(upgradeSubscriptionSchema), subscriptionController.handleUpgradeVendorSubscription);

router.get('/history', subscriptionController.handleGetVendorSubscriptionHistory);

export default router;
