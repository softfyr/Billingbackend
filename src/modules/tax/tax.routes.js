import { Router } from 'express';
import * as taxController from './tax.controller.js';
import { authenticateToken, requireRole, enforceEmployeeRestrictions } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createTaxSchema, updateTaxSchema } from './tax.validator.js';

const router = Router();

router.use(authenticateToken);

// Tax Management Routes
router.post('/', requireRole(['TENANT_ADMIN']), validate(createTaxSchema), taxController.handleCreateTax);
router.get('/', taxController.handleGetTaxes);
router.get('/:taxId', taxController.handleGetTaxById);
router.put('/:taxId', requireRole(['TENANT_ADMIN']), validate(updateTaxSchema), taxController.handleUpdateTax);
router.delete('/:taxId', requireRole(['TENANT_ADMIN']), enforceEmployeeRestrictions, taxController.handleDeleteTax);

export default router;
