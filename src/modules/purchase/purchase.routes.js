import { Router } from 'express';
import * as purchaseController from './purchase.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createPurchaseInvoiceSchema,
  recordPurchasePaymentSchema,
  processPurchaseReturnSchema
} from './purchase.validator.js';

const router = Router();

router.use(authenticateToken);

router.post('/', requireRole(['TENANT_ADMIN']), validate(createPurchaseInvoiceSchema), purchaseController.handleCreatePurchaseInvoice);
router.get('/', purchaseController.handleGetPurchaseInvoices);
router.get('/export', purchaseController.handleExportPurchaseInvoices);

// Purchase Return Routes
router.post('/returns', requireRole(['TENANT_ADMIN']), validate(processPurchaseReturnSchema), purchaseController.handleCreatePurchaseReturn);
router.get('/returns', purchaseController.handleGetPurchaseReturns);

router.get('/:id', purchaseController.handleGetPurchaseInvoiceDetails);
router.post('/:id/confirm', requireRole(['TENANT_ADMIN']), purchaseController.handleConfirmPurchaseInvoice);
router.post('/:id/payments', requireRole(['TENANT_ADMIN']), validate(recordPurchasePaymentSchema), purchaseController.handleRecordPurchaseInvoicePayment);
router.post('/:id/cancel', requireRole(['TENANT_ADMIN']), purchaseController.handleCancelPurchaseInvoice);

export default router;
