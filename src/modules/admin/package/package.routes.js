import { Router } from 'express';
import * as packageController from './package.controller.js';

const router = Router();

router.post('/', packageController.handleCreatePackage);
router.get('/', packageController.handleGetPackages);
router.get('/:id', packageController.handleGetPackageById);
router.put('/:id', packageController.handleUpdatePackage);
router.delete('/:id', packageController.handleDeletePackage);

export default router;
