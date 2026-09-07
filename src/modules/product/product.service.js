export const formatSingleProduct = (product) => {
  if (!product) return null;
  const rawType = (product.taxType || '').toUpperCase();
  const isInc = ['INCLUSIVE', 'GST_INCLUSIVE'].includes(rawType);
  const taxMode = isInc ? 'INCLUSIVE' : 'EXCLUSIVE';
  const taxPct = product.tax?.percentage ?? (rawType === 'EXEMPT' || rawType === 'NON_GST' ? 0 : 18);
  
  const factor = (product.hasSecondaryUnit && product.conversionFactor > 1) ? product.conversionFactor : 1;
  const perPieceCost = (product.hasSecondaryUnit && product.secondaryPurchasePrice && factor > 1) 
    ? (product.secondaryPurchasePrice / factor) 
    : product.purchasePrice;

  return {
    ...product,
    taxType: ['EXEMPT', 'NON_GST'].includes(rawType) ? rawType : 'GST',
    taxMode: taxMode,
    taxPercent: taxPct,
    taxRate: taxPct,
    perPieceCost: Math.round(perPieceCost * 100) / 100
  };
};


const resolveTaxId = async (tenantId, taxId, taxPercent, taxType) => {
  if (taxId) return taxId;
  const rawType = (taxType || '').toUpperCase();
  if (rawType === 'EXEMPT' || rawType === 'NON_GST') {
    taxPercent = 0;
  }
  if (taxPercent !== undefined && taxPercent !== null) {
    const pct = parseFloat(taxPercent) || 0;
    let taxRecord = await prisma.tax.findFirst({
      where: { tenantId, percentage: pct, status: 'ACTIVE' }
    });
    if (!taxRecord) {
      taxRecord = await prisma.tax.create({
        data: { tenantId, name: `${pct}% GST`, percentage: pct, status: 'ACTIVE' }
      });
    }
    return taxRecord.id;
  }
  return null;
};

import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';

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
  if (!tenantId) {
    throw new ApiError(400, 'Tenant workspace ID is missing. Super Admin accounts cannot directly own products. Please log in with a Vendor user account.');
  }

  const {
    categoryId,
    subCategoryId,
    name,
    sku,
    hsnCode,
    brand,
    unit = 'Pcs',
    hasSecondaryUnit = false,
    secondaryUnit,
    conversionFactor = 1,
    secondaryPurchasePrice,
    purchasePrice = 0,
    sellingPrice,
    mrp,
    taxType = 'GST',
    taxMode = 'EXCLUSIVE',
    taxPercent = 18,
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
  if (!hsnCode || !hsnCode.trim()) throw new ApiError(400, 'HSN Code is required.');
  if (sellingPrice === undefined || sellingPrice <= 0) throw new ApiError(400, 'Valid Selling Price is required.');

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, 'Category not found.');

  const subCategory = await prisma.subCategory.findFirst({
    where: { id: subCategoryId, categoryId },
    include: { additionalFields: true }
  });
  if (!subCategory) throw new ApiError(404, 'Sub-Category not found under specified Category.');

  // Multi-unit validation & per-piece purchase price calculation
  const isMultiUnit = Boolean(hasSecondaryUnit);
  let parsedConversion = parseFloat(conversionFactor) || 1;
  let parsedSecPrice = secondaryPurchasePrice ? parseFloat(secondaryPurchasePrice) : null;
  let finalPurchasePrice = purchasePrice ? parseFloat(purchasePrice) : 0;

  if (isMultiUnit) {
    if (!secondaryUnit || !secondaryUnit.trim()) {
      throw new ApiError(400, 'Secondary Unit is required when Multi-Unit is enabled.');
    }
    if (parsedConversion <= 0) {
      throw new ApiError(400, 'Conversion factor must be greater than 0.');
    }
    if (!parsedSecPrice || parsedSecPrice <= 0) {
      throw new ApiError(400, 'Secondary purchase price must be greater than 0.');
    }
    // Calculate base unit purchase cost: Secondary Purchase Price / Conversion Factor
    if (finalPurchasePrice <= 0) {
      finalPurchasePrice = Math.round((parsedSecPrice / parsedConversion) * 100) / 100;
    }
  }

  // Parse additionalValues if sent as string (e.g. from multipart form-data)
  let parsedAdditionalValues = additionalValues;
  if (typeof parsedAdditionalValues === 'string') {
    try { parsedAdditionalValues = JSON.parse(parsedAdditionalValues); } catch (e) { parsedAdditionalValues = {}; }
  }

  // Validate required custom fields
  if (subCategory.additionalFields.length > 0) {
    for (const field of subCategory.additionalFields) {
      if (field.isRequired && (!parsedAdditionalValues || !parsedAdditionalValues[field.labelName])) {
        throw new ApiError(400, `The field '${field.labelName}' is required for this Sub-Category.`);
      }
    }
  }

  // Validate expiry date if required by Sub-Category
  if (subCategory.enableExpiryDate && (!expiryDate || !expiryDate.toString().trim())) {
    throw new ApiError(400, 'Expiry date is required for products under this Sub-Category.');
  }

  // Rule 3: SKU Normalization (UPPERCASE & Trimmed)
  const normalizedSku = sku && sku.trim() ? sku.trim().toUpperCase() : `SKU-${Date.now()}`;
  
  // Check SKU uniqueness per tenant
  const existingSKU = await prisma.product.findFirst({ where: { tenantId, sku: normalizedSku, status: 'ACTIVE' } });
  if (existingSKU) throw new ApiError(400, `A product with SKU '${normalizedSku}' already exists in your store.`);

  const initialStock = (openingStock !== undefined && openingStock !== null && openingStock !== '') ? parseFloat(openingStock) : 0;

  // Process Product Image Upload to Cloudinary if provided
  let uploadedImageUrl = null;
  if (productImage) {
    const uploadRes = await uploadToCloudinary(productImage, 'billing_saas/products');
    if (uploadRes && uploadRes.url) {
      uploadedImageUrl = uploadRes.url;
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const resolvedTaxType = taxType === 'EXEMPT' || taxType === 'NON_GST' ? taxType : (taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'GST');
      const resolvedTaxId = await resolveTaxId(tenantId, taxId, taxPercent, resolvedTaxType);

      const product = await tx.product.create({
        data: {
          tenantId,
          categoryId,
          subCategoryId,
          name: name.trim(),
          sku: normalizedSku,
          hsnCode: hsnCode.trim(),
          brand: brand ? brand.trim() : null,
          unit: unit ? unit.trim() : 'Pcs',
          hasSecondaryUnit: isMultiUnit,
          secondaryUnit: isMultiUnit ? secondaryUnit.trim() : null,
          conversionFactor: isMultiUnit ? parsedConversion : 1,
          secondaryPurchasePrice: isMultiUnit ? parsedSecPrice : null,
          purchasePrice: finalPurchasePrice,
          sellingPrice: parseFloat(sellingPrice),
          mrp: mrp ? parseFloat(mrp) : parseFloat(sellingPrice),
          taxType: resolvedTaxType,
          discountPercent: discountPercent ? parseFloat(discountPercent) : 0,
          taxId: resolvedTaxId,
          openingStock: initialStock,
          currentStock: initialStock,
          maxStockLevel: maxStockLevel ? parseFloat(maxStockLevel) : 0,
          minStockLevel: minStockLevel ? parseFloat(minStockLevel) : 5,
          stockAlertQuantity: stockAlertQuantity ? parseFloat(stockAlertQuantity) : 5,
          enableStockAlert: enableStockAlert !== undefined ? Boolean(enableStockAlert) : true,
          productImage: uploadedImageUrl,
          description: description || null,
          expiryDate: subCategory.enableExpiryDate && expiryDate ? new Date(expiryDate) : null,
          additionalValues: parsedAdditionalValues || {},
          status: (status || '').toUpperCase() === 'SUSPENDED' || (status || '').toUpperCase() === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE'
        },
        include: { category: true, subCategory: true, tax: true }
      });

      // Record initial stock in StockHistory with reason 'OPENING_STOCK' if openingStock > 0
      if (initialStock > 0) {
        await tx.stockHistory.create({
          data: {
            tenantId,
            productId: product.id,
            previousStock: 0,
            addedRemovedQty: initialStock,
            updatedStock: initialStock,
            reason: 'OPENING_STOCK',
            updatedByUserId: userId
          }
        });
      }

      return formatSingleProduct(product);
    });
  } catch (error) {
    // Cloudinary Cleanup on Transaction Failure
    if (uploadedImageUrl) {
      await deleteFromCloudinary(uploadedImageUrl).catch(() => {});
    }
    throw error;
  }
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
      { hsnCode: { contains: q, mode: 'insensitive' } },
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

  for (let i = 0; i < allActiveProducts.length; i++) {
    const p = allActiveProducts[i];
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
      hsnCode: p.hsnCode || null,
      brand: p.brand || 'N/A',
      unit: p.unit || 'Pcs',
      hasSecondaryUnit: Boolean(p.hasSecondaryUnit),
      secondaryUnit: p.secondaryUnit || null,
      conversionFactor: p.conversionFactor || 1,
      secondaryPurchasePrice: p.secondaryPurchasePrice || null,
      category: p.category,
      subCategory: p.subCategory,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      mrp: p.mrp || p.sellingPrice,
      taxType: p.taxType || 'GST',
      discountPercent: p.discountPercent || 0,
      tax: p.tax,
      taxMode: ['INCLUSIVE', 'GST_INCLUSIVE'].includes((p.taxType || '').toUpperCase()) ? 'INCLUSIVE' : (['EXCLUSIVE', 'GST_EXCLUSIVE'].includes((p.taxType || '').toUpperCase()) ? 'EXCLUSIVE' : (p.taxType || 'INCLUSIVE')),
      taxPercent: p.tax?.percentage ?? (p.taxType === 'EXEMPT' || p.taxType === 'NON_GST' ? 0 : 18),
      taxRate: p.tax?.percentage ?? (p.taxType === 'EXEMPT' || p.taxType === 'NON_GST' ? 0 : 18),
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
  if (!barcode || !barcode.trim()) throw new ApiError(400, 'Barcode or SKU code is required.');

  const cleanCode = barcode.trim();

  const product = await prisma.product.findFirst({
    where: {
      tenantId,
      status: 'ACTIVE',
      OR: [
        { sku: cleanCode }
      ]
    },
    include: { category: true, subCategory: true, tax: true }
  });

  if (!product) {
    throw new ApiError(404, `No product found matching Barcode / SKU '${cleanCode}'.`);
  }

  return formatSingleProduct(product);
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
  return formatSingleProduct(product);
};

export const updateProduct = async (tenantId, productId, data = {}) => {
  let bodyData = data;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) { }
  }

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  // Rule 3: SKU Normalization & Duplicate check if changed
  const normalizedSku = bodyData.sku !== undefined ? (bodyData.sku ? bodyData.sku.trim().toUpperCase() : null) : product.sku;
  if (normalizedSku && normalizedSku !== product.sku) {
    const existingSKU = await prisma.product.findFirst({
      where: { tenantId, sku: normalizedSku, status: 'ACTIVE', NOT: { id: productId } }
    });
    if (existingSKU) throw new ApiError(400, `A product with SKU '${normalizedSku}' already exists in your store.`);
  }

  // Rule 1: Compute Merged Final-State for Multi-Unit and Unit parameters
  const mergedHasSecondaryUnit = bodyData.hasSecondaryUnit !== undefined ? Boolean(bodyData.hasSecondaryUnit) : product.hasSecondaryUnit;
  const mergedUnit = bodyData.unit !== undefined ? (bodyData.unit ? bodyData.unit.trim() : 'Pcs') : product.unit;
  const mergedSecondaryUnit = bodyData.secondaryUnit !== undefined ? (bodyData.secondaryUnit ? bodyData.secondaryUnit.trim() : null) : product.secondaryUnit;
  const mergedConversionFactor = bodyData.conversionFactor !== undefined ? parseFloat(bodyData.conversionFactor) : product.conversionFactor;
  const mergedSecondaryPurchasePrice = bodyData.secondaryPurchasePrice !== undefined ? (bodyData.secondaryPurchasePrice ? parseFloat(bodyData.secondaryPurchasePrice) : null) : product.secondaryPurchasePrice;

  // Rule 2: Unit / Conversion Factor change protection if transactions exist
  const hasUnitChanges = (
    mergedUnit !== product.unit ||
    mergedHasSecondaryUnit !== product.hasSecondaryUnit ||
    mergedSecondaryUnit !== product.secondaryUnit ||
    mergedConversionFactor !== product.conversionFactor
  );

  if (hasUnitChanges) {
    const linkedBillCount = await prisma.billItem.count({ where: { productId } });
    const linkedPurchaseCount = await prisma.purchaseItem.count({ where: { productId } });
    const linkedStockMovements = await prisma.stockHistory.count({
      where: { productId, NOT: { reason: 'OPENING_STOCK' } }
    });
    const totalTransactions = linkedBillCount + linkedPurchaseCount + linkedStockMovements;

    if (totalTransactions > 0) {
      throw new ApiError(400, `Primary unit, multi-unit settings, and conversion factor cannot be modified after sales, purchases, or inventory movements have occurred (${totalTransactions} linked records found).`);
    }
  }

  // Rule 1 & 4: Final-state validation on merged multi-unit fields and clearing stale fields
  let finalSecondaryUnit = mergedSecondaryUnit;
  let finalConversionFactor = mergedConversionFactor;
  let finalSecondaryPurchasePrice = mergedSecondaryPurchasePrice;
  let finalPurchasePrice = bodyData.purchasePrice !== undefined ? parseFloat(bodyData.purchasePrice) : product.purchasePrice;

  if (mergedHasSecondaryUnit) {
    if (!mergedSecondaryUnit || !mergedSecondaryUnit.trim()) {
      throw new ApiError(400, 'Secondary Unit is required when Multi-Unit is enabled.');
    }
    if (!mergedConversionFactor || mergedConversionFactor <= 0) {
      throw new ApiError(400, 'Conversion factor must be greater than 0 when Multi-Unit is enabled.');
    }
    if (!mergedSecondaryPurchasePrice || mergedSecondaryPurchasePrice <= 0) {
      throw new ApiError(400, 'Secondary purchase price must be greater than 0 when Multi-Unit is enabled.');
    }
    if (finalPurchasePrice <= 0) {
      finalPurchasePrice = Math.round((mergedSecondaryPurchasePrice / mergedConversionFactor) * 100) / 100;
    }
  } else {
    // Rule 4: Clear secondary fields when hasSecondaryUnit = false
    finalSecondaryUnit = null;
    finalConversionFactor = 1;
    finalSecondaryPurchasePrice = null;
  }

  // Rule 10: Category / SubCategory tenant ownership check
  let updateCatId = product.categoryId;
  let updateSubCatId = product.subCategoryId;
  if (bodyData.categoryId || bodyData.subCategoryId) {
    updateCatId = bodyData.categoryId || product.categoryId;
    updateSubCatId = bodyData.subCategoryId || product.subCategoryId;

    const category = await prisma.category.findUnique({ where: { id: updateCatId } });
    if (!category) throw new ApiError(404, 'Category not found.');

    const subCategory = await prisma.subCategory.findFirst({
      where: { id: updateSubCatId, categoryId: updateCatId }
    });
    if (!subCategory) throw new ApiError(404, 'Sub-Category not found under specified Category.');
  }

  let parsedAdditionalValues = bodyData.additionalValues;
  if (typeof parsedAdditionalValues === 'string') {
    try { parsedAdditionalValues = JSON.parse(parsedAdditionalValues); } catch (e) {}
  }

  let uploadedImageUrl = product.productImage;
  if (bodyData.productImage !== undefined) {
    if (bodyData.productImage) {
      const uploadRes = await uploadToCloudinary(bodyData.productImage, 'billing_saas/products');
      if (uploadRes && uploadRes.url) {
        if (product.productImage && product.productImage !== uploadRes.url) {
          await deleteFromCloudinary(product.productImage);
        }
        uploadedImageUrl = uploadRes.url;
      }
    } else {
      if (product.productImage) {
        await deleteFromCloudinary(product.productImage);
      }
      uploadedImageUrl = null;
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(bodyData.name && { name: bodyData.name.trim() }),
      sku: normalizedSku,
      ...(bodyData.hsnCode !== undefined && { hsnCode: bodyData.hsnCode ? bodyData.hsnCode.trim() : null }),
      ...(bodyData.brand !== undefined && { brand: bodyData.brand ? bodyData.brand.trim() : null }),
      unit: mergedUnit,
      hasSecondaryUnit: mergedHasSecondaryUnit,
      secondaryUnit: finalSecondaryUnit,
      conversionFactor: finalConversionFactor,
      secondaryPurchasePrice: finalSecondaryPurchasePrice,
      purchasePrice: finalPurchasePrice,
      ...(bodyData.sellingPrice !== undefined && { sellingPrice: parseFloat(bodyData.sellingPrice) }),
      ...(bodyData.mrp !== undefined && { mrp: parseFloat(bodyData.mrp) }),
      ...(bodyData.taxType !== undefined || bodyData.taxMode !== undefined ? { taxType: bodyData.taxType || bodyData.taxMode } : {}),
      ...(bodyData.discountPercent !== undefined && { discountPercent: parseFloat(bodyData.discountPercent) }),
      ...(bodyData.taxId !== undefined || bodyData.taxPercent !== undefined ? { taxId: await resolveTaxId(tenantId, bodyData.taxId, bodyData.taxPercent, bodyData.taxType || product.taxType) } : {}),
      ...(bodyData.maxStockLevel !== undefined && { maxStockLevel: parseFloat(bodyData.maxStockLevel) }),
      ...(bodyData.minStockLevel !== undefined && { minStockLevel: parseFloat(bodyData.minStockLevel) }),
      ...(bodyData.stockAlertQuantity !== undefined && { stockAlertQuantity: parseFloat(bodyData.stockAlertQuantity) }),
      ...(bodyData.enableStockAlert !== undefined && { enableStockAlert: Boolean(bodyData.enableStockAlert) }),
      ...(bodyData.productImage !== undefined && { productImage: uploadedImageUrl }),
      ...(bodyData.description !== undefined && { description: bodyData.description }),
      ...(bodyData.expiryDate !== undefined && { expiryDate: bodyData.expiryDate ? new Date(bodyData.expiryDate) : null }),
      ...(parsedAdditionalValues !== undefined && { additionalValues: parsedAdditionalValues }),
      ...(bodyData.status && { status: bodyData.status.toUpperCase() === 'INACTIVE' || bodyData.status.toUpperCase() === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE' })
    },
    include: { category: true, subCategory: true, tax: true }
  });
  return formatSingleProduct(updatedProduct);
};

export const deleteProduct = async (tenantId, productId) => {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  if (product.productImage) {
    await deleteFromCloudinary(product.productImage);
  }

  return await prisma.product.update({
    where: { id: productId },
    data: { status: 'SUSPENDED' }
  });
};

export const adjustProductStock = async (tenantId, userId, productId, data = {}) => {
  const { quantityChange, reason = 'STOCK_ADJUSTMENT', notes } = data;
  const change = parseFloat(quantityChange);
  if (isNaN(change) || change === 0) {
    throw new ApiError(400, 'Quantity change must be a non-zero number.');
  }

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const previousStock = product.currentStock;
  const updatedStock = previousStock + change;

  if (updatedStock < 0) {
    throw new ApiError(400, `Cannot reduce stock below 0. Current stock is ${previousStock}.`);
  }

  return await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { currentStock: updatedStock }
    });

    const history = await tx.stockHistory.create({
      data: {
        tenantId,
        productId,
        previousStock,
        addedRemovedQty: change,
        updatedStock,
        reason: reason || 'STOCK_ADJUSTMENT',
        updatedByUserId: userId
      }
    });

    return { product: formatSingleProduct(updatedProduct), history };
  });
};

export const importProducts = async (tenantId, userId, productsArray = []) => {
  if (!Array.isArray(productsArray) || productsArray.length === 0) {
    throw new ApiError(400, 'At least one valid product record is required for import.');
  }

  let defaultCategory = await prisma.category.findFirst();
  let defaultSubCategory = await prisma.subCategory.findFirst();

  let importedCount = 0;
  const importedProducts = [];

  for (const item of productsArray) {
    if (!item.name || !item.name.trim()) continue;

    // Resolve Category by ID or Name
    let catId = item.categoryId;
    if (!catId && item.categoryName) {
      const foundCat = await prisma.category.findFirst({ where: { name: { equals: item.categoryName.trim(), mode: 'insensitive' } } });
      if (foundCat) catId = foundCat.id;
    }
    if (!catId) catId = defaultCategory?.id;

    // Resolve SubCategory by ID or Name
    let subCatId = item.subCategoryId;
    if (!subCatId && item.subCategoryName && catId) {
      const foundSub = await prisma.subCategory.findFirst({
        where: { categoryId: catId, name: { equals: item.subCategoryName.trim(), mode: 'insensitive' } }
      });
      if (foundSub) subCatId = foundSub.id;
    }
    if (!subCatId) subCatId = defaultSubCategory?.id;

    if (!catId || !subCatId) continue;

    // Ensure unique SKU per tenant
    let sku = item.sku && item.sku.trim() ? item.sku.trim() : `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existingSKU = await prisma.product.findFirst({ where: { tenantId, sku, status: 'ACTIVE' } });
    if (existingSKU) {
      sku = `SKU-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    const hsnCode = item.hsnCode && item.hsnCode.trim() ? item.hsnCode.trim() : '999999';
    const isMultiUnit = Boolean(item.hasSecondaryUnit);
    const parsedConversion = item.conversionFactor ? parseFloat(item.conversionFactor) : 1;
    const parsedSecPrice = item.secondaryPurchasePrice ? parseFloat(item.secondaryPurchasePrice) : null;
    let purchasePrice = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;
    if (isMultiUnit && parsedSecPrice && parsedConversion > 0 && purchasePrice <= 0) {
      purchasePrice = Math.round((parsedSecPrice / parsedConversion) * 100) / 100;
    }

    const openingStock = item.openingStock !== undefined && item.openingStock !== null ? parseFloat(item.openingStock) : 0;
    const resolvedTaxType = (item.taxType || '').toUpperCase() === 'EXEMPT' ? 'EXEMPT' : ((item.taxType || '').toUpperCase() === 'NON_GST' ? 'NON_GST' : (item.taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'GST'));
    const taxId = await resolveTaxId(tenantId, item.taxId, item.taxPercent, resolvedTaxType);

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          tenantId,
          categoryId: catId,
          subCategoryId: subCatId,
          name: item.name.trim(),
          sku,
          hsnCode,
          brand: item.brand ? item.brand.trim() : null,
          unit: item.unit ? item.unit.trim() : 'Pcs',
          hasSecondaryUnit: isMultiUnit,
          secondaryUnit: isMultiUnit && item.secondaryUnit ? item.secondaryUnit.trim() : null,
          conversionFactor: isMultiUnit ? parsedConversion : 1,
          secondaryPurchasePrice: isMultiUnit ? parsedSecPrice : null,
          purchasePrice,
          sellingPrice: item.sellingPrice ? parseFloat(item.sellingPrice) : 100,
          mrp: item.mrp ? parseFloat(item.mrp) : (item.sellingPrice ? parseFloat(item.sellingPrice) : 100),
          taxType: resolvedTaxType,
          discountPercent: item.discountPercent ? parseFloat(item.discountPercent) : 0,
          taxId,
          openingStock,
          currentStock: openingStock,
          minStockLevel: item.minStockLevel ? parseFloat(item.minStockLevel) : 5,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          status: 'ACTIVE'
        }
      });

      if (openingStock > 0) {
        await tx.stockHistory.create({
          data: {
            tenantId,
            productId: p.id,
            previousStock: 0,
            addedRemovedQty: openingStock,
            updatedStock: openingStock,
            reason: 'OPENING_STOCK',
            updatedByUserId: userId
          }
        });
      }

      return p;
    });

    importedProducts.push(product);
    importedCount++;
  }

  return { importedCount, products: importedProducts };
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
      { hsnCode: { contains: search, mode: 'insensitive' } }
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
    hsnCode: p.hsnCode || 'N/A',
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
