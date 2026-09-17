import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';
import { parseBoolean } from '../../utils/boolean.utility.js';
import { recordStockMovement } from '../../services/stockMovement.service.js';


export const formatSingleProduct = (product) => {
  if (!product) return null;
  const rawType = (product.taxType || '').toUpperCase();
  const isInc = ['INCLUSIVE', 'GST_INCLUSIVE'].includes(rawType);
  const taxMode = isInc ? 'INCLUSIVE' : 'EXCLUSIVE';
  const isExempt = ['EXEMPT', 'NON_GST'].includes(rawType);
  const taxPct = isExempt ? 0 : (product.tax?.percentage ?? (product.taxPercent ?? 0));

  const factor = (product.hasSecondaryUnit && product.conversionFactor > 1) ? product.conversionFactor : 1;
  const perPieceCost = (product.hasSecondaryUnit && product.secondaryPurchasePrice && factor > 1) 
    ? (product.secondaryPurchasePrice / factor) 
    : product.purchasePrice;

  return {
    ...product,
    taxType: isExempt ? rawType : 'GST',
    taxMode: taxMode,
    taxPercent: taxPct,
    taxRate: taxPct,
    perPieceCost: Math.round(perPieceCost * 100) / 100
  };
};

const resolveTaxId = async (tenantId, taxId, taxPercent, taxType, tx = prisma) => {
  const rawType = (taxType || '').toUpperCase();
  if (['EXEMPT', 'NON_GST'].includes(rawType)) {
    return null;
  }
  if (taxId) {
    const existingTax = await tx.tax.findFirst({
      where: { id: taxId, tenantId, status: 'ACTIVE' }
    });
    if (!existingTax) {
      throw new ApiError(400, 'Invalid tax selected for this tenant.');
    }
    return existingTax.id;
  }
  if (taxPercent !== undefined && taxPercent !== null && taxPercent !== '') {
    const pct = parseFloat(taxPercent) || 0;
    let taxRecord = await tx.tax.findFirst({
      where: { tenantId, percentage: pct, status: 'ACTIVE' }
    });
    if (!taxRecord) {
      taxRecord = await tx.tax.create({
        data: { tenantId, name: `${pct}% GST`, percentage: pct, status: 'ACTIVE' }
      });
    }
    return taxRecord.id;
  }
  return null;
};

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
    reorderLevel = 10,
    reorderQuantity = 50,
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
  if (sellingPrice === undefined || sellingPrice === null || parseFloat(sellingPrice) <= 0) {
    throw new ApiError(400, 'Valid Selling Price is required.');
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, 'Category not found.');

  // Category -> SubCategory strict ownership check
  const subCategory = await prisma.subCategory.findFirst({
    where: { id: subCategoryId, categoryId },
    include: { additionalFields: true }
  });
  if (!subCategory) throw new ApiError(400, 'Selected Sub-Category does not belong to the specified Category.');

  // Multi-unit validation & per-piece purchase price calculation
  const isMultiUnit = parseBoolean(hasSecondaryUnit);
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
    if (finalPurchasePrice <= 0) {
      finalPurchasePrice = Math.round((parsedSecPrice / parsedConversion) * 100) / 100;
    }
  }

  // Parse & validate required custom fields
  let parsedAdditionalValues = additionalValues;
  if (typeof parsedAdditionalValues === 'string') {
    try { parsedAdditionalValues = JSON.parse(parsedAdditionalValues); } catch (e) { parsedAdditionalValues = {}; }
  }

  if (subCategory.additionalFields && subCategory.additionalFields.length > 0) {
    for (const field of subCategory.additionalFields) {
      if (field.isRequired && (!parsedAdditionalValues || parsedAdditionalValues[field.labelName] === undefined || parsedAdditionalValues[field.labelName] === null || String(parsedAdditionalValues[field.labelName]).trim() === '')) {
        throw new ApiError(400, `The field '${field.labelName}' is required for this Sub-Category.`);
      }
    }
  }

  if (subCategory.enableExpiryDate && (!expiryDate || !expiryDate.toString().trim())) {
    throw new ApiError(400, 'Expiry date is required for products under this Sub-Category.');
  }

  // SKU Normalization (UPPERCASE & Trimmed) & Unique Check
  const normalizedSku = sku && sku.trim() ? sku.trim().toUpperCase() : `SKU-${Date.now()}`;
  
  const existingSKU = await prisma.product.findFirst({ where: { tenantId, sku: normalizedSku, status: 'ACTIVE' } });
  if (existingSKU) throw new ApiError(409, `A product with SKU '${normalizedSku}' already exists in your store.`);

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
      const resolvedTaxId = await resolveTaxId(tenantId, taxId, taxPercent, resolvedTaxType, tx);

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
          currentStock: 0,
          maxStockLevel: maxStockLevel ? parseFloat(maxStockLevel) : 0,
          minStockLevel: minStockLevel ? parseFloat(minStockLevel) : 5,
          reorderLevel: reorderLevel !== undefined && reorderLevel !== null ? parseFloat(reorderLevel) : 10,
          reorderQuantity: reorderQuantity !== undefined && reorderQuantity !== null ? parseFloat(reorderQuantity) : 50,
          stockAlertQuantity: stockAlertQuantity ? parseFloat(stockAlertQuantity) : 5,
          enableStockAlert: parseBoolean(enableStockAlert, true),
          productImage: uploadedImageUrl,
          description: description || null,
          expiryDate: subCategory.enableExpiryDate && expiryDate ? new Date(expiryDate) : null,
          additionalValues: parsedAdditionalValues || {},
          status: (status || '').toUpperCase() === 'SUSPENDED' || (status || '').toUpperCase() === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE'
        },
        include: { category: true, subCategory: true, tax: true }
      });

      let finalProduct = product;

      if (initialStock > 0) {
        const movement = await recordStockMovement(tx, {
          tenantId,
          userId,
          productId: product.id,
          quantity: initialStock,
          direction: 'IN',
          reason: 'OPENING_STOCK',
          referenceType: 'PRODUCT_INIT',
          referenceId: product.id,
          notes: `Initial Opening Stock for ${product.name}`
        });
        finalProduct = {
          ...product,
          currentStock: movement.product.currentStock
        };
      }

      return formatSingleProduct(finalProduct);

    });
  } catch (error) {
    // Failed Image Upload Cleanup: If DB transaction fails, clean up uploaded Cloudinary image
    if (uploadedImageUrl) {
      await deleteFromCloudinary(uploadedImageUrl).catch(() => {});
    }
    if (error?.code === 'P2002') {
      throw new ApiError(409, `Product with SKU '${normalizedSku}' already exists in your store.`);
    }
    throw error;
  }
};

// High-Performance DB Aggregations & Actual Monetary totalStockValue Calculation
export const getProducts = async (tenantId, filters = {}) => {
  const { categoryId, subCategoryId, brand, status, search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { tenantId };
  const sUpper = status ? String(status).toUpperCase() : 'ALL';
  const now = new Date();

  if (sUpper === 'ACTIVE') {
    where.status = 'ACTIVE';
  } else if (sUpper === 'INACTIVE' || sUpper === 'DRAFT' || sUpper === 'SUSPENDED') {
    where.status = 'SUSPENDED';
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

  // Optimized DB Aggregations & Monetary Stock Valuation
  const [totalProductsCount, outOfStockCount, activeProductsForKPI, totalCount] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, status: 'ACTIVE', currentStock: { lte: 0 } } }),
    prisma.product.findMany({
      where: { tenantId, status: 'ACTIVE', currentStock: { gt: 0 } },
      select: { currentStock: true, minStockLevel: true, purchasePrice: true }
    }),
    prisma.product.count({ where })
  ]);

  let lowStockCount = 0;
  let totalStockValue = 0;
  for (let i = 0; i < activeProductsForKPI.length; i++) {
    const p = activeProductsForKPI[i];
    if (p.currentStock <= p.minStockLevel) {
      lowStockCount++;
    }
    totalStockValue += (p.currentStock * p.purchasePrice);
  }
  totalStockValue = Math.round(totalStockValue * 100) / 100;

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
      taxPercent: p.tax?.percentage ?? (['EXEMPT', 'NON_GST'].includes(p.taxType) ? 0 : (p.taxPercent ?? 0)),
      taxRate: p.tax?.percentage ?? (['EXEMPT', 'NON_GST'].includes(p.taxType) ? 0 : (p.taxPercent ?? 0)),
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

  return products.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel);
};

// Search product by SKU code
export const getProductBySku = async (tenantId, code) => {
  if (!code || !code.trim()) throw new ApiError(400, 'SKU code is required.');

  const cleanCode = code.trim();

  const product = await prisma.product.findFirst({
    where: {
      tenantId,
      status: 'ACTIVE',
      OR: [
        { sku: { equals: cleanCode, mode: 'insensitive' } }
      ]
    },
    include: { category: true, subCategory: true, tax: true }
  });

  if (!product) {
    throw new ApiError(404, `No product found matching SKU '${cleanCode}'.`);
  }

  return formatSingleProduct(product);
};

export const getProductByBarcodeOrSku = getProductBySku;
export const getProductByBarcode = getProductBySku;

// Paginated Stock History Sub-route & Limited Top 10 in Details
export const getProductDetails = async (tenantId, productId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      category: true,
      subCategory: { include: { additionalFields: true } },
      tax: true,
      stockHistory: {
        take: 10,
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

export const getProductStockHistory = async (tenantId, productId, filters = {}) => {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const { page, limit, skip, take } = getPaginationParams(filters, 10);
  const totalCount = await prisma.stockHistory.count({ where: { productId, tenantId } });

  const history = await prisma.stockHistory.findMany({
    where: { productId, tenantId },
    skip,
    take,
    include: { updatedByUser: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return formatPaginatedResult(history, totalCount, page, limit);
};

// Update Final-State Validation (Category, SubCategory, Custom Fields, Expiry) & Tax Consistency & Image Cleanup
export const updateProduct = async (tenantId, productId, data = {}) => {
  let bodyData = data;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) { }
  }

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  // Strict HSN Validation on Update
  if (bodyData.hsnCode !== undefined && (!bodyData.hsnCode || !String(bodyData.hsnCode).trim())) {
    throw new ApiError(400, 'HSN Code cannot be empty.');
  }

  // SKU Normalization & Duplicate check if changed
  const normalizedSku = bodyData.sku !== undefined ? (bodyData.sku ? bodyData.sku.trim().toUpperCase() : null) : product.sku;
  if (normalizedSku && normalizedSku !== product.sku) {
    const existingSKU = await prisma.product.findFirst({
      where: { tenantId, sku: normalizedSku, status: 'ACTIVE', NOT: { id: productId } }
    });
    if (existingSKU) throw new ApiError(409, `A product with SKU '${normalizedSku}' already exists in your store.`);
  }

  // Compute Merged Final-State for Multi-Unit parameters
  const mergedHasSecondaryUnit = bodyData.hasSecondaryUnit !== undefined ? parseBoolean(bodyData.hasSecondaryUnit) : product.hasSecondaryUnit;
  const mergedUnit = bodyData.unit !== undefined ? (bodyData.unit ? bodyData.unit.trim() : 'Pcs') : product.unit;
  const mergedSecondaryUnit = bodyData.secondaryUnit !== undefined ? (bodyData.secondaryUnit ? bodyData.secondaryUnit.trim() : null) : product.secondaryUnit;
  const mergedConversionFactor = bodyData.conversionFactor !== undefined ? parseFloat(bodyData.conversionFactor) : product.conversionFactor;
  const mergedSecondaryPurchasePrice = bodyData.secondaryPurchasePrice !== undefined ? (bodyData.secondaryPurchasePrice ? parseFloat(bodyData.secondaryPurchasePrice) : null) : product.secondaryPurchasePrice;

  // Unit / Conversion Factor change protection if transactions exist
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
    finalSecondaryUnit = null;
    finalConversionFactor = 1;
    finalSecondaryPurchasePrice = null;
  }

  // Category / SubCategory tenant ownership check & fetch with additionalFields
  const updateCatId = bodyData.categoryId || product.categoryId;
  const updateSubCatId = bodyData.subCategoryId || product.subCategoryId;

  const category = await prisma.category.findUnique({ where: { id: updateCatId } });
  if (!category) throw new ApiError(404, 'Category not found.');

  const subCategory = await prisma.subCategory.findFirst({
    where: { id: updateSubCatId, categoryId: updateCatId },
    include: { additionalFields: true }
  });
  if (!subCategory) throw new ApiError(400, 'Selected Sub-Category does not belong to specified Category.');

  // Validate Merged additionalValues against SubCategory required additionalFields
  let incomingAdditionalValues = bodyData.additionalValues;
  if (typeof incomingAdditionalValues === 'string') {
    try { incomingAdditionalValues = JSON.parse(incomingAdditionalValues); } catch (e) {}
  }

  const mergedAdditionalValues = {
    ...(product.additionalValues || {}),
    ...(incomingAdditionalValues || {})
  };

  if (subCategory.additionalFields && subCategory.additionalFields.length > 0) {
    for (const field of subCategory.additionalFields) {
      if (field.isRequired && (!mergedAdditionalValues || mergedAdditionalValues[field.labelName] === undefined || mergedAdditionalValues[field.labelName] === null || String(mergedAdditionalValues[field.labelName]).trim() === '')) {
        throw new ApiError(400, `The field '${field.labelName}' is required for this Sub-Category.`);
      }
    }
  }

  // Validate Merged Expiry Date if SubCategory requires expiry
  const mergedExpiryDate = bodyData.expiryDate !== undefined ? bodyData.expiryDate : product.expiryDate;
  if (subCategory.enableExpiryDate && (!mergedExpiryDate || !String(mergedExpiryDate).trim())) {
    throw new ApiError(400, 'Expiry date is required for products under this Sub-Category.');
  }

  // TaxType / TaxMode Update Consistency
  const rawTaxType = bodyData.taxType || bodyData.taxMode || product.taxType;
  const resolvedTaxType = ['EXEMPT', 'NON_GST'].includes((rawTaxType || '').toUpperCase())
    ? rawTaxType.toUpperCase()
    : (['INCLUSIVE', 'GST_INCLUSIVE'].includes((rawTaxType || '').toUpperCase()) ? 'INCLUSIVE' : 'GST');

  // Process Image Upload
  let newlyUploadedImageUrl = null;
  let uploadedImageUrl = product.productImage;
  let oldImageToDeleteLater = null;

  if (bodyData.productImage !== undefined) {
    if (bodyData.productImage) {
      const uploadRes = await uploadToCloudinary(bodyData.productImage, 'billing_saas/products');
      if (uploadRes && uploadRes.url) {
        newlyUploadedImageUrl = uploadRes.url;
        if (product.productImage && product.productImage !== uploadRes.url) {
          oldImageToDeleteLater = product.productImage;
        }
        uploadedImageUrl = uploadRes.url;
      }
    } else {
      if (product.productImage) {
        oldImageToDeleteLater = product.productImage;
      }
      uploadedImageUrl = null;
    }
  }

  try {
    const updatedProduct = await prisma.$transaction(async (tx) => {
      const resolvedTaxIdVal = (bodyData.taxId !== undefined || bodyData.taxPercent !== undefined || bodyData.taxType !== undefined || bodyData.taxMode !== undefined)
        ? await resolveTaxId(tenantId, bodyData.taxId !== undefined ? bodyData.taxId : product.taxId, bodyData.taxPercent !== undefined ? bodyData.taxPercent : product.taxPercent, resolvedTaxType, tx)
        : product.taxId;

      return await tx.product.update({
        where: { id: productId },
        data: {
          categoryId: updateCatId,
          subCategoryId: updateSubCatId,
          ...(bodyData.name && { name: bodyData.name.trim() }),
          sku: normalizedSku,
          ...(bodyData.hsnCode !== undefined && { hsnCode: bodyData.hsnCode.trim() }),
          ...(bodyData.brand !== undefined && { brand: bodyData.brand ? bodyData.brand.trim() : null }),
          unit: mergedUnit,
          hasSecondaryUnit: mergedHasSecondaryUnit,
          secondaryUnit: finalSecondaryUnit,
          conversionFactor: finalConversionFactor,
          secondaryPurchasePrice: finalSecondaryPurchasePrice,
          purchasePrice: finalPurchasePrice,
          ...(bodyData.sellingPrice !== undefined && { sellingPrice: parseFloat(bodyData.sellingPrice) }),
          ...(bodyData.mrp !== undefined && { mrp: parseFloat(bodyData.mrp) }),
          taxType: resolvedTaxType,
          ...(bodyData.discountPercent !== undefined && { discountPercent: parseFloat(bodyData.discountPercent) }),
          taxId: resolvedTaxIdVal,
          ...(bodyData.maxStockLevel !== undefined && { maxStockLevel: parseFloat(bodyData.maxStockLevel) }),
          ...(bodyData.minStockLevel !== undefined && { minStockLevel: parseFloat(bodyData.minStockLevel) }),
          ...(bodyData.reorderLevel !== undefined && { reorderLevel: parseFloat(bodyData.reorderLevel) }),
          ...(bodyData.reorderQuantity !== undefined && { reorderQuantity: parseFloat(bodyData.reorderQuantity) }),
          ...(bodyData.stockAlertQuantity !== undefined && { stockAlertQuantity: parseFloat(bodyData.stockAlertQuantity) }),
          ...(bodyData.enableStockAlert !== undefined && { enableStockAlert: parseBoolean(bodyData.enableStockAlert) }),
          ...(bodyData.productImage !== undefined && { productImage: uploadedImageUrl }),
          ...(bodyData.description !== undefined && { description: bodyData.description }),
          ...(bodyData.expiryDate !== undefined && { expiryDate: subCategory.enableExpiryDate && mergedExpiryDate ? new Date(mergedExpiryDate) : null }),
          additionalValues: mergedAdditionalValues,
          ...(bodyData.status && { status: bodyData.status.toUpperCase() === 'INACTIVE' || bodyData.status.toUpperCase() === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE' })
        },
        include: { category: true, subCategory: true, tax: true }
      });
    });

    // Delete old image ONLY after DB transaction commits successfully
    if (oldImageToDeleteLater) {
      await deleteFromCloudinary(oldImageToDeleteLater).catch(() => {});
    }

    return formatSingleProduct(updatedProduct);
  } catch (error) {
    // If DB transaction fails, clean up newly uploaded image to prevent orphaned Cloudinary files
    if (newlyUploadedImageUrl) {
      await deleteFromCloudinary(newlyUploadedImageUrl).catch(() => {});
    }
    if (error?.code === 'P2002') {
      throw new ApiError(409, `Product with SKU '${normalizedSku}' already exists in your store.`);
    }
    throw error;
  }
};

export const deleteProduct = async (tenantId, productId) => {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const deleted = await prisma.product.update({
    where: { id: productId },
    data: { status: 'SUSPENDED' }
  });

  if (product.productImage) {
    await deleteFromCloudinary(product.productImage).catch(() => {});
  }

  return deleted;
};

// Concurrency-Safe Atomic Stock Adjustments with Strict Atomic Negative-Stock Guard & Exact History Calculation
export const adjustProductStock = async (tenantId, userId, productId, data = {}) => {
  const { quantityChange, reason = 'STOCK_ADJUSTMENT' } = data;
  const change = parseFloat(quantityChange);
  if (isNaN(change) || change === 0) {
    throw new ApiError(400, 'Quantity change must be a non-zero number.');
  }

  const direction = change > 0 ? 'IN' : 'OUT';
  const absQty = Math.abs(change);

  return await prisma.$transaction(async (tx) => {
    const result = await recordStockMovement(tx, {
      tenantId,
      userId,
      productId,
      quantity: absQty,
      direction,
      reason: reason || 'STOCK_ADJUSTMENT'
    });

    return { product: formatSingleProduct(result.product), history: result.history };
  });
};

// Import with Detailed Row-Level Validation & Error Reporting (No Fake HSN 999999, No Fake Selling Price 100)
export const importProducts = async (tenantId, userId, productsArray = []) => {
  if (!Array.isArray(productsArray) || productsArray.length === 0) {
    throw new ApiError(400, 'At least one valid product record is required for import.');
  }

  let defaultCategory = await prisma.category.findFirst();
  let defaultSubCategory = defaultCategory
    ? await prisma.subCategory.findFirst({ where: { categoryId: defaultCategory.id }, include: { additionalFields: true } })
    : null;

  let importedCount = 0;
  const errors = [];
  const importedProducts = [];

  for (let i = 0; i < productsArray.length; i++) {
    const item = productsArray[i];
    const rowNum = i + 1;

    if (!item.name || !item.name.trim()) {
      errors.push({ row: rowNum, name: item.name || 'N/A', error: 'Product Name is required.' });
      continue;
    }

    if (!item.hsnCode || !item.hsnCode.trim()) {
      errors.push({ row: rowNum, name: item.name, error: 'HSN Code is required.' });
      continue;
    }

    if (item.sellingPrice === undefined || item.sellingPrice === null || parseFloat(item.sellingPrice) <= 0) {
      errors.push({ row: rowNum, name: item.name, error: 'Valid Selling Price (> 0) is required.' });
      continue;
    }

    // Resolve Category
    let catId = item.categoryId;
    if (!catId && item.categoryName) {
      const foundCat = await prisma.category.findFirst({ where: { name: { equals: item.categoryName.trim(), mode: 'insensitive' } } });
      if (foundCat) catId = foundCat.id;
    }
    if (!catId) catId = defaultCategory?.id;

    // Resolve SubCategory & Category-SubCategory Relationship Check
    let subCatObj = null;
    let subCatId = item.subCategoryId;
    if (subCatId) {
      subCatObj = await prisma.subCategory.findFirst({
        where: { id: subCatId, categoryId: catId },
        include: { additionalFields: true }
      });
    } else if (item.subCategoryName && catId) {
      subCatObj = await prisma.subCategory.findFirst({
        where: { categoryId: catId, name: { equals: item.subCategoryName.trim(), mode: 'insensitive' } },
        include: { additionalFields: true }
      });
      if (subCatObj) subCatId = subCatObj.id;
    }

    if (!subCatObj && defaultSubCategory && defaultSubCategory.categoryId === catId) {
      subCatObj = defaultSubCategory;
      subCatId = defaultSubCategory.id;
    }

    if (!catId || !subCatId || !subCatObj || subCatObj.categoryId !== catId) {
      errors.push({ row: rowNum, name: item.name, error: 'Sub-Category does not belong to the specified Category.' });
      continue;
    }

    // Multi-unit validation
    const isMultiUnit = parseBoolean(item.hasSecondaryUnit);
    const parsedConversion = item.conversionFactor ? parseFloat(item.conversionFactor) : 1;
    const parsedSecPrice = item.secondaryPurchasePrice ? parseFloat(item.secondaryPurchasePrice) : null;
    let purchasePrice = item.purchasePrice ? parseFloat(item.purchasePrice) : 0;

    if (isMultiUnit) {
      if (!item.secondaryUnit || !item.secondaryUnit.trim()) {
        errors.push({ row: rowNum, name: item.name, error: 'Secondary Unit is required when Multi-Unit is enabled.' });
        continue;
      }
      if (parsedConversion <= 0) {
        errors.push({ row: rowNum, name: item.name, error: 'Conversion factor must be greater than 0.' });
        continue;
      }
      if (!parsedSecPrice || parsedSecPrice <= 0) {
        errors.push({ row: rowNum, name: item.name, error: 'Secondary purchase price must be greater than 0.' });
        continue;
      }
      if (purchasePrice <= 0) {
        purchasePrice = Math.round((parsedSecPrice / parsedConversion) * 100) / 100;
      }
    }

    // Validate Required Custom Fields
    let parsedAdditionalValues = item.additionalValues;
    if (typeof parsedAdditionalValues === 'string') {
      try { parsedAdditionalValues = JSON.parse(parsedAdditionalValues); } catch (e) { parsedAdditionalValues = {}; }
    }

    let hasCustomFieldError = false;
    if (subCatObj.additionalFields && subCatObj.additionalFields.length > 0) {
      for (const field of subCatObj.additionalFields) {
        if (field.isRequired && (!parsedAdditionalValues || parsedAdditionalValues[field.labelName] === undefined || parsedAdditionalValues[field.labelName] === null || String(parsedAdditionalValues[field.labelName]).trim() === '')) {
          errors.push({ row: rowNum, name: item.name, error: `The field '${field.labelName}' is required for this Sub-Category.` });
          hasCustomFieldError = true;
          break;
        }
      }
    }
    if (hasCustomFieldError) continue;

    // Validate Expiry Date if required by Sub-Category
    if (subCatObj.enableExpiryDate && (!item.expiryDate || !String(item.expiryDate).trim())) {
      errors.push({ row: rowNum, name: item.name, error: 'Expiry date is required for products under this Sub-Category.' });
      continue;
    }

    // SKU Upper-case Normalization
    let sku = item.sku && item.sku.trim() ? item.sku.trim().toUpperCase() : `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const existingSKU = await prisma.product.findFirst({ where: { tenantId, sku, status: 'ACTIVE' } });
    if (existingSKU) {
      sku = `SKU-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    const hsnCode = item.hsnCode.trim();
    const openingStock = item.openingStock !== undefined && item.openingStock !== null ? parseFloat(item.openingStock) : 0;
    const resolvedTaxType = (item.taxType || '').toUpperCase() === 'EXEMPT' ? 'EXEMPT' : ((item.taxType || '').toUpperCase() === 'NON_GST' ? 'NON_GST' : (item.taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'GST'));

    try {
      const product = await prisma.$transaction(async (tx) => {
        const taxId = await resolveTaxId(tenantId, item.taxId, item.taxPercent, resolvedTaxType, tx);
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
            sellingPrice: parseFloat(item.sellingPrice),
            mrp: item.mrp ? parseFloat(item.mrp) : parseFloat(item.sellingPrice),
            taxType: resolvedTaxType,
            discountPercent: item.discountPercent ? parseFloat(item.discountPercent) : 0,
            taxId,
            openingStock,
            currentStock: openingStock,
            minStockLevel: item.minStockLevel ? parseFloat(item.minStockLevel) : 5,
            reorderLevel: item.reorderLevel ? parseFloat(item.reorderLevel) : 10,
            reorderQuantity: item.reorderQuantity ? parseFloat(item.reorderQuantity) : 50,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            additionalValues: parsedAdditionalValues || {},
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
              updatedByUserId: userId,
              movementQuantity: openingStock,
              movementUnit: p.unit || 'Pcs',
              baseQuantity: openingStock,
              baseUnit: p.unit || 'Pcs',
              referenceType: 'PRODUCT_EXCEL_IMPORT',
              referenceId: p.id,
              notes: `Initial Opening Stock via Excel Import for ${p.name}`
            }
          });
        }

        return p;
      });

      importedProducts.push(product);
      importedCount++;
    } catch (e) {
      errors.push({ row: rowNum, name: item.name, error: e.message || 'Product import creation failed.' });
    }
  }

  return { importedCount, skippedCount: errors.length, errors, products: importedProducts };
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
