import { Router } from 'express';
import * as dashboardController from './dashboard.controller.js';
import { authenticateToken } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', dashboardController.handleGetGlobalDashboard);

export default router;
