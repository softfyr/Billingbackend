import { Router } from 'express';
import * as tenantController from './tenant.controller.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { updateTenantSubscriptionSchema, updateTenantStatusSchema } from './tenant.validator.js';

const router = Router();

router.get('/', tenantController.handleGetTenants);
router.get('/:id', tenantController.handleGetTenantDetails);
router.put('/:id/subscription', validate(updateTenantSubscriptionSchema), tenantController.handleUpdateTenantSubscription);
router.put('/:id/status', validate(updateTenantStatusSchema), tenantController.handleUpdateTenantAccountStatus);

export default router;
