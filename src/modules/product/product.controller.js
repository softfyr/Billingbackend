import * as productService from './product.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseRequestBody } from '../../utils/request.util.js';
import { handleDataExport } from '../../utils/export.utility.js';

export const handleGetCategories = asyncHandler(async (req, res) => {
  const categories = await productService.getCategories();
  return ApiResponse.success(res, categories, 'Categories fetched successfully.');
});

export const handleGetCategoryFieldStructure = asyncHandler(async (req, res) => {
  const structure = await productService.getCategoryFieldStructure(req.params.subCategoryId);
  return ApiResponse.success(res, structure, 'Sub-Category additional fields structure fetched successfully.');
});

export const handleCreateProduct = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);
  const imageInput = req.file || bodyData.productImage || bodyData.image || bodyData.file;
  const product = await productService.createProduct(req.tenantId, req.user.id, {
    ...bodyData,
    ...(imageInput && { productImage: imageInput })
  });
  return ApiResponse.created(res, product, 'Product added successfully.');
});

export const handleGetProducts = asyncHandler(async (req, res) => {
  const products = await productService.getProducts(req.tenantId, req.query);
  return ApiResponse.success(res, products, 'Products list fetched successfully.');
});

export const handleGetLowStockProducts = asyncHandler(async (req, res) => {
  const products = await productService.getLowStockProducts(req.tenantId);
  return ApiResponse.success(res, products, 'Low stock products fetched successfully.');
});

export const handleGetProductByBarcode = asyncHandler(async (req, res) => {
  const product = await productService.getProductByBarcode(req.tenantId, req.params.barcode);
  return ApiResponse.success(res, product, 'Product fetched by barcode successfully.');
});

export const handleGetProductDetails = asyncHandler(async (req, res) => {
  const product = await productService.getProductDetails(req.tenantId, req.params.id);
  return ApiResponse.success(res, product, 'Product details fetched successfully.');
});

export const handleUpdateProduct = asyncHandler(async (req, res) => {
  const bodyData = parseRequestBody(req.body);
  const imageInput = req.file || bodyData.productImage || bodyData.image || bodyData.file;
  const product = await productService.updateProduct(req.tenantId, req.params.id, {
    ...bodyData,
    ...(imageInput !== undefined && { productImage: imageInput })
  });
  return ApiResponse.success(res, product, 'Product updated successfully.');
});

export const handleDeleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.tenantId, req.params.id);
  return ApiResponse.success(res, null, 'Product deleted successfully.');
});

export const handleImportProducts = asyncHandler(async (req, res) => {
  const { products } = req.body || {};
  const result = await productService.importProducts(req.tenantId, req.user.id, products);
  return ApiResponse.created(res, result, 'Products bulk imported successfully.');
});

export const handleAdjustProductStock = asyncHandler(async (req, res) => {
  const result = await productService.adjustProductStock(req.tenantId, req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, result, 'Product stock adjusted successfully.');
});

export const handleExportProducts = asyncHandler(async (req, res) => {
  const exportData = await productService.exportProducts(req.tenantId, req.query);

  const columns = [
    { header: 'Product Name', key: 'name', width: 25 },
    { header: 'SKU Code', key: 'sku', width: 18 },
    { header: 'HSN Code', key: 'hsnCode', width: 16 },
    { header: 'Brand', key: 'brand', width: 18 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Category', key: 'categoryName', width: 20 },
    { header: 'Sub-Category', key: 'subCategoryName', width: 20 },
    { header: 'Purchase Price (₹)', key: 'purchasePrice', width: 18 },
    { header: 'Selling Price (₹)', key: 'sellingPrice', width: 18 },
    { header: 'MRP (₹)', key: 'mrp', width: 15 },
    { header: 'Current Stock', key: 'currentStock', width: 15 },
    { header: 'Min Stock Level', key: 'minStockLevel', width: 15 },
    { header: 'Tax GST (%)', key: 'taxPercent', width: 14 },
    { header: 'Status', key: 'status', width: 12 }
  ];

  return handleDataExport(res, {
    format: req.query.format,
    filename: 'products_inventory',
    sheetName: 'Products',
    columns,
    data: exportData
  });
});


