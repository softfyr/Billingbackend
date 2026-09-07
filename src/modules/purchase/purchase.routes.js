import { Router } from 'express';
import * as purchaseController from './purchase.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
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
router.get('/returns/export', purchaseController.handleExportPurchaseReturns);
router.get('/returns/:id', purchaseController.handleGetPurchaseReturnDetails);

// Payments management
router.delete('/payments/:paymentId', requireRole(['TENANT_ADMIN']), purchaseController.handleDeletePurchasePayment);

// Purchase Invoice Individual Management Routes
router.get('/:id', purchaseController.handleGetPurchaseInvoiceDetails);
router.put('/:id', requireRole(['TENANT_ADMIN']), validate(updatePurchaseInvoiceSchema), purchaseController.handleUpdatePurchaseInvoice);
router.delete('/:id', requireRole(['TENANT_ADMIN']), purchaseController.handleDeletePurchaseInvoice);
router.post('/:id/confirm', requireRole(['TENANT_ADMIN']), purchaseController.handleConfirmPurchaseInvoice);
router.post('/:id/payments', requireRole(['TENANT_ADMIN']), validate(recordPurchasePaymentSchema), purchaseController.handleRecordPurchaseInvoicePayment);
router.post('/:id/cancel', requireRole(['TENANT_ADMIN']), purchaseController.handleCancelPurchaseInvoice);
router.post('/:id/return', requireRole(['TENANT_ADMIN']), purchaseController.handleCreatePurchaseReturn);
router.post('/:id/returns', requireRole(['TENANT_ADMIN']), purchaseController.handleCreatePurchaseReturn);

export default router;

