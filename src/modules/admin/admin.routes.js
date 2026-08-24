import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';

import dashboardRoutes from './dashboard/dashboard.routes.js';
import tenantRoutes from './tenant/tenant.routes.js';
import categoryRoutes from './category/category.routes.js';
import packageRoutes from './package/package.routes.js';
import supportRoutes from './support/support.routes.js';
import cmsRoutes from './cms/cms.routes.js';

const router = Router();

// All routes here require Super Admin authentication
router.use(authGuard('SUPER_ADMIN'));

// Mount modular admin sub-routers
router.use('/dashboard', dashboardRoutes);
router.use('/tenants', tenantRoutes);
router.use('/', categoryRoutes); // Handles /categories, /sub-categories
router.use('/packages', packageRoutes);
router.use('/support', supportRoutes);
router.use('/', cmsRoutes); // Handles /policies, /contact-info

export default router;
