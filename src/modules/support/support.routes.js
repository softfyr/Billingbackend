import { Router } from 'express';
import * as supportController from './support.controller.js';
import { authenticateToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/', supportController.handleCreateSupportTicket);
router.get('/', supportController.handleGetVendorSupportTickets);
router.get('/:id', supportController.handleGetTicketDetailsVendor);
router.post('/:id/reply', supportController.handleReplySupportTicketVendor);

export default router;
