import { Router } from 'express';
import * as cmsController from './cms.controller.js';

const router = Router();

router.put('/policies', cmsController.handleUpdatePolicy);
router.get('/policies', cmsController.handleGetPolicies);
router.put('/contact-info', cmsController.handleUpdateContactInfo);
router.get('/contact-info', cmsController.handleGetContactInfo);

export default router;
