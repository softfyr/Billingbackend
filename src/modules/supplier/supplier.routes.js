import { Router } from 'express';
import * as supplierController from './supplier.controller.js';
import { authenticateToken, requireRole, enforceEmployeeRestrictions } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  recordSupplierPaymentSchema,
  importSuppliersSchema
} from './supplier.validator.js';

const router = Router();

router.use(authenticateToken);

// Supplier Management Routes
router.post('/', requireRole(['TENANT_ADMIN']), validate(createSupplierSchema), supplierController.handleCreateSupplier);
router.get('/', supplierController.handleGetSuppliers);
router.get('/export', supplierController.handleExportSuppliers);
router.post('/import', requireRole(['TENANT_ADMIN']), validate(importSuppliersSchema), supplierController.handleImportSuppliers);
router.get('/:id', supplierController.handleGetSupplierDetails);
router.get('/:id/ledger', supplierController.handleGetSupplierLedger);
router.post('/:id/payments', requireRole(['TENANT_ADMIN']), validate(recordSupplierPaymentSchema), supplierController.handleRecordSupplierPayment);
router.put('/:id', requireRole(['TENANT_ADMIN']), validate(updateSupplierSchema), supplierController.handleUpdateSupplier);
router.delete('/:id', requireRole(['TENANT_ADMIN']), enforceEmployeeRestrictions, supplierController.handleDeleteSupplier);

export default router;
