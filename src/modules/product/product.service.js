import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';

export const getCategories = async () => {
  return await prisma.category.findMany({
    include: { subCategories: { include: { additionalFields: true } } },
    orderBy: { name: 'asc' }
  });
};

export const getCategoryFieldStructure = async (subCategoryId) => {
  const subCategory = await prisma.subCategory.findUnique({
    where: { id: subCategoryId },
    include: { category: true, additionalFields: true }
  });

  if (!subCategory) throw new ApiError(404, 'Sub-Category not found.');
  return subCategory;
};

export const createProduct = async (tenantId, userId, data) => {
  const {
    categoryId,
    subCategoryId,
    name,
    sku,
    barcode,
    brand,
    unit = 'Pcs',
    purchasePrice,
    sellingPrice,
    mrp,
    taxType = 'GST',
    discountPercent = 0,
    taxId,
    openingStock = 0,
    maxStockLevel = 0,
    minStockLevel = 5,
    stockAlertQuantity = 5,
    enableStockAlert = true,
    productImage,
    description,
    expiryDate,
    additionalValues,
    status = 'ACTIVE'
  } = data;

  if (!name || !name.trim()) throw new ApiError(400, 'Product Name is required.');
  if (!categoryId || !subCategoryId) throw new ApiError(400, 'Category and Sub-Category are required.');
  if (sellingPrice === undefined || sellingPrice <= 0) throw new ApiError(400, 'Valid Selling Price is required.');

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, 'Category not found.');

  const subCategory = await prisma.subCategory.findFirst({
    where: { id: subCategoryId, categoryId },
    include: { additionalFields: true }
  });
  if (!subCategory) throw new ApiError(404, 'Sub-Category not found under specified Category.');

  // Validate required custom fields
  if (subCategory.additionalFields.length > 0) {
    for (const field of subCategory.additionalFields) {
      if (field.isRequired && (!additionalValues || !additionalValues[field.labelName])) {
        throw new ApiError(400, `The field '${field.labelName}' is required for this Sub-Category.`);
      }
    }
  }

  const generatedSKU = sku && sku.trim() ? sku.trim() : `SKU-${Date.now()}`;
  const generatedBarcode = barcode && barcode.trim() ? barcode.trim() : `890${Math.floor(100000000 + Math.random() * 900000000)}`;

  // Check SKU / Barcode uniqueness per tenant
  if (sku) {
    const existingSKU = await prisma.product.findFirst({ where: { tenantId, sku: generatedSKU, status: 'ACTIVE' } });
    if (existingSKU) throw new ApiError(400, `A product with SKU '${generatedSKU}' already exists in your store.`);
  }

  const existingBarcode = await prisma.product.findFirst({ where: { tenantId, barcode: generatedBarcode, status: 'ACTIVE' } });
  if (existingBarcode && barcode) {
    throw new ApiError(400, `A product with Barcode '${generatedBarcode}' already exists in your store.`);
  }

  const initialStock = openingStock ? parseInt(openingStock) : 0;

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId,
        categoryId,
        subCategoryId,
        name: name.trim(),
        sku: generatedSKU,
        barcode: generatedBarcode,
        brand: brand ? brand.trim() : null,
        unit: unit ? unit.trim() : 'Pcs',
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
        sellingPrice: parseFloat(sellingPrice),
        mrp: mrp ? parseFloat(mrp) : parseFloat(sellingPrice),
        taxType: taxType || 'GST',
        discountPercent: discountPercent ? parseFloat(discountPercent) : 0,
        taxId: taxId || null,
        openingStock: initialStock,
        currentStock: initialStock,
        maxStockLevel: maxStockLevel ? parseInt(maxStockLevel) : 0,
        minStockLevel: minStockLevel ? parseInt(minStockLevel) : 5,
        stockAlertQuantity: stockAlertQuantity ? parseInt(stockAlertQuantity) : 5,
        enableStockAlert: enableStockAlert !== undefined ? Boolean(enableStockAlert) : true,
        productImage: productImage || null,
        description: description || null,
        expiryDate: subCategory.enableExpiryDate && expiryDate ? new Date(expiryDate) : null,
        additionalValues: additionalValues || {},
        status: status || 'ACTIVE'
      },
      include: { category: true, subCategory: true, tax: true }
    });

    // Record initial stock in StockHistory if openingStock > 0
    if (initialStock > 0) {
      await tx.stockHistory.create({
        data: {
          tenantId,
          productId: product.id,
          previousStock: 0,
          addedRemovedQty: initialStock,
          updatedStock: initialStock,
          reason: 'MANUAL_ADJUSTMENT',
          updatedByUserId: userId
        }
      });
    }

    return product;
  });
};

export const getProducts = async (tenantId, filters = {}) => {
  const { categoryId, subCategoryId, brand, status, search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { tenantId };

  // Status Filter mapping
  const sUpper = (status || 'ACTIVE').toUpperCase();
  const now = new Date();

  if (sUpper === 'ACTIVE') {
    where.status = 'ACTIVE';
  } else if (sUpper === 'INACTIVE') {
    where.status = 'SUSPENDED';
  } else if (sUpper === 'DRAFT') {
    where.status = 'DRAFT';
  } else if (sUpper === 'LOW_STOCK') {
    where.status = 'ACTIVE';
    where.currentStock = { gt: 0, lte: 5 };
  } else if (sUpper === 'OUT_OF_STOCK') {
    where.status = 'ACTIVE';
    where.currentStock = { lte: 0 };
  } else if (sUpper === 'EXPIRED') {
    where.status = 'ACTIVE';
    where.expiryDate = { lt: now };
  }

  if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId;
  if (subCategoryId && subCategoryId !== 'ALL') where.subCategoryId = subCategoryId;
  if (brand && brand !== 'ALL' && brand.trim()) where.brand = { equals: brand.trim(), mode: 'insensitive' };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } }
    ];
  }

  // --- Top Summary KPI Banner Aggregations ---
  const totalProductsCount = await prisma.product.count({ where: { tenantId, status: 'ACTIVE' } });
  
  const allActiveProducts = await prisma.product.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { currentStock: true, minStockLevel: true, purchasePrice: true }
  });

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalStockValue = 0;

  for (const p of allActiveProducts) {
    if (p.currentStock <= 0) {
      outOfStockCount++;
    } else if (p.currentStock <= p.minStockLevel) {
      lowStockCount++;
    }
    if (p.currentStock > 0) {
      totalStockValue += (p.currentStock * p.purchasePrice);
    }
  }

  const totalCount = await prisma.product.count({ where });

  const products = await prisma.product.findMany({
    where,
    skip,
    take,
    include: { category: true, subCategory: true, tax: true },
    orderBy: { createdAt: 'desc' }
  });

  const formattedProducts = products.map(p => {
    let computedStockStatus = 'IN_STOCK';
    if (p.expiryDate && new Date(p.expiryDate) < now) {
      computedStockStatus = 'EXPIRED';
    } else if (p.currentStock <= 0) {
      computedStockStatus = 'OUT_OF_STOCK';
    } else if (p.currentStock <= p.minStockLevel) {
      computedStockStatus = 'LOW_STOCK';
    }

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      brand: p.brand || 'N/A',
      unit: p.unit || 'Pcs',
      category: p.category,
      subCategory: p.subCategory,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      mrp: p.mrp || p.sellingPrice,
      taxType: p.taxType || 'GST',
      discountPercent: p.discountPercent || 0,
      tax: p.tax,
      openingStock: p.openingStock,
      currentStock: p.currentStock,
      maxStockLevel: p.maxStockLevel,
      minStockLevel: p.minStockLevel,
      stockAlertQuantity: p.stockAlertQuantity,
      enableStockAlert: p.enableStockAlert,
      stockStatus: computedStockStatus,
      productImage: p.productImage,
      description: p.description,
      expiryDate: p.expiryDate,
      additionalValues: p.additionalValues,
      status: p.status === 'SUSPENDED' ? 'Inactive' : p.status,
      createdAt: p.createdAt
    };
  });

  const extraSummary = {
    summary: {
      totalProducts: totalProductsCount,
      lowStockItems: lowStockCount,
      outOfStockItems: outOfStockCount,
      totalStockValue
    },
    products: formattedProducts
  };

  return formatPaginatedResult(formattedProducts, totalCount, page, limit, extraSummary);
};

export const getLowStockProducts = async (tenantId) => {
  const products = await prisma.product.findMany({
    where: { tenantId, status: 'ACTIVE' },
    include: { category: true, subCategory: true, tax: true },
    orderBy: { currentStock: 'asc' }
  });

  return products.filter(p => p.currentStock <= p.minStockLevel);
};

export const getProductByBarcode = async (tenantId, barcode) => {
  if (!barcode) throw new ApiError(400, 'Barcode or SKU code is required.');

  const product = await prisma.product.findFirst({
    where: {
      tenantId,
      status: 'ACTIVE',
      OR: [
        { barcode: barcode.trim() },
        { sku: barcode.trim() }
      ]
    },
    include: { category: true, subCategory: true, tax: true }
  });

  if (!product) {
    throw new ApiError(404, `No product found matching Barcode / SKU '${barcode}'.`);
  }

  return product;
};

export const getProductDetails = async (tenantId, productId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      category: true,
      subCategory: { include: { additionalFields: true } },
      tax: true,
      stockHistory: {
        include: { updatedByUser: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      },
      billItems: {
        include: { bill: { select: { invoiceNumber: true, createdAt: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  if (!product) throw new ApiError(404, 'Product not found.');
  return product;
};

export const updateProduct = async (tenantId, productId, data = {}) => {
  let bodyData = data;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) { }
  }

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  return await prisma.product.update({
    where: { id: productId },
    data: {
      ...(bodyData.name && { name: bodyData.name.trim() }),
      ...(bodyData.sku && { sku: bodyData.sku.trim() }),
      ...(bodyData.barcode !== undefined && { barcode: bodyData.barcode ? bodyData.barcode.trim() : null }),
      ...(bodyData.brand !== undefined && { brand: bodyData.brand ? bodyData.brand.trim() : null }),
      ...(bodyData.unit !== undefined && { unit: bodyData.unit }),
      ...(bodyData.purchasePrice !== undefined && { purchasePrice: parseFloat(bodyData.purchasePrice) }),
      ...(bodyData.sellingPrice !== undefined && { sellingPrice: parseFloat(bodyData.sellingPrice) }),
      ...(bodyData.mrp !== undefined && { mrp: parseFloat(bodyData.mrp) }),
      ...(bodyData.taxType !== undefined && { taxType: bodyData.taxType }),
      ...(bodyData.discountPercent !== undefined && { discountPercent: parseFloat(bodyData.discountPercent) }),
      ...(bodyData.taxId !== undefined && { taxId: bodyData.taxId }),
      ...(bodyData.maxStockLevel !== undefined && { maxStockLevel: parseInt(bodyData.maxStockLevel) }),
      ...(bodyData.minStockLevel !== undefined && { minStockLevel: parseInt(bodyData.minStockLevel) }),
      ...(bodyData.stockAlertQuantity !== undefined && { stockAlertQuantity: parseInt(bodyData.stockAlertQuantity) }),
      ...(bodyData.enableStockAlert !== undefined && { enableStockAlert: Boolean(bodyData.enableStockAlert) }),
      ...(bodyData.productImage !== undefined && { productImage: bodyData.productImage }),
      ...(bodyData.description !== undefined && { description: bodyData.description }),
      ...(bodyData.expiryDate !== undefined && { expiryDate: bodyData.expiryDate ? new Date(bodyData.expiryDate) : null }),
      ...(bodyData.additionalValues && { additionalValues: bodyData.additionalValues }),
      ...(bodyData.status && { status: bodyData.status })
    },
    include: { category: true, subCategory: true, tax: true }
  });
};

export const deleteProduct = async (tenantId, productId) => {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  return await prisma.product.update({
    where: { id: productId },
    data: { status: 'SUSPENDED' }
  });
};

export const importProducts = async (tenantId, productsArray = []) => {
  if (!Array.isArray(productsArray) || productsArray.length === 0) {
    throw new ApiError(400, 'At least one valid product record is required for import.');
  }

  // Fetch default category and subcategory if not provided
  let defaultCategory = await prisma.category.findFirst();
  let defaultSubCategory = await prisma.subCategory.findFirst();

  let importedCount = 0;
  for (const item of productsArray) {
    if (!item.name || !item.name.trim()) continue;

    const sku = item.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const barcode = item.barcode || `890${Math.floor(100000000 + Math.random() * 900000000)}`;

    await prisma.product.create({
      data: {
        tenantId,
        categoryId: item.categoryId || defaultCategory?.id,
        subCategoryId: item.subCategoryId || defaultSubCategory?.id,
        name: item.name.trim(),
        sku,
        barcode,
        brand: item.brand || null,
        unit: item.unit || 'Pcs',
        purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : 0,
        sellingPrice: item.sellingPrice ? parseFloat(item.sellingPrice) : 100,
        mrp: item.mrp ? parseFloat(item.mrp) : (item.sellingPrice || 100),
        taxType: item.taxType || 'GST',
        discountPercent: item.discountPercent ? parseFloat(item.discountPercent) : 0,
        openingStock: item.openingStock ? parseInt(item.openingStock) : 0,
        currentStock: item.openingStock ? parseInt(item.openingStock) : 0,
        minStockLevel: item.minStockLevel ? parseInt(item.minStockLevel) : 5,
        status: 'ACTIVE'
      }
    });
    importedCount++;
  }

  return { importedCount };
};

export const exportProducts = async (tenantId, filters = {}) => {
  const { categoryId, subCategoryId, search } = filters;
  const where = { tenantId, status: 'ACTIVE' };

  if (categoryId) where.categoryId = categoryId;
  if (subCategoryId) where.subCategoryId = subCategoryId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } }
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: true, subCategory: true, tax: true },
    orderBy: { name: 'asc' }
  });

  return products.map(p => ({
    name: p.name,
    sku: p.sku || 'N/A',
    barcode: p.barcode || 'N/A',
    brand: p.brand || 'N/A',
    unit: p.unit || 'Pcs',
    categoryName: p.category?.name || 'N/A',
    subCategoryName: p.subCategory?.name || 'N/A',
    purchasePrice: p.purchasePrice,
    sellingPrice: p.sellingPrice,
    mrp: p.mrp || p.sellingPrice,
    currentStock: p.currentStock,
    minStockLevel: p.minStockLevel,
    taxPercent: p.tax ? p.tax.percentage : 0,
    status: p.status === 'SUSPENDED' ? 'Inactive' : 'Active'
  }));
};
