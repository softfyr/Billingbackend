import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { authenticateToken, requireActiveSubscription } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { updateStockManualSchema, reconcileStockSchema, damageStockSchema, lostStockSchema } from './inventory.validator.js';

const router = Router();

router.use(authenticateToken);
router.use(requireActiveSubscription);

router.get('/', inventoryController.handleGetInventory);
router.get('/export', inventoryController.handleExportInventoryLogs);
router.post('/stock-update', validate(updateStockManualSchema), inventoryController.handleUpdateStockManual);
router.post('/reconcile', validate(reconcileStockSchema), inventoryController.handleReconcileStock);
router.post('/damage', validate(damageStockSchema), inventoryController.handleDamageStock);
router.post('/lost', validate(lostStockSchema), inventoryController.handleLostStock);
router.get('/expiry-alerts', inventoryController.handleGetExpiryAlerts);

export default router;
