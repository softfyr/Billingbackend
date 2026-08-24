import { Router } from 'express';
import * as billController from './bill.controller.js';
import { authenticateToken, enforceEmployeeRestrictions, requireActiveSubscription } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireActiveSubscription);

// Accessible to both Vendors and Employees to generate and view bills
router.post('/', billController.handleGenerateBill);
router.get('/', billController.handleGetBills);
router.get('/export', billController.handleExportBills);
router.get('/:id', billController.handleGetBillDetails);

// Returns & Cancellations
router.post('/:id/return', billController.handleProcessProductReturn);

// Restrict deletion/cancellation of bills from Employee role
router.post('/:id/cancel', enforceEmployeeRestrictions, billController.handleCancelBill);

export default router;
