import { Router } from 'express';
import * as productController from './product.controller.js';
import { authenticateToken, requireRole, enforceEmployeeRestrictions, requireActiveSubscription } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadSingleImage } from '../../middlewares/upload.middleware.js';
import { createProductSchema, updateProductSchema, importProductsSchema, stockAdjustmentSchema } from './product.validator.js';

const router = Router();

router.use(authenticateToken);
router.use(requireActiveSubscription);

// Viewing Master Categories & Field Structure (For Vendor Product Forms)
router.get('/categories', productController.handleGetCategories);
router.get('/structure/:subCategoryId', productController.handleGetCategoryFieldStructure);

// Specialized Product Searches & Alerts
router.get('/low-stock', productController.handleGetLowStockProducts);
router.get('/barcode/:barcode', productController.handleGetProductByBarcode);

// Product CRUD, Import & Export
router.get('/export', productController.handleExportProducts);
router.post('/import', validate(importProductsSchema), productController.handleImportProducts);
router.post('/', uploadSingleImage('productImage'), validate(createProductSchema), productController.handleCreateProduct);
router.get('/', productController.handleGetProducts);
router.get('/:id', productController.handleGetProductDetails);
router.put('/:id', uploadSingleImage('productImage'), validate(updateProductSchema), productController.handleUpdateProduct);
router.post('/:id/stock-adjustment', validate(stockAdjustmentSchema), productController.handleAdjustProductStock);

// Restrict deletion of products from Employee role
router.delete('/:id', enforceEmployeeRestrictions, productController.handleDeleteProduct);

export default router;
