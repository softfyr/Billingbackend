import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';
import { recordStockMovement, resolveProductUnit } from '../../services/stockMovement.service.js';


export const getInventory = async (tenantId, filters = {}) => {
  const { categoryId, subCategoryId, statusFilter, search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let categoryClause = categoryId ? Prisma.sql`AND "categoryId" = ${categoryId}` : Prisma.empty;
  let subCategoryClause = subCategoryId ? Prisma.sql`AND "subCategoryId" = ${subCategoryId}` : Prisma.empty;
  let searchClause = Prisma.empty;
  if (search) {
    const searchPattern = `%${search}%`;
    searchClause = Prisma.sql`AND ("name" ILIKE ${searchPattern} OR "sku" ILIKE ${searchPattern} OR "hsnCode" ILIKE ${searchPattern})`;
  }

  let statusClause = Prisma.empty;
  const normStatus = statusFilter ? String(statusFilter).toUpperCase().trim() : 'ALL';

  if (normStatus === 'EXPIRED') {
    statusClause = Prisma.sql`AND "expiryDate" IS NOT NULL AND "expiryDate" < ${now}`;
  } else if (normStatus === 'OUT_OF_STOCK') {
    statusClause = Prisma.sql`AND "currentStock" <= 0 AND ("expiryDate" IS NULL OR "expiryDate" >= ${now})`;
  } else if (normStatus === 'OVER_STOCK') {
    statusClause = Prisma.sql`AND "currentStock" > 0 AND "maxStockLevel" > 0 AND "currentStock" > "maxStockLevel" AND ("expiryDate" IS NULL OR "expiryDate" >= ${now})`;
  } else if (normStatus === 'LOW_STOCK') {
    statusClause = Prisma.sql`AND "currentStock" > 0 AND "currentStock" <= "minStockLevel" AND NOT ("maxStockLevel" > 0 AND "currentStock" > "maxStockLevel") AND ("expiryDate" IS NULL OR "expiryDate" >= ${now})`;
  } else if (normStatus === 'REORDER_REQUIRED') {
    statusClause = Prisma.sql`AND "currentStock" > 0 AND "currentStock" <= COALESCE("reorderLevel", 10) AND NOT ("currentStock" <= "minStockLevel") AND NOT ("maxStockLevel" > 0 AND "currentStock" > "maxStockLevel") AND ("expiryDate" IS NULL OR "expiryDate" >= ${now})`;
  } else if (normStatus === 'EXPIRING_SOON') {
    statusClause = Prisma.sql`AND "currentStock" > 0 AND "expiryDate" IS NOT NULL AND "expiryDate" >= ${now} AND "expiryDate" <= ${thirtyDaysFromNow} AND NOT ("currentStock" <= COALESCE("reorderLevel", 10)) AND NOT ("currentStock" <= "minStockLevel") AND NOT ("maxStockLevel" > 0 AND "currentStock" > "maxStockLevel")`;
  } else if (normStatus === 'IN_STOCK') {
    statusClause = Prisma.sql`AND "currentStock" > 0 AND ("expiryDate" IS NULL OR "expiryDate" > ${thirtyDaysFromNow}) AND NOT ("currentStock" <= COALESCE("reorderLevel", 10)) AND NOT ("currentStock" <= "minStockLevel") AND NOT ("maxStockLevel" > 0 AND "currentStock" > "maxStockLevel")`;
  }

  // 1. DB-level Count
  const countResult = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "Product"
    WHERE "tenantId" = ${tenantId}
      AND "status"::text = 'ACTIVE'
      ${categoryClause}
      ${subCategoryClause}
      ${searchClause}
      ${statusClause}
  `;

  const totalCount = countResult[0]?.count || 0;

  if (totalCount === 0) {
    return formatPaginatedResult([], 0, page, limit, { items: [] });
  }

  // 2. DB-level Pagination
  const idRows = await prisma.$queryRaw`
    SELECT id
    FROM "Product"
    WHERE "tenantId" = ${tenantId}
      AND "status"::text = 'ACTIVE'
      ${categoryClause}
      ${subCategoryClause}
      ${searchClause}
      ${statusClause}
    ORDER BY "currentStock" ASC, "id" ASC
    LIMIT ${take} OFFSET ${skip}
  `;

  const ids = idRows.map(r => r.id);

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { category: true, subCategory: true }
  });

  // Preserve deterministic SQL order
  const productMap = new Map(products.map(p => [p.id, p]));
  const orderedProducts = ids.map(id => productMap.get(id)).filter(Boolean);

  const items = orderedProducts.map(product => {
    let stockStatus = 'IN_STOCK';
    const isExpired = Boolean(product.expiryDate && new Date(product.expiryDate) < now);
    const isExpiringSoon = Boolean(product.expiryDate && new Date(product.expiryDate) >= now && new Date(product.expiryDate) <= thirtyDaysFromNow);
    const isOverstock = Boolean(product.maxStockLevel > 0 && product.currentStock > product.maxStockLevel);
    const isLowStock = Boolean(product.currentStock > 0 && product.currentStock <= product.minStockLevel);
    const reorderThreshold = (product.reorderLevel !== null && product.reorderLevel !== undefined) ? product.reorderLevel : 10;
    const isReorderRequired = Boolean(product.currentStock > 0 && product.currentStock <= reorderThreshold);

    const activeAlerts = [];
    if (isExpired) activeAlerts.push('EXPIRED');
    if (product.currentStock <= 0 && !isExpired) activeAlerts.push('OUT_OF_STOCK');
    if (isOverstock) activeAlerts.push('OVER_STOCK');
    if (isLowStock) activeAlerts.push('LOW_STOCK');
    if (isReorderRequired) activeAlerts.push('REORDER_REQUIRED');
    if (isExpiringSoon) activeAlerts.push('EXPIRING_SOON');

    if (isExpired) {
      stockStatus = 'EXPIRED';
    } else if (product.currentStock <= 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (isOverstock) {
      stockStatus = 'OVER_STOCK';
    } else if (isLowStock) {
      stockStatus = 'LOW_STOCK';
    } else if (isReorderRequired) {
      stockStatus = 'REORDER_REQUIRED';
    } else if (isExpiringSoon) {
      stockStatus = 'EXPIRING_SOON';
    }

    const suggestedOrderQty = isReorderRequired
      ? Math.max(product.reorderQuantity || 50, (product.maxStockLevel > 0 ? product.maxStockLevel - product.currentStock : (product.reorderQuantity || 50)))
      : 0;

    return {
      ...product,
      stockStatus,
      activeAlerts,
      isExpired,
      isExpiringSoon,
      isOverstock,
      isLowStock,
      isReorderRequired,
      suggestedOrderQty
    };
  });

  return formatPaginatedResult(items, totalCount, page, limit, { items });
};

export const updateStockManual = async (tenantId, userId, data) => {
  const { productId, quantityChange, reason } = data;

  if (!productId || quantityChange === undefined || quantityChange === null || quantityChange === '' || !reason) {
    throw new ApiError(400, 'Product ID, Quantity Change, and Reason are required.');
  }

  const change = Number(quantityChange);
  if (!Number.isFinite(change) || change === 0) {
    throw new ApiError(400, 'Quantity Change must be a non-zero valid finite number (positive to add stock, negative to remove).');
  }

  const direction = change > 0 ? 'IN' : 'OUT';
  const absQty = Math.abs(change);

  const reasonMap = {
    'NEW_PURCHASE': 'PURCHASE',
    'MANUAL_ADJUSTMENT': 'STOCK_ADJUSTMENT',
    'STOCK_CORRECTION': 'CORRECTION',
    'DAMAGED': 'DAMAGE',
    'RETURN': 'SALES_RETURN',
    'EXPIRED_DISCARD': 'SPOILAGE'
  };

  const rawReason = String(reason).toUpperCase().trim();
  const normalizedReason = reasonMap[rawReason] || rawReason;

  if (normalizedReason === 'OPENING_STOCK') {
    throw new ApiError(400, 'OPENING_STOCK reason is restricted to initial product creation and cannot be used for manual stock updates.');
  }

  const validReasons = [
    'PURCHASE', 'SALE', 'SALES_RETURN', 'PURCHASE_RETURN', 
    'STOCK_ADJUSTMENT', 'DAMAGE', 'SPOILAGE', 'CORRECTION', 'CANCELLED_BILL', 'LOST'
  ];
  
  if (!validReasons.includes(normalizedReason)) {
    throw new ApiError(400, `Invalid stock movement reason '${reason}'. Valid reasons are: ${validReasons.join(', ')}.`);
  }
  const finalReason = normalizedReason;

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    const { resolvedUnit } = resolveProductUnit(data.unit, product);

    const result = await recordStockMovement(tx, {
      tenantId,
      userId,
      productId,
      quantity: absQty,
      unit: resolvedUnit,
      direction,
      reason: finalReason,
      referenceType: 'STOCK_ADJUSTMENT',
      referenceId: data.referenceId || null,
      notes: data.notes || data.customReason || `Manual Stock Adjustment (${finalReason})`
    });

    return { product: result.product, history: result.history };
  });
};

export const reconcilePhysicalStock = async (tenantId, userId, data) => {
  const { productId, physicalCount, notes, unit } = data;

  if (!productId) {
    throw new ApiError(400, 'Product ID is required.');
  }

  const pCount = Number(physicalCount);
  if (physicalCount === undefined || physicalCount === null || physicalCount === '' || !Number.isFinite(pCount) || pCount < 0) {
    throw new ApiError(400, 'Physical Count must be a valid non-negative number.');
  }

  return await prisma.$transaction(async (tx) => {
    // Transaction Read Consistency: Fetch fresh Product INSIDE interactive transaction!
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId }
    });

    if (!product) {
      throw new ApiError(404, 'Product not found for this tenant.');
    }

    const { resolvedUnit, isSecondary, conversionFactor } = resolveProductUnit(unit, product);

    const physicalBaseQty = pCount * conversionFactor;
    const currentBaseStock = Number(product.currentStock);
    const diffBaseQty = physicalBaseQty - currentBaseStock;

    if (diffBaseQty === 0) {
      return {
        message: 'Physical stock matches current system stock perfectly. No movement recorded.',
        product,
        difference: 0
      };
    }

    const direction = diffBaseQty > 0 ? 'IN' : 'OUT';
    const absBaseQty = Math.abs(diffBaseQty);
    const movementQty = isSecondary ? (absBaseQty / conversionFactor) : absBaseQty;

    const result = await recordStockMovement(tx, {
      tenantId,
      userId,
      productId,
      quantity: movementQty,
      unit: resolvedUnit,
      direction,
      reason: 'STOCK_ADJUSTMENT',
      referenceType: 'STOCK_RECONCILIATION',
      referenceId: data.referenceId || null,
      notes: notes || `Physical Stock Reconciliation: Entered ${pCount} ${resolvedUnit} (System had ${currentBaseStock} ${product.unit || 'Pcs'}, Diff: ${diffBaseQty > 0 ? '+' : ''}${diffBaseQty} ${product.unit || 'Pcs'})`
    });

    return { product: result.product, history: result.history, difference: diffBaseQty };
  });
};

export const recordDamageStock = async (tenantId, userId, data) => {
  const { productId, damagedQuantity, unit, notes, referenceId } = data;

  if (!productId) throw new ApiError(400, 'Product ID is required.');
  const qty = Number(damagedQuantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ApiError(400, 'Damaged Quantity must be a valid positive number.');
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new ApiError(404, 'Product not found.');

    const { resolvedUnit } = resolveProductUnit(unit, product);

    const result = await recordStockMovement(tx, {
      tenantId,
      userId,
      productId,
      quantity: qty,
      unit: resolvedUnit,
      direction: 'OUT',
      reason: 'DAMAGE',
      referenceType: 'STOCK_DAMAGE',
      referenceId: referenceId || null,
      notes: notes || 'Stock written off due to damage'
    });

    return { product: result.product, history: result.history };
  });
};

export const recordLostStock = async (tenantId, userId, data) => {
  const { productId, lostQuantity, unit, notes, referenceId } = data;

  if (!productId) throw new ApiError(400, 'Product ID is required.');
  const qty = Number(lostQuantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ApiError(400, 'Lost Quantity must be a valid positive number.');
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new ApiError(404, 'Product not found.');

    const { resolvedUnit } = resolveProductUnit(unit, product);

    const result = await recordStockMovement(tx, {
      tenantId,
      userId,
      productId,
      quantity: qty,
      unit: resolvedUnit,
      direction: 'OUT',
      reason: 'LOST',
      referenceType: 'STOCK_LOST',
      referenceId: referenceId || null,
      notes: notes || 'Stock written off due to loss/theft'
    });

    return { product: result.product, history: result.history };
  });
};

export const getExpiryAlerts = async (tenantId, filters = {}) => {
  const { days = 30 } = filters;
  const numDays = Number(days);
  if (!Number.isFinite(numDays) || numDays <= 0) {
    throw new ApiError(400, "Invalid days parameter. 'days' must be a positive integer.");
  }

  const now = new Date();

  // Expiry date semantics: include items expiring up through the end of target day (23:59:59.999Z)
  const targetExpiryDate = new Date();
  targetExpiryDate.setDate(targetExpiryDate.getDate() + numDays);
  targetExpiryDate.setUTCHours(23, 59, 59, 999);

  const d7 = new Date(); d7.setDate(d7.getDate() + 7); d7.setUTCHours(23, 59, 59, 999);
  const d15 = new Date(); d15.setDate(d15.getDate() + 15); d15.setUTCHours(23, 59, 59, 999);
  const d30 = new Date(); d30.setDate(d30.getDate() + 30); d30.setUTCHours(23, 59, 59, 999);
  const d60 = new Date(); d60.setDate(d60.getDate() + 60); d60.setUTCHours(23, 59, 59, 999);
  const d90 = new Date(); d90.setDate(d90.getDate() + 90); d90.setUTCHours(23, 59, 59, 999);

  const baseWhere = { tenantId, status: 'ACTIVE' };

  // Phase 8 DB-Level Filtering: Execute DB queries in parallel for high-concurrency performance
  const [
    expiredProducts,
    expiringSoonProducts,
    within7Days,
    within15Days,
    within30Days,
    within60Days,
    within90Days
  ] = await Promise.all([
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { lt: now } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    }),
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { gte: now, lte: targetExpiryDate } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    }),
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { gte: now, lte: d7 } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    }),
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { gte: now, lte: d15 } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    }),
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { gte: now, lte: d30 } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    }),
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { gte: now, lte: d60 } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    }),
    prisma.product.findMany({
      where: { ...baseWhere, expiryDate: { gte: now, lte: d90 } },
      include: { category: true, subCategory: true },
      orderBy: { expiryDate: 'asc' }
    })
  ]);

  return {
    timeframeDays: numDays,
    expiredProducts,
    expiringSoonProducts,
    buckets: {
      expiredCount: expiredProducts.length,
      within7DaysCount: within7Days.length,
      within15DaysCount: within15Days.length,
      within30DaysCount: within30Days.length,
      within60DaysCount: within60Days.length,
      within90DaysCount: within90Days.length,
      within7Days,
      within15Days,
      within30Days,
      within60Days,
      within90Days
    }
  };
};

export const exportInventoryLogs = async (tenantId, filters = {}) => {
  const { productId, reason, startDate, endDate, limit } = filters;
  const where = { tenantId };

  if (productId) where.productId = productId;
  if (reason) where.reason = reason;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      if (typeof endDate === 'string' && !endDate.includes('T')) {
        end.setUTCHours(23, 59, 59, 999);
      } else if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
        end.setUTCHours(23, 59, 59, 999);
      }
      where.createdAt.lte = end;
    }
  }

  const queryOptions = {
    where,
    select: {
      id: true,
      createdAt: true,
      previousStock: true,
      addedRemovedQty: true,
      updatedStock: true,
      reason: true,
      movementQuantity: true,
      movementUnit: true,
      baseQuantity: true,
      baseUnit: true,
      referenceType: true,
      referenceId: true,
      notes: true,
      product: { select: { name: true, sku: true, unit: true } },
      updatedByUser: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  };

  if (limit) {
    const take = Number(limit);
    if (Number.isFinite(take) && take > 0) {
      queryOptions.take = take;
    }
  }

  const logs = await prisma.stockHistory.findMany(queryOptions);

  return logs.map(l => ({
    id: l.id,
    date: l.createdAt ? l.createdAt.toISOString().replace('T', ' ').split('.')[0] : '',
    productName: l.product ? l.product.name : 'N/A',
    sku: l.product ? l.product.sku : 'N/A',
    movementQuantity: l.movementQuantity !== null && l.movementQuantity !== undefined ? l.movementQuantity : Math.abs(l.addedRemovedQty),
    movementUnit: l.movementUnit || (l.product ? l.product.unit : 'Pcs'),
    baseQuantity: l.baseQuantity !== null && l.baseQuantity !== undefined ? l.baseQuantity : Math.abs(l.addedRemovedQty),
    baseUnit: l.baseUnit || (l.product ? l.product.unit : 'Pcs'),
    previousStock: l.previousStock,
    changeQty: l.addedRemovedQty,
    updatedStock: l.updatedStock,
    reason: l.reason,
    referenceType: l.referenceType || 'STOCK_MOVEMENT',
    referenceId: l.referenceId || null,
    notes: l.notes || null,
    updatedBy: l.updatedByUser ? l.updatedByUser.name : 'System'
  }));
};

