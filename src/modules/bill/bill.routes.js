import { Router } from 'express';
import * as billController from './bill.controller.js';
import { authenticateToken, enforceEmployeeRestrictions, requireActiveSubscription } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { generateBillSchema, processReturnSchema, cancelBillSchema } from './bill.validator.js';

const router = Router();

// Unauthenticated Public Invoice View
router.get('/public/:id', billController.handleGetPublicBillDetails);

router.use(authenticateToken);
router.use(requireActiveSubscription);

// Accessible to both Vendors and Employees to generate and view bills
router.post('/', validate(generateBillSchema), billController.handleGenerateBill);
router.get('/', billController.handleGetBills);
router.get('/export', billController.handleExportBills);

// Returns management routes (Placed BEFORE /:id to prevent route collision)
router.post('/returns', validate(processReturnSchema), billController.handleProcessProductReturn);
router.get('/returns', billController.handleGetBillReturns);
router.get('/returns/export', billController.handleExportBillReturns);
router.get('/returns/:id', billController.handleGetBillReturnDetails);

// Individual Invoice Management
router.get('/:id', billController.handleGetBillDetails);

// Individual Invoice Returns & Cancellations
router.post('/:id/return', validate(processReturnSchema), billController.handleProcessProductReturn);
router.post('/:id/returns', validate(processReturnSchema), billController.handleProcessProductReturn);

// Restrict cancellation of bills from Employee role
router.post('/:id/cancel', enforceEmployeeRestrictions, validate(cancelBillSchema), billController.handleCancelBill);

export default router;

