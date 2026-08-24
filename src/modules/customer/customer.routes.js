import { Router } from 'express';
import * as customerController from './customer.controller.js';
import { authenticateToken, enforceEmployeeRestrictions } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/lookup', customerController.handleFindOrCreateCustomer);
router.get('/', customerController.handleGetCustomers);
router.get('/export', customerController.handleExportCustomers);
router.get('/:id', customerController.handleGetCustomerDetails);
router.put('/:id', customerController.handleUpdateCustomer);

// Restrict deletion of customers from Employee role
router.delete('/:id', enforceEmployeeRestrictions, customerController.handleDeleteCustomer);

export default router;
