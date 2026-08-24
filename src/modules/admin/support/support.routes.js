import { Router } from 'express';
import * as supportController from './support.controller.js';

const router = Router();

router.get('/tickets', supportController.handleGetAllSupportTickets);
router.get('/tickets/:ticketId', supportController.handleGetSupportTicketDetailsAdmin);
router.post('/tickets/:ticketId/reply', supportController.handleReplySupportTicketAdmin);
router.put('/tickets/:ticketId/status', supportController.handleUpdateTicketStatusAdmin);

export default router;
