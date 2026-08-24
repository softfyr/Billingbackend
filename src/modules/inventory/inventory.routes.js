import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { authenticateToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', inventoryController.handleGetInventory);
router.get('/export', inventoryController.handleExportInventoryLogs);
router.post('/stock-update', inventoryController.handleUpdateStockManual);
router.get('/expiry-alerts', inventoryController.handleGetExpiryAlerts);

export default router;
