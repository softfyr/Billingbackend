import { Router } from 'express';
import * as employeeController from './employee.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { registerEmployeeSchema } from '../auth/auth.validator.js';

const router = Router();

router.use(authenticateToken);

// All Employee Management endpoints reserved for Vendor Store Owner (TENANT_ADMIN)
router.post('/', requireRole(['TENANT_ADMIN']), validate(registerEmployeeSchema), employeeController.handleCreateEmployee);
router.get('/', requireRole(['TENANT_ADMIN']), employeeController.handleGetEmployees);
router.get('/:id', requireRole(['TENANT_ADMIN']), employeeController.handleGetEmployeeDetails);
router.put('/:id', requireRole(['TENANT_ADMIN']), employeeController.handleUpdateEmployee);
router.put('/:id/status', requireRole(['TENANT_ADMIN']), employeeController.handleUpdateEmployeeStatus);
router.delete('/:id', requireRole(['TENANT_ADMIN']), employeeController.handleDeleteEmployee);

export default router;
