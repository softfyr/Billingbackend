import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';

export const getInventory = async (tenantId, filters = {}) => {
  const { categoryId, subCategoryId, statusFilter, search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

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
    include: { category: true, subCategory: true },
    orderBy: { currentStock: 'asc' }
  });

  const now = new Date();

  // Compute computed Stock Status
  let items = products.map(product => {
    let stockStatus = 'IN_STOCK';

    if (product.expiryDate && new Date(product.expiryDate) < now) {
      stockStatus = 'EXPIRED';
    } else if (product.currentStock <= 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (product.currentStock <= product.minStockLevel) {
      stockStatus = 'LOW_STOCK';
    }

    return {
      ...product,
      stockStatus
    };
  });

  // Apply computed statusFilter if passed
  if (statusFilter && statusFilter !== 'ALL') {
    items = items.filter(item => item.stockStatus === statusFilter);
  }

  const totalCount = items.length;
  const paginatedItems = items.slice(skip, skip + take);

  return formatPaginatedResult(paginatedItems, totalCount, page, limit, { items: paginatedItems });
};

export const updateStockManual = async (tenantId, userId, data) => {
  const { productId, quantityChange, reason, customReason } = data;

  if (!productId || quantityChange === undefined || !reason) {
    throw new ApiError(400, 'Product ID, Quantity Change, and Reason are required.');
  }

  const change = parseInt(quantityChange);
  if (isNaN(change) || change === 0) {
    throw new ApiError(400, 'Quantity Change must be a non-zero integer (positive to add stock, negative to remove).');
  }

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const previousStock = product.currentStock;
  const updatedStock = previousStock + change;

  if (updatedStock < 0) {
    throw new ApiError(400, `Cannot reduce stock below 0. Current stock is ${previousStock}.`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Update Product Current Stock
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { currentStock: updatedStock }
    });

    // 2. Audit Log in StockHistory
    const history = await tx.stockHistory.create({
      data: {
        tenantId,
        productId,
        previousStock,
        addedRemovedQty: change,
        updatedStock,
        reason: reason || 'MANUAL_ADJUSTMENT',
        updatedByUserId: userId
      }
    });

    return { product: updatedProduct, history };
  });
};

export const getExpiryAlerts = async (tenantId) => {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiredProducts = await prisma.product.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      expiryDate: { lt: now }
    },
    include: { category: true, subCategory: true }
  });

  const expiringSoonProducts = await prisma.product.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      expiryDate: { gte: now, lte: thirtyDaysFromNow }
    },
    include: { category: true, subCategory: true }
  });

  return {
    expiredProducts,
    expiringSoonProducts
  };
};

export const exportInventoryLogs = async (tenantId, filters = {}) => {
  const { productId, reason, startDate, endDate } = filters;
  const where = { tenantId };

  if (productId) where.productId = productId;
  if (reason) where.reason = reason;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const logs = await prisma.stockHistory.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true } },
      updatedByUser: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return logs.map(l => ({
    date: l.createdAt ? l.createdAt.toISOString().replace('T', ' ').split('.')[0] : '',
    productName: l.product ? l.product.name : 'N/A',
    sku: l.product ? l.product.sku : 'N/A',
    previousStock: l.previousStock,
    changeQty: l.addedRemovedQty,
    updatedStock: l.updatedStock,
    reason: l.reason,
    updatedBy: l.updatedByUser ? l.updatedByUser.name : 'System'
  }));
};

