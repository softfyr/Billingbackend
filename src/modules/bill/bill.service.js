import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';

export const generateBill = async (tenantId, userId, data) => {
  const {
    customerMobile,
    customerName,
    items, // Array of { productId, quantity, discountAmount }
    discountType = 'NONE',
    discountValue = 0,
    paymentStatus = 'PAID',
    paymentMethod = 'CASH',
    paidAmountInput
  } = data;

  if (!customerMobile || !items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Customer mobile number and at least one bill item are required.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Customer Lookup / Creation
    let customer = await tx.customer.findFirst({ where: { tenantId, mobileNumber: customerMobile } });
    if (!customer) {
      if (!customerName) throw new ApiError(400, 'Customer Name is required for new customer registration.');
      customer = await tx.customer.create({
        data: {
          tenantId,
          mobileNumber: customerMobile,
          name: customerName
        }
      });
    }

    // 2. Validate Products & Calculate Totals
    let subtotal = 0;
    let totalTaxAmount = 0;
    const preparedItems = [];

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId, status: 'ACTIVE' },
        include: { tax: true }
      });

      if (!product) {
        throw new ApiError(404, `Product with ID '${item.productId}' not found or inactive.`);
      }

      const qty = parseInt(item.quantity);
      if (qty <= 0) throw new ApiError(400, `Invalid quantity '${qty}' for product '${product.name}'.`);

      if (product.currentStock < qty) {
        throw new ApiError(400, `Insufficient stock for product '${product.name}'. Available: ${product.currentStock}, Requested: ${qty}.`);
      }

      const unitPrice = product.sellingPrice;
      const itemDiscount = item.discountAmount ? parseFloat(item.discountAmount) : 0;
      const itemSubtotal = (unitPrice * qty) - itemDiscount;

      let taxPercent = 0;
      let taxAmount = 0;

      if (product.tax && product.tax.status === 'ACTIVE') {
        taxPercent = product.tax.percentage;
        taxAmount = (itemSubtotal * taxPercent) / 100;
      }

      const lineTotal = itemSubtotal + taxAmount;

      subtotal += itemSubtotal;
      totalTaxAmount += taxAmount;

      preparedItems.push({
        productId: product.id,
        product,
        sku: product.sku,
        quantity: qty,
        unitPrice,
        discountAmount: itemDiscount,
        taxPercent,
        taxAmount,
        lineTotal
      });
    }

    // 3. Calculate Discount
    let discountAmount = 0;
    const dVal = parseFloat(discountValue) || 0;

    if (discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * dVal) / 100;
    } else if (discountType === 'FIXED') {
      discountAmount = dVal;
    }

    const grandTotal = Math.max(0, subtotal + totalTaxAmount - discountAmount);

    // 4. Payment Amounts & Status
    let actualPaidAmount = 0;
    let actualDueAmount = 0;

    if (paymentStatus === 'PAID') {
      actualPaidAmount = grandTotal;
      actualDueAmount = 0;
    } else if (paymentStatus === 'UNPAID') {
      actualPaidAmount = 0;
      actualDueAmount = grandTotal;
    } else if (paymentStatus === 'PARTIALLY_PAID') {
      actualPaidAmount = paidAmountInput ? parseFloat(paidAmountInput) : 0;
      actualDueAmount = Math.max(0, grandTotal - actualPaidAmount);
    }

    // 5. Generate Invoice Number (Format: INV-1001)
    const billCount = await tx.bill.count({ where: { tenantId } });
    const invoiceNumber = `INV-${String(billCount + 1001)}`;

    // 6. Create Bill Record
    const bill = await tx.bill.create({
      data: {
        tenantId,
        invoiceNumber,
        customerId: customer.id,
        subtotal,
        totalTaxAmount,
        discountType,
        discountValue: dVal,
        discountAmount,
        grandTotal,
        paidAmount: actualPaidAmount,
        dueAmount: actualDueAmount,
        status: paymentStatus,
        paymentMethod,
        generatedByUserId: userId,
        items: {
          create: preparedItems.map(item => ({
            productId: item.productId,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxPercent: item.taxPercent,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal
          }))
        }
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        generatedBy: { select: { id: true, name: true, role: true } }
      }
    });

    // 7. Deduct Inventory Stock & Log StockHistory
    for (const item of preparedItems) {
      const prevStock = item.product.currentStock;
      const newStock = prevStock - item.quantity;

      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: newStock }
      });

      await tx.stockHistory.create({
        data: {
          tenantId,
          productId: item.productId,
          previousStock: prevStock,
          addedRemovedQty: -item.quantity,
          updatedStock: newStock,
          reason: 'SALE',
          updatedByUserId: userId
        }
      });
    }

    // 8. Update Customer Ledger
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        totalInvoices: { increment: 1 },
        totalPurchaseAmount: { increment: grandTotal },
        totalPaidAmount: { increment: actualPaidAmount },
        totalDueAmount: { increment: actualDueAmount },
        lastPurchaseDate: new Date()
      }
    });

    return bill;
  });
};

export const cancelBill = async (tenantId, userId, billId) => {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, tenantId },
    include: { items: true, customer: true }
  });

  if (!bill) throw new ApiError(404, 'Bill not found.');
  if (bill.status === 'CANCELLED') throw new ApiError(400, 'Bill is already cancelled.');

  return await prisma.$transaction(async (tx) => {
    // 1. Revert Stock for all items
    for (const item of bill.items) {
      const restorableQty = item.quantity - item.returnedQuantity;
      if (restorableQty > 0) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          const prevStock = product.currentStock;
          const newStock = prevStock + restorableQty;

          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: newStock }
          });

          await tx.stockHistory.create({
            data: {
              tenantId,
              productId: item.productId,
              previousStock: prevStock,
              addedRemovedQty: restorableQty,
              updatedStock: newStock,
              reason: 'CANCELLED_BILL',
              updatedByUserId: userId
            }
          });
        }
      }
    }

    // 2. Revert Customer Ledger Totals
    await tx.customer.update({
      where: { id: bill.customerId },
      data: {
        totalPurchaseAmount: { decrement: bill.grandTotal },
        totalPaidAmount: { decrement: bill.paidAmount },
        totalDueAmount: { decrement: bill.dueAmount }
      }
    });

    // 3. Mark Bill Status as CANCELLED (Never delete record!)
    const updatedBill = await tx.bill.update({
      where: { id: billId },
      data: {
        status: 'CANCELLED',
        paidAmount: 0,
        dueAmount: 0
      },
      include: { items: true, customer: true }
    });

    return updatedBill;
  });
};

export const processProductReturn = async (tenantId, userId, billId, returnItems) => {
  // returnItems: Array of { productId, returnQuantity, reason }
  if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
    throw new ApiError(400, 'At least one return item must be provided.');
  }

  const bill = await prisma.bill.findFirst({
    where: { id: billId, tenantId },
    include: { items: true, customer: true }
  });

  if (!bill) throw new ApiError(404, 'Bill not found.');
  if (bill.status === 'CANCELLED') throw new ApiError(400, 'Cannot process return for a cancelled bill.');

  return await prisma.$transaction(async (tx) => {
    let totalReturnAmount = 0;
    let totalItemsReturnedCount = 0;

    for (const ret of returnItems) {
      const billItem = bill.items.find(i => i.productId === ret.productId);
      if (!billItem) throw new ApiError(400, `Product ID '${ret.productId}' was not found on this invoice.`);

      const returnQty = parseInt(ret.returnQuantity);
      const remainingQty = billItem.quantity - billItem.returnedQuantity;

      if (returnQty <= 0 || returnQty > remainingQty) {
        throw new ApiError(400, `Invalid return quantity '${returnQty}'. Remaining returnable quantity is ${remainingQty}.`);
      }

      const itemReturnAmount = (billItem.unitPrice * returnQty);
      totalReturnAmount += itemReturnAmount;
      totalItemsReturnedCount += returnQty;

      // 1. Update BillItem Returned Quantity
      await tx.billItem.update({
        where: { id: billItem.id },
        data: { returnedQuantity: { increment: returnQty } }
      });

      // 2. Add Stock back & Log StockHistory
      const product = await tx.product.findUnique({ where: { id: ret.productId } });
      if (product) {
        const prevStock = product.currentStock;
        const newStock = prevStock + returnQty;

        await tx.product.update({
          where: { id: ret.productId },
          data: { currentStock: newStock }
        });

        await tx.stockHistory.create({
          data: {
            tenantId,
            productId: ret.productId,
            previousStock: prevStock,
            addedRemovedQty: returnQty,
            updatedStock: newStock,
            reason: 'RETURN',
            updatedByUserId: userId
          }
        });
      }

      // 3. Log ProductReturn Record
      await tx.billReturn.create({
        data: {
          billId,
          productId: ret.productId,
          returnQuantity: returnQty,
          returnAmount: itemReturnAmount,
          reason: ret.reason || 'Customer Return',
          processedByUserId: userId
        }
      });
    }

    // Check overall return state for Bill Status update
    const updatedItems = await tx.billItem.findMany({ where: { billId } });
    const allFullyReturned = updatedItems.every(i => i.quantity === i.returnedQuantity);

    const newBillStatus = allFullyReturned ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED';

    // Update Bill grandTotal and Customer Ledger
    const updatedBill = await tx.bill.update({
      where: { id: billId },
      data: {
        status: newBillStatus,
        grandTotal: { decrement: totalReturnAmount }
      },
      include: { items: true, returns: true, customer: true }
    });

    await tx.customer.update({
      where: { id: bill.customerId },
      data: {
        totalPurchaseAmount: { decrement: totalReturnAmount }
      }
    });

    return updatedBill;
  });
};

export const getBills = async (tenantId, filters = {}) => {
  const { status, customerId, startDate, endDate, search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { tenantId };

  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobileNumber: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const totalCount = await prisma.bill.count({ where });

  const bills = await prisma.bill.findMany({
    where,
    skip,
    take,
    include: {
      customer: true,
      items: { include: { product: true } },
      generatedBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return formatPaginatedResult(bills, totalCount, page, limit, { bills });
};

export const getBillDetails = async (tenantId, billId) => {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, tenantId },
    include: {
      tenant: true,
      customer: true,
      items: { include: { product: true } },
      returns: { include: { processedBy: { select: { id: true, name: true } } } },
      generatedBy: { select: { id: true, name: true, role: true } }
    }
  });

  if (!bill) throw new ApiError(404, 'Bill not found.');
  return bill;
};

export const exportBills = async (tenantId, filters = {}) => {
  const { status, customerId, startDate, endDate, search } = filters;
  const where = { tenantId };

  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobileNumber: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const bills = await prisma.bill.findMany({
    where,
    include: {
      customer: true,
      generatedBy: { select: { name: true } },
      items: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return bills.map(b => ({
    invoiceNumber: b.invoiceNumber,
    customerName: b.customer ? b.customer.name : 'N/A',
    customerMobile: b.customer ? b.customer.mobileNumber : 'N/A',
    date: b.createdAt ? b.createdAt.toISOString().split('T')[0] : '',
    subtotal: b.subtotal,
    taxAmount: b.totalTaxAmount,
    discountAmount: b.discountAmount,
    grandTotal: b.grandTotal,
    paidAmount: b.paidAmount,
    dueAmount: b.dueAmount,
    paymentMethod: b.paymentMethod,
    status: b.status,
    itemsCount: b.items.length,
    generatedBy: b.generatedBy ? b.generatedBy.name : 'Staff'
  }));
};

