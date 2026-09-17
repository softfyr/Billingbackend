import { Router } from 'express';
import * as customerController from './customer.controller.js';
import { authenticateToken, enforceEmployeeRestrictions } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { lookupCustomerSchema, updateCustomerSchema } from './customer.validator.js';

const router = Router();

router.use(authenticateToken);

router.post('/lookup', validate(lookupCustomerSchema), customerController.handleFindOrCreateCustomer);
router.get('/', customerController.handleGetCustomers);
router.get('/export', customerController.handleExportCustomers);
router.get('/:id', customerController.handleGetCustomerDetails);
router.get('/:id/bills', customerController.handleGetCustomerBills);
router.get('/:id/products', customerController.handleGetCustomerPurchasedProducts);
router.get('/:id/ledger', customerController.handleGetCustomerLedger);
router.put('/:id', validate(updateCustomerSchema), customerController.handleUpdateCustomer);

// Restrict deletion of customers from Employee role
router.delete('/:id', enforceEmployeeRestrictions, customerController.handleDeleteCustomer);

export default router;
