import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Standardized 4-decimal place quantity rounding helper.
 * Ensures consistent precision across all stock engine calculations (e.g. 12.5000, 2.7500, 0.1250).
 * @param {number|string} qty - Raw quantity number or string
 * @returns {number} Rounded quantity to max 4 decimal places
 */
export const roundQuantity = (qty) => {
  const parsed = Number(qty);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 10000) / 10000;
};

/**
 * Centralized product unit resolver.
 * Validates requested unit against product primary/secondary units and computes conversion factor.
 * 
 * @param {string} [requestedUnit] - Unit requested by caller (e.g. 'Box', 'Pcs')
 * @param {object} product - Product database record containing unit attributes
 * @param {number} [itemConversionFactor] - Optional historical conversion factor snapshot
 * @returns {object} { primaryUnit, secondaryUnit, resolvedUnit, isSecondary, conversionFactor }
 */
export const resolveProductUnit = (requestedUnit, product, itemConversionFactor = null) => {
  if (!product) {
    const defaultUnit = (requestedUnit || 'Pcs').trim();
    return {
      primaryUnit: defaultUnit,
      secondaryUnit: null,
      resolvedUnit: defaultUnit,
      isSecondary: false,
      conversionFactor: 1
    };
  }

  const primaryUnit = (product.unit || 'Pcs').trim();
  const secondaryUnit = product.secondaryUnit ? product.secondaryUnit.trim() : null;

  const pUnitUpper = primaryUnit.toUpperCase();
  const sUnitUpper = secondaryUnit ? secondaryUnit.toUpperCase() : '';
  const rUnitUpper = (requestedUnit || '').trim().toUpperCase();

  if (rUnitUpper) {
    const matchesPrimary = rUnitUpper === pUnitUpper;
    const matchesSecondary = Boolean(product.hasSecondaryUnit && sUnitUpper && rUnitUpper === sUnitUpper);

    if (!matchesPrimary && !matchesSecondary) {
      const allowedStr = product.hasSecondaryUnit && secondaryUnit 
        ? `'${primaryUnit}' or '${secondaryUnit}'` 
        : `'${primaryUnit}'`;
      throw new ApiError(400, `Invalid unit '${requestedUnit}' for product '${product.name}'. Allowed units: ${allowedStr}.`);
    }
  }

  const resolvedUnit = rUnitUpper
    ? (rUnitUpper === pUnitUpper ? primaryUnit : (secondaryUnit || primaryUnit))
    : primaryUnit;

  const isSecondary = Boolean(
    product.hasSecondaryUnit && 
    sUnitUpper && 
    resolvedUnit.toUpperCase() === sUnitUpper
  );

  let rawFactor = itemConversionFactor !== undefined && itemConversionFactor !== null
    ? itemConversionFactor
    : product.conversionFactor;

  let conversionFactor = 1;
  if (isSecondary) {
    const parsedFactor = Number(rawFactor);
    if (rawFactor === undefined || rawFactor === null || !Number.isFinite(parsedFactor) || parsedFactor <= 0) {
      throw new ApiError(400, `Invalid conversion factor '${rawFactor}' for secondary unit '${product.secondaryUnit}' on product '${product.name}'. Conversion factor must be a positive finite number.`);
    }
    conversionFactor = parsedFactor;
  }

  return {
    primaryUnit,
    secondaryUnit,
    resolvedUnit,
    isSecondary,
    conversionFactor
  };
};

/**
 * Calculates base quantity using unit conversion factor if secondary unit was used.
 * Prioritizes historical item conversion factor over current product catalog conversion factor.
 * 
 * @param {number} quantity - Quantity in requested unit
 * @param {string} unit - Unit requested (e.g. Box, Pcs)
 * @param {object} product - Product record containing unit settings
 * @param {number} [itemConversionFactor] - Optional historical conversion factor snapshot
 * @returns {number} baseQuantity in primary unit
 */
export const calculateBaseQuantity = (quantity, unit, product, itemConversionFactor = null) => {
  if (typeof quantity === 'boolean' || quantity === null || quantity === undefined || (typeof quantity === 'string' && quantity.trim() === '')) {
    throw new ApiError(400, 'Invalid stock movement quantity: quantity is required and cannot be boolean or empty.');
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ApiError(400, `Invalid stock movement quantity '${quantity}'. Quantity must be a positive finite number.`);
  }

  const unitRes = resolveProductUnit(unit, product, itemConversionFactor);
  return roundQuantity(qty * unitRes.conversionFactor);
};

/**
 * Executes batch stock movements within a Prisma transaction.
 * Consolidates duplicate product lines and sorts deterministically by productId to prevent deadlocks.
 * Enforces atomic negative-stock checks for deductions and active tenant verification.
 * 
 * @param {object} tx - Prisma transaction client
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {Array<{productId: string, quantity?: number, baseQuantity?: number, movementQuantity?: number, movementUnit?: string, unit?: string, product?: object, conversionFactor?: number}>} params.items
 * @param {'IN' | 'OUT'} params.direction - 'IN' to increment, 'OUT' to decrement
 * @param {string} params.reason - StockReason enum value
 * @param {string} [params.referenceType] - Document type (e.g. 'BILL', 'PURCHASE_INVOICE', 'STOCK_ADJUSTMENT')
 * @param {string} [params.referenceId] - Linked document UUID
 * @param {string} [params.notes] - Human-readable document note
 * @returns {Promise<Array<object>>} - List of processed stock records
 */
export const recordBatchStockMovements = async (tx, {
  tenantId,
  userId,
  items,
  direction,
  reason,
  referenceType = null,
  referenceId = null,
  notes = null
}) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  // Explicit Strict Direction Validation
  const normalizedDirection = String(direction || '').toUpperCase().trim();
  if (!['IN', 'OUT'].includes(normalizedDirection)) {
    throw new ApiError(400, `Invalid stock movement direction '${direction}'. Direction must be 'IN' or 'OUT'.`);
  }

  // 1. Group & Consolidate duplicate products by productId
  const consolidatedMap = new Map();

  for (const item of items) {
    if (!item) {
      throw new ApiError(400, 'Invalid item in stock movement batch.');
    }
    if (!item.productId) {
      throw new ApiError(400, 'Product ID is required for all items in batch stock movement.');
    }

    let productObj = item.product;
    if (!productObj) {
      productObj = await tx.product.findFirst({
        where: { id: item.productId, tenantId, status: 'ACTIVE' }
      });
    }

    if (!productObj) {
      throw new ApiError(404, `Active product not found for ID '${item.productId}'.`);
    }

    // 0.3 Product tenant validation: Verify product.tenantId === tenantId
    if (productObj.tenantId !== tenantId) {
      throw new ApiError(403, `Product '${productObj.name}' does not belong to tenant '${tenantId}'.`);
    }

    // 0.5 Active product validation
    if (productObj.status !== 'ACTIVE') {
      throw new ApiError(400, `Product '${productObj.name}' is not active.`);
    }

    const itemFactor = item.conversionFactor !== undefined && item.conversionFactor !== null
      ? item.conversionFactor
      : undefined;

    const rawQty = item.quantity !== undefined ? item.quantity : item.qty;
    let baseQty;
    if (item.baseQuantity !== undefined && item.baseQuantity !== null && item.baseQuantity !== '') {
      const parsedBaseQty = Number(item.baseQuantity);
      if (!Number.isFinite(parsedBaseQty) || parsedBaseQty <= 0) {
        throw new ApiError(400, `Invalid base quantity '${item.baseQuantity}' for product '${productObj.name}'.`);
      }
      baseQty = roundQuantity(parsedBaseQty);
    } else {
      baseQty = calculateBaseQuantity(rawQty, item.unit || item.purchaseUnit, productObj, itemFactor);
    }

    const movementQty = item.movementQuantity !== undefined && item.movementQuantity !== null
      ? Number(item.movementQuantity)
      : (rawQty !== undefined && rawQty !== null ? Number(rawQty) : baseQty);

    const movementUnit = (item.movementUnit || item.unit || item.purchaseUnit || productObj.unit || 'Pcs').trim();

    if (consolidatedMap.has(item.productId)) {
      const existing = consolidatedMap.get(item.productId);
      existing.baseQuantity = roundQuantity(existing.baseQuantity + baseQty);
      existing.movementQuantity = roundQuantity(existing.movementQuantity + movementQty);
    } else {
      consolidatedMap.set(item.productId, {
        productId: item.productId,
        product: productObj,
        baseQuantity: baseQty,
        movementQuantity: roundQuantity(movementQty),
        movementUnit,
        baseUnit: (productObj.unit || 'Pcs').trim()
      });
    }
  }

  // 2. Sort deterministically by productId to prevent database deadlocks under concurrency
  const consolidatedItems = Array.from(consolidatedMap.values()).sort((a, b) => 
    a.productId.localeCompare(b.productId)
  );

  const results = [];

  // 3. Process stock movements atomically
  for (const item of consolidatedItems) {
    const { productId, product, baseQuantity, movementQuantity, movementUnit, baseUnit } = item;

    if (direction === 'OUT') {
      // Atomic Negative-Stock Guard: updateMany ensures stock >= baseQuantity at database execution time
      const updateResult = await tx.product.updateMany({
        where: { 
          id: productId, 
          tenantId, 
          status: 'ACTIVE', 
          currentStock: { gte: baseQuantity } 
        },
        data: { currentStock: { decrement: baseQuantity } }
      });

      if (updateResult.count === 0) {
        // Re-read current stock for error messaging
        const currentProd = await tx.product.findUnique({ where: { id: productId } });
        const avail = currentProd ? currentProd.currentStock : 0;
        throw new ApiError(400, `Insufficient stock for product '${product.name}'. Available: ${avail} ${product.unit || 'Pcs'}, Requested: ${baseQuantity} ${product.unit || 'Pcs'}.`);
      }
    } else {
      // Stock addition: Enforce tenantId and status ACTIVE in updateMany
      const updateResult = await tx.product.updateMany({
        where: { 
          id: productId, 
          tenantId, 
          status: 'ACTIVE' 
        },
        data: { currentStock: { increment: baseQuantity } }
      });

      if (updateResult.count === 0) {
        throw new ApiError(400, `Failed to update stock for product '${product.name}'. Product may be inactive or does not belong to tenant.`);
      }
    }

    // Refreshed stock state after atomic mutation
    const updatedProd = await tx.product.findUnique({ where: { id: productId } });
    const newStock = roundQuantity(updatedProd.currentStock);
    const prevStock = direction === 'OUT' 
      ? roundQuantity(newStock + baseQuantity) 
      : roundQuantity(newStock - baseQuantity);

    const addedRemovedQty = direction === 'OUT' ? -baseQuantity : baseQuantity;

    const historyData = {
      previousStock: prevStock,
      addedRemovedQty,
      updatedStock: newStock,
      reason,
      movementQuantity,
      movementUnit,
      baseQuantity,
      baseUnit,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      notes: notes || null
    };
    if (tenantId) historyData.tenant = { connect: { id: tenantId } };
    if (productId) historyData.product = { connect: { id: productId } };
    if (userId) historyData.updatedByUser = { connect: { id: userId } };

    const history = await tx.stockHistory.create({ data: historyData });

    results.push({ product: updatedProd, history, baseQuantity });
  }

  return results;
};

/**
 * Executes a single stock movement within a Prisma transaction.
 */
export const recordStockMovement = async (tx, {
  tenantId,
  userId,
  productId,
  quantity,
  unit,
  direction,
  reason,
  referenceType = null,
  referenceId = null,
  notes = null
}) => {
  const result = await recordBatchStockMovements(tx, {
    tenantId,
    userId,
    items: [{ productId, quantity, unit }],
    direction,
    reason,
    referenceType,
    referenceId,
    notes
  });
  return result[0] || null;
};

/**
 * Executes a database transaction function with automatic retries on serializability/deadlock conflicts.
 * @param {Function} transactionFn - Async function taking (tx) as argument
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 */
export const executeWithRetry = async (transactionFn, maxRetries = 3) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      return await prisma.$transaction(async (tx) => {
        return await transactionFn(tx);
      }, {
        maxWait: 5000,
        timeout: 15000
      });
    } catch (error) {
      // Prisma error code P2034 = Transaction failed due to a write conflict or deadlock
      if (error?.code === 'P2034' && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 50 * attempt));
        continue;
      }
      throw error;
    }
  }
};
