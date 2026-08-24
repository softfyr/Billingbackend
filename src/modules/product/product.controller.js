import * as productService from './product.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleGetCategories = asyncHandler(async (req, res) => {
  const categories = await productService.getCategories();
  return res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully.'));
});

export const handleGetCategoryFieldStructure = asyncHandler(async (req, res) => {
  const structure = await productService.getCategoryFieldStructure(req.params.subCategoryId);
  return res.status(200).json(new ApiResponse(200, structure, 'Sub-Category additional fields structure fetched successfully.'));
});

export const handleCreateProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.tenantId, req.user.id, req.body);
  return res.status(201).json(new ApiResponse(201, product, 'Product added successfully.'));
});

export const handleGetProducts = asyncHandler(async (req, res) => {
  const products = await productService.getProducts(req.tenantId, req.query);
  return res.status(200).json(new ApiResponse(200, products, 'Products list fetched successfully.'));
});

export const handleGetLowStockProducts = asyncHandler(async (req, res) => {
  const products = await productService.getLowStockProducts(req.tenantId);
  return res.status(200).json(new ApiResponse(200, products, 'Low stock products fetched successfully.'));
});

export const handleGetProductByBarcode = asyncHandler(async (req, res) => {
  const product = await productService.getProductByBarcode(req.tenantId, req.params.barcode);
  return res.status(200).json(new ApiResponse(200, product, 'Product fetched by barcode successfully.'));
});

export const handleGetProductDetails = asyncHandler(async (req, res) => {
  const product = await productService.getProductDetails(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, product, 'Product details fetched successfully.'));
});

export const handleUpdateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.tenantId, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, product, 'Product updated successfully.'));
});

export const handleDeleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully.'));
});

export const handleImportProducts = asyncHandler(async (req, res) => {
  const { products } = req.body || {};
  const result = await productService.importProducts(req.tenantId, products);
  return res.status(201).json(new ApiResponse(201, result, 'Products bulk imported successfully.'));
});

import { exportToExcel, exportToCSV } from '../../utils/export.utility.js';

export const handleExportProducts = asyncHandler(async (req, res) => {
  const exportData = await productService.exportProducts(req.tenantId, req.query);
  const format = (req.query.format || 'json').toLowerCase();

  const columns = [
    { header: 'Product Name', key: 'name', width: 25 },
    { header: 'SKU Code', key: 'sku', width: 18 },
    { header: 'Barcode', key: 'barcode', width: 18 },
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

  if (format === 'excel' || format === 'xlsx') {
    return await exportToExcel(res, { filename: 'products_inventory', sheetName: 'Products', columns, data: exportData });
  } else if (format === 'csv') {
    return exportToCSV(res, { filename: 'products_inventory', columns, data: exportData });
  }

  return res.status(200).json(new ApiResponse(200, exportData, 'Products export dataset generated successfully.'));
});


