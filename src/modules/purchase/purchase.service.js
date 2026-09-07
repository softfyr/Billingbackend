
const enrichInvoiceItemMultiUnit = (item) => {
  const p = item.product || {};
  const purchaseUnit = item.unit || 'Nos';
  const isSec = Boolean(p.hasSecondaryUnit && p.secondaryUnit && purchaseUnit === p.secondaryUnit);
  const factor = isSec ? (Number(p.conversionFactor) || 1) : 1;
  const baseQty = item.quantity * factor;
  const baseUnit = p.unit || 'Pcs';
  const basePrice = factor > 0 ? (item.unitPurchasePrice / factor) : item.unitPurchasePrice;
  const subtotal = item.quantity * item.unitPurchasePrice;

  return {
    ...item,
    purchaseUnit,
    purchasePrice: item.unitPurchasePrice,
    conversionFactor: factor,
    baseQuantity: baseQty,
    baseUnit,
    baseUnitPrice: basePrice,
    subtotal
  };
};

const enrichInvoiceMultiUnit = (invoice) => {
  if (!invoice) return invoice;
  if (Array.isArray(invoice.items)) {
    invoice.items = invoice.items.map(enrichInvoiceItemMultiUnit);
  }
  return invoice;
};

import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';
import { createProduct } from '../product/product.service.js';

const sanitizeEnumMethod = (method) => {
  const valid = ['CASH', 'UPI', 'CARD', 'OTHER'];
  const upper = (method || '').toString().toUpperCase();
  return valid.includes(upper) ? upper : 'OTHER';
};

export const createPurchaseInvoice = async (tenantId, userId, data) => {
  let {
    supplierId,
    supplierInvoiceNumber,
    invoiceDate,
    dueDate,
    paymentTerms,
    purchaseType = 'Local Purchase',
    bankAccount,
    referenceNumber,
    attachments,
    notes,
    items,
    subtotal: clientSubtotal,
    discountAmount: clientDiscount = 0,
    cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0,
    otherCharges = 0,
    roundOff = 0,
    paidAmount = 0,
    paymentMethod = 'CASH',
    purchaseStatus = 'CONFIRMED'
  } = data;

  if (!supplierId) throw new ApiError(400, 'Supplier ID is required for Purchase Bill creation.');
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one purchase item is required.');
  }

  const isConfirmed = purchaseStatus === 'CONFIRMED';
  const enumPaymentMethod = sanitizeEnumMethod(paymentMethod);

  return await prisma.$transaction(async (tx) => {
    // 1. Resolve Supplier
    const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) throw new ApiError(404, 'Supplier not found.');

    let subtotal = 0;
    let totalTaxCalculated = 0;
    let totalItemDiscountCalculated = 0;
    const preparedItems = [];

    // 2. Process Purchase Items
    for (const item of items) {
      let targetProductId = item.productId;
      const npData = item.newProductData || item.productData;

      if (!targetProductId && npData) {
        const createdProd = await createProduct(tenantId, userId, npData);
        targetProductId = createdProd.id;
      }

      if (!targetProductId) {
        throw new ApiError(400, 'Product ID is required for each purchase line item.');
      }

      const product = await tx.product.findFirst({ where: { id: targetProductId, tenantId } });
      if (!product) throw new ApiError(404, `Product not found for ID ${targetProductId}`);

      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.unitPurchasePrice) || 0;
      const itemDiscPct = parseFloat(item.discountPercent) || 0;
      let itemDisc = parseFloat(item.discountAmount) || 0;
      if (itemDiscPct > 0 && !itemDisc) {
        itemDisc = (qty * price * itemDiscPct) / 100;
      }
      const itemTaxPct = parseFloat(item.taxPercent) || 0;

      const purchaseUnit = item.unit || item.purchaseUnit || product.secondaryUnit || product.unit || 'Nos';
      const isSecondaryUnit = Boolean(product.hasSecondaryUnit && product.secondaryUnit && purchaseUnit === product.secondaryUnit);
      const conversionFactor = isSecondaryUnit ? (Number(product.conversionFactor) || 1) : 1;

      const baseQuantity = qty * conversionFactor;
      const baseUnit = product.unit || 'Pcs';
      const baseUnitPrice = conversionFactor > 0 ? (price / conversionFactor) : price;
      const lineSubtotal = qty * price;

      const pTaxType = (product.taxType || '').toUpperCase();
      const iTaxType = (item.taxType || '').toUpperCase();
      const iTaxMode = (item.taxMode || '').toUpperCase();

      let isInclusive = false;
      if (['INCLUSIVE', 'GST_INCLUSIVE'].includes(iTaxType) || ['INCLUSIVE', 'GST_INCLUSIVE'].includes(iTaxMode)) {
        isInclusive = true;
      } else if (['EXCLUSIVE', 'GST_EXCLUSIVE'].includes(iTaxType) || ['EXCLUSIVE', 'GST_EXCLUSIVE'].includes(iTaxMode)) {
        isInclusive = false;
      } else {
        isInclusive = ['INCLUSIVE', 'GST_INCLUSIVE'].includes(pTaxType);
      }

      const lineRawTotal = lineSubtotal;
      const rawLineNet = Math.max(0, lineRawTotal - itemDisc);

      let lineTaxable = rawLineNet;
      let lineTaxAmt = 0;
      let lineGrandTotal = rawLineNet;

      if (isInclusive && itemTaxPct > 0) {
        lineTaxable = Math.round((rawLineNet / (1 + (itemTaxPct / 100))) * 100) / 100;
        lineTaxAmt = Math.round((rawLineNet - lineTaxable) * 100) / 100;
        lineGrandTotal = rawLineNet;
      } else {
        lineTaxable = Math.round(rawLineNet * 100) / 100;
        lineTaxAmt = Math.round(((lineTaxable * itemTaxPct) / 100) * 100) / 100;
        lineGrandTotal = Math.round((lineTaxable + lineTaxAmt) * 100) / 100;
      }

      subtotal += lineTaxable;
      totalItemDiscountCalculated += itemDisc;
      totalTaxCalculated += lineTaxAmt;

      preparedItems.push({
        productId: product.id,
        product,
        sku: product.sku,
        unit: purchaseUnit,
        purchaseUnit,
        quantity: qty,
        unitPurchasePrice: price,
        purchasePrice: price,
        conversionFactor,
        baseQuantity,
        baseUnit,
        baseUnitPrice,
        subtotal: lineSubtotal,
        discountPercent: itemDiscPct,
        discountAmount: itemDisc,
        taxPercent: itemTaxPct,
        taxAmount: lineTaxAmt,
        totalAmount: lineGrandTotal
      });
    }

    const grossDiscount = (parseFloat(clientDiscount) || 0) + totalItemDiscountCalculated;
    const grossTax = Math.round(totalTaxCalculated * 100) / 100;
    const addCharges = parseFloat(otherCharges) || 0;
    const rOff = parseFloat(roundOff) || 0;

    const rawGrandTotal = subtotal - grossDiscount + grossTax + addCharges + rOff;
    const grandTotal = Math.max(0, Math.round(rawGrandTotal * 100) / 100);

    const isIgst = (parseFloat(igstAmount) || 0) > 0;
    const computedCgst = isIgst ? 0 : Math.round((grossTax / 2) * 100) / 100;
    const computedSgst = isIgst ? 0 : Math.round((grossTax / 2) * 100) / 100;
    const computedIgst = isIgst ? grossTax : 0;

    const actualPaid = parseFloat(paidAmount) || 0;
    const dueAmount = Math.max(0, grandTotal - actualPaid);

    let paymentStatus = 'PAID';
    if (dueAmount > 0 && actualPaid > 0) paymentStatus = 'PARTIALLY_PAID';
    else if (dueAmount > 0 && actualPaid === 0) paymentStatus = 'UNPAID';

    const purchaseCount = await tx.purchaseInvoice.count({ where: { tenantId } });
    const purchaseHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    const purchaseNumber = `PUR-${String(purchaseCount + 1001)}-${purchaseHash}`;

    // 3. Save Purchase Invoice
    const purchaseInvoice = await tx.purchaseInvoice.create({
      data: {
        tenantId,
        supplierId,
        purchaseNumber,
        supplierInvoiceNumber: supplierInvoiceNumber || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        paymentTerms: paymentTerms || null,
        purchaseType: purchaseType || 'Local Purchase',
        paymentMethod: enumPaymentMethod,
        bankAccount: bankAccount || null,
        referenceNumber: referenceNumber || null,
        attachments: attachments || null,
        notes: notes || null,
        subtotal,
        taxAmount: grossTax,
        discountAmount: grossDiscount,
        cgstAmount: computedCgst,
        sgstAmount: computedSgst,
        igstAmount: computedIgst,
        otherCharges: addCharges,
        roundOff: rOff,
        totalAmount: grandTotal,
        paidAmount: actualPaid,
        dueAmount,
        paymentStatus,
        purchaseStatus: isConfirmed ? 'CONFIRMED' : 'DRAFT',
        items: {
          create: preparedItems.map(i => ({
            productId: i.productId,
            sku: i.sku,
            unit: i.unit,
            quantity: i.quantity,
            unitPurchasePrice: i.unitPurchasePrice,
            discountPercent: i.discountPercent,
            discountAmount: i.discountAmount,
            taxPercent: i.taxPercent,
            taxAmount: i.taxAmount,
            totalAmount: i.totalAmount
          }))
        }
      },
      include: {
        supplier: true,
        items: { include: { product: true } }
      }
    });

    // 4. Update Stock & Supplier Dues ONLY IF status is CONFIRMED
    if (isConfirmed) {
      for (const item of preparedItems) {
        const isSecondary = item.product.hasSecondaryUnit && item.product.secondaryUnit && item.unit === item.product.secondaryUnit;
        const factor = isSecondary ? (Number(item.product.conversionFactor) || 1) : 1;
        const qtyInPrimary = item.quantity * factor;
        const perPiecePrice = isSecondary ? (item.unitPurchasePrice / factor) : item.unitPurchasePrice;

        const prevStock = item.product.currentStock;
        const newStock = prevStock + qtyInPrimary;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: newStock,
            purchasePrice: perPiecePrice,
            ...(isSecondary ? { secondaryPurchasePrice: item.unitPurchasePrice } : {})
          }
        });

        await tx.stockHistory.create({
          data: {
            tenantId,
            productId: item.productId,
            previousStock: prevStock,
            addedRemovedQty: qtyInPrimary,
            updatedStock: newStock,
            reason: 'NEW_PURCHASE',
            updatedByUserId: userId
          }
        });
      }

      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          totalPurchases: { increment: grandTotal },
          totalPaid: { increment: actualPaid },
          outstandingDue: { increment: dueAmount }
        }
      });

      if (actualPaid > 0) {
        await tx.supplierPayment.create({
          data: {
            tenantId,
            supplierId,
            amount: actualPaid,
            paymentMethod: enumPaymentMethod,
            referenceNumber: referenceNumber || null,
            notes: `Initial payment for Purchase Invoice ${purchaseNumber}`,
            createdById: userId
          }
        });
      }
    }

    return enrichInvoiceMultiUnit(purchaseInvoice);
  });
};

export const getPurchaseInvoices = async (tenantId, filters = {}) => {
  const {
    status,
    purchaseStatus,
    supplierId,
    startDate,
    endDate,
    dueStartDate,
    dueEndDate,
    search
  } = filters;

  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { tenantId };

  if (supplierId) where.supplierId = supplierId;

  const now = new Date();

  if (status && status !== 'ALL') {
    const sUpper = status.toUpperCase();
    if (sUpper === 'OVERDUE') {
      where.dueAmount = { gt: 0 };
      where.dueDate = { lt: now };
    } else if (['PAID', 'PARTIALLY_PAID', 'UNPAID', 'PARTIAL'].includes(sUpper)) {
      const pStatus = sUpper === 'PARTIAL' ? 'PARTIALLY_PAID' : sUpper;
      where.paymentStatus = pStatus;
    }
  }

  if (purchaseStatus && purchaseStatus !== 'ALL') {
    if (['DRAFT', 'CONFIRMED', 'CANCELLED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'].includes(purchaseStatus.toUpperCase())) {
      where.purchaseStatus = purchaseStatus.toUpperCase();
    }
  }

  if (startDate || endDate) {
    where.invoiceDate = {};
    if (startDate) where.invoiceDate.gte = new Date(startDate);
    if (endDate) where.invoiceDate.lte = new Date(endDate);
  }

  if (dueStartDate || dueEndDate) {
    where.dueDate = {};
    if (dueStartDate) where.dueDate.gte = new Date(dueStartDate);
    if (dueEndDate) where.dueDate.lte = new Date(dueEndDate);
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { purchaseNumber: { contains: q, mode: 'insensitive' } },
      { supplierInvoiceNumber: { contains: q, mode: 'insensitive' } },
      { supplier: { name: { contains: q, mode: 'insensitive' } } },
      { supplier: { companyName: { contains: q, mode: 'insensitive' } } }
    ];
  }

  // --- KPI Top Summary Banner Aggregations ---
  const totalBillsCount = await prisma.purchaseInvoice.count({ where: { tenantId } });

  const aggregates = await prisma.purchaseInvoice.aggregate({
    where: { tenantId, purchaseStatus: { notIn: ['CANCELLED'] } },
    _sum: { totalAmount: true, paidAmount: true, dueAmount: true }
  });

  const overdueAgg = await prisma.purchaseInvoice.aggregate({
    where: { tenantId, dueAmount: { gt: 0 }, dueDate: { lt: now }, purchaseStatus: { notIn: ['CANCELLED'] } },
    _sum: { dueAmount: true }
  });

  // --- Status Tab Counts ---
  const paidCount = await prisma.purchaseInvoice.count({ where: { tenantId, paymentStatus: 'PAID' } });
  const partialCount = await prisma.purchaseInvoice.count({ where: { tenantId, paymentStatus: 'PARTIALLY_PAID' } });
  const unpaidCount = await prisma.purchaseInvoice.count({ where: { tenantId, paymentStatus: 'UNPAID' } });
  const overdueCount = await prisma.purchaseInvoice.count({ where: { tenantId, dueAmount: { gt: 0 }, dueDate: { lt: now } } });
  const cancelledCount = await prisma.purchaseInvoice.count({ where: { tenantId, purchaseStatus: 'CANCELLED' } });
  const returnedCount = await prisma.purchaseInvoice.count({ where: { tenantId, purchaseStatus: { in: ['PARTIALLY_RETURNED', 'FULLY_RETURNED'] } } });

  const totalCount = await prisma.purchaseInvoice.count({ where });

  const purchases = await prisma.purchaseInvoice.findMany({
    where,
    skip,
    take,
    include: {
      supplier: { select: { id: true, name: true, companyName: true, mobileNumber: true, city: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const formattedPurchases = purchases.map(p => {
    const isOverdue = p.dueAmount > 0 && p.dueDate && new Date(p.dueDate) < now;

    return {
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplierInvoiceNumber: p.supplierInvoiceNumber || 'N/A',
      supplier: p.supplier,
      invoiceDate: p.invoiceDate,
      dueDate: p.dueDate,
      isOverdue,
      paymentTerms: p.paymentTerms || 'N/A',
      purchaseType: p.purchaseType || 'Local Purchase',
      itemsCount: p._count.items,
      subtotal: p.subtotal,
      discountAmount: p.discountAmount,
      taxAmount: p.taxAmount,
      otherCharges: p.otherCharges,
      roundOff: p.roundOff,
      totalAmount: p.totalAmount,
      paidAmount: p.paidAmount,
      dueAmount: p.dueAmount,
      paymentStatus: p.paymentStatus,
      purchaseStatus: p.purchaseStatus,
      createdAt: p.createdAt
    };
  });

  const extraSummary = {
    summary: {
      totalBills: totalBillsCount,
      totalAmount: aggregates._sum.totalAmount || 0,
      paidAmount: aggregates._sum.paidAmount || 0,
      dueAmount: aggregates._sum.dueAmount || 0,
      overdueAmount: overdueAgg._sum.dueAmount || 0
    },
    statusCounts: {
      all: totalBillsCount,
      paid: paidCount,
      partial: partialCount,
      unpaid: unpaidCount,
      overdue: overdueCount,
      cancelled: cancelledCount,
      returned: returnedCount
    },
    purchases: formattedPurchases
  };

  return formatPaginatedResult(formattedPurchases, totalCount, page, limit, extraSummary);
};

export const getPurchaseInvoiceDetails = async (tenantId, id) => {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, tenantId },
    include: {
      supplier: {
        include: {
          purchaseInvoices: {
            where: { purchaseStatus: { notIn: ['CANCELLED'] } },
            select: { totalAmount: true, paidAmount: true, dueAmount: true }
          }
        }
      },
      items: { include: { product: true } },
      returns: { include: { items: { include: { product: true } } } }
    }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');

  // Supplier Lifetime Stats
  const supplierTotalPurchases = invoice.supplier?.totalPurchases || 0;
  const supplierTotalPaid = invoice.supplier?.totalPaid || 0;
  const supplierPayable = invoice.supplier?.outstandingDue || 0;

  // Payments History against this bill
  const payments = await prisma.supplierPayment.findMany({
    where: { supplierId: invoice.supplierId, tenantId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { paymentDate: 'desc' }
  });

  const now = new Date();
  const isOverdue = invoice.dueAmount > 0 && invoice.dueDate && new Date(invoice.dueDate) < now;

  return {
    purchaseBill: {
      id: invoice.id,
      purchaseNumber: invoice.purchaseNumber,
      supplierInvoiceNumber: invoice.supplierInvoiceNumber || 'N/A',
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      isOverdue,
      paymentTerms: invoice.paymentTerms || 'Net 10 Days',
      purchaseType: invoice.purchaseType || 'Local Purchase',
      purchaseStatus: invoice.purchaseStatus,
      paymentStatus: invoice.paymentStatus,
      notes: invoice.notes,
      bankAccount: invoice.bankAccount || 'N/A',
      referenceNumber: invoice.referenceNumber || 'N/A',
      attachments: invoice.attachments || []
    },
    supplierDetails: {
      id: invoice.supplier?.id,
      name: invoice.supplier?.name,
      companyName: invoice.supplier?.companyName,
      mobileNumber: invoice.supplier?.mobileNumber,
      email: invoice.supplier?.email,
      gstin: invoice.supplier?.gstin,
      pan: invoice.supplier?.pan,
      city: invoice.supplier?.city,
      state: invoice.supplier?.state,
      totalPurchases: supplierTotalPurchases,
      totalPaid: supplierTotalPaid,
      totalPayable: supplierPayable
    },
    paymentSummary: {
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      dueAmount: invoice.dueAmount,
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      paymentDate: invoice.invoiceDate,
      referenceNumber: invoice.referenceNumber || 'N/A',
      bankAccount: invoice.bankAccount || 'N/A'
    },
    billSummary: {
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxableAmount: Math.max(0, invoice.subtotal - invoice.discountAmount),
      cgstAmount: invoice.cgstAmount,
      sgstAmount: invoice.sgstAmount,
      igstAmount: invoice.igstAmount,
      otherCharges: invoice.otherCharges,
      roundOff: invoice.roundOff,
      grandTotal: invoice.totalAmount,
      totalPayable: invoice.totalAmount
    },
    items: invoice.items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.product?.name,
      sku: i.sku || i.product?.sku,
      unit: i.unit || 'Nos',
      quantity: i.quantity,
      unitPurchasePrice: i.unitPurchasePrice,
      discountPercent: i.discountPercent || 0,
      discountAmount: i.discountAmount,
      taxPercent: i.taxPercent,
      taxAmount: i.taxAmount,
      totalAmount: i.totalAmount
    })),
    payments: payments.map(pmt => ({
      id: pmt.id,
      paymentDate: pmt.paymentDate,
      amount: pmt.amount,
      paymentMethod: pmt.paymentMethod,
      referenceNumber: pmt.referenceNumber || 'N/A',
      notes: pmt.notes || '-',
      recordedBy: pmt.createdBy?.name || 'Admin'
    })),
    returns: invoice.returns
  };
};

export const createPurchaseReturn = async (tenantId, userId, data) => {
  const {
    purchaseInvoiceId,
    returnType = 'PURCHASE_RETURN',
    returnReason,
    referenceNotes,
    returnAgainst = 'PARTIAL_ITEMS',
    warehouse = 'Main Warehouse',
    refundType = 'CASH_REFUND',
    refundAmount = 0,
    paymentMethod = 'CASH',
    bankAccount,
    returnItems = []
  } = data;

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseInvoiceId, tenantId },
    include: { items: { include: { product: true } }, supplier: true }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');
  if (invoice.purchaseStatus === 'CANCELLED') {
    throw new ApiError(400, 'Cannot process return for a CANCELLED purchase invoice.');
  }

  const enumPaymentMethod = sanitizeEnumMethod(paymentMethod);

  return await prisma.$transaction(async (tx) => {
    let returnSubtotal = 0;
    let returnTotalTax = 0;
    let returnTotalDiscount = 0;
    const preparedReturnItems = [];

    for (const rItem of returnItems) {
      const origItem = invoice.items.find(i => i.productId === rItem.productId);
      if (!origItem) throw new ApiError(400, `Product ID ${rItem.productId} is not part of this purchase invoice.`);

      const returnQty = parseInt(rItem.returnQuantity) || 1;
      if (returnQty > origItem.quantity) {
        throw new ApiError(400, `Return quantity (${returnQty}) cannot exceed purchased quantity (${origItem.quantity}) for product ${origItem.product.name}.`);
      }

      const unitPrice = parseFloat(rItem.unitPrice) || origItem.unitPurchasePrice;
      const discPct = parseFloat(rItem.discountPercent) || origItem.discountPercent || 0;
      const discAmt = (unitPrice * returnQty * discPct) / 100;
      const taxPct = parseFloat(rItem.taxPercent) || origItem.taxPercent || 0;
      const lineTaxable = (unitPrice * returnQty) - discAmt;
      const lineTaxAmt = (lineTaxable * taxPct) / 100;
      const lineTotal = lineTaxable + lineTaxAmt;

      returnSubtotal += (unitPrice * returnQty);
      returnTotalDiscount += discAmt;
      returnTotalTax += lineTaxAmt;

      preparedReturnItems.push({
        productId: origItem.productId,
        sku: origItem.sku,
        unit: origItem.unit || 'Nos',
        purchasedQty: origItem.quantity,
        returnQty,
        unitPrice,
        discountPercent: discPct,
        discountAmount: discAmt,
        taxPercent: taxPct,
        taxAmount: lineTaxAmt,
        totalAmount: lineTotal
      });

      // 1. Stock Deduction
      const prevStock = origItem.product.currentStock;
      const newStock = Math.max(0, prevStock - returnQty);

      await tx.product.update({
        where: { id: origItem.productId },
        data: { currentStock: newStock }
      });

      await tx.stockHistory.create({
        data: {
          tenantId,
          productId: origItem.productId,
          previousStock: prevStock,
          addedRemovedQty: -returnQty,
          updatedStock: newStock,
          reason: 'RETURN',
          updatedByUserId: userId
        }
      });
    }

    const totalReturnAmount = Math.round((returnSubtotal - returnTotalDiscount + returnTotalTax) * 100) / 100;

    const returnCount = await tx.purchaseReturn.count({ where: { tenantId } });
    const returnHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    const returnNumber = `RET-${String(returnCount + 1001)}-${returnHash}`;

    // 2. Create PurchaseReturn Record
    const pReturn = await tx.purchaseReturn.create({
      data: {
        tenantId,
        returnNumber,
        returnType,
        supplierId: invoice.supplierId,
        purchaseInvoiceId,
        returnReason: returnReason || null,
        referenceNotes: referenceNotes || null,
        returnAgainst,
        warehouse,
        subtotal: returnSubtotal,
        discountAmount: returnTotalDiscount,
        taxableAmount: returnSubtotal - returnTotalDiscount,
        cgstAmount: returnTotalTax / 2,
        sgstAmount: returnTotalTax / 2,
        igstAmount: 0,
        otherCharges: 0,
        roundOff: 0,
        totalReturnAmount,
        refundType,
        refundAmount: parseFloat(refundAmount) || totalReturnAmount,
        paymentMethod: enumPaymentMethod,
        bankAccount: bankAccount || null,
        createdById: userId,
        items: {
          create: preparedReturnItems.map(ri => ({
            productId: ri.productId,
            sku: ri.sku,
            unit: ri.unit,
            purchasedQty: ri.purchasedQty,
            returnQty: ri.returnQty,
            unitPrice: ri.unitPrice,
            discountPercent: ri.discountPercent,
            discountAmount: ri.discountAmount,
            taxPercent: ri.taxPercent,
            taxAmount: ri.taxAmount,
            totalAmount: ri.totalAmount
          }))
        }
      },
      include: {
        items: { include: { product: true } }
      }
    });

    // 3. Update PurchaseInvoice status (Fully vs Partially Returned)
    const allReturned = invoice.items.every(origItem => {
      const retItem = preparedReturnItems.find(ri => ri.productId === origItem.productId);
      return retItem && retItem.returnQty >= origItem.quantity;
    });

    await tx.purchaseInvoice.update({
      where: { id: purchaseInvoiceId },
      data: {
        purchaseStatus: allReturned ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED'
      }
    });

    // 4. Adjust Supplier Outstanding Dues
    const newOutstandingDue = Math.max(0, invoice.supplier.outstandingDue - totalReturnAmount);
    await tx.supplier.update({
      where: { id: invoice.supplierId },
      data: {
        outstandingDue: newOutstandingDue
      }
    });

    return pReturn;
  });
};

export const getPurchaseReturns = async (tenantId, filters = {}) => {
  const { search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { tenantId };
  if (search) {
    where.OR = [
      { returnNumber: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const totalCount = await prisma.purchaseReturn.count({ where });

  const returns = await prisma.purchaseReturn.findMany({
    where,
    skip,
    take,
    include: {
      supplier: { select: { name: true, companyName: true } },
      purchaseInvoice: { select: { purchaseNumber: true } },
      items: { include: { product: { select: { name: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return formatPaginatedResult(returns, totalCount, page, limit, { returns });
};

export const confirmPurchaseInvoice = async (tenantId, userId, purchaseId) => {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, tenantId },
    include: { items: { include: { product: true } }, supplier: true }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');
  if (invoice.purchaseStatus !== 'DRAFT') {
    throw new ApiError(400, `Only DRAFT purchase bills can be confirmed. Current status is '${invoice.purchaseStatus}'.`);
  }

  return await prisma.$transaction(async (tx) => {
    for (const item of invoice.items) {
      const prevStock = item.product.currentStock;
      const newStock = prevStock + item.quantity;

      await tx.product.update({
        where: { id: item.productId },
        data: {
          currentStock: newStock,
          purchasePrice: item.unitPurchasePrice
        }
      });

      await tx.stockHistory.create({
        data: {
          tenantId,
          productId: item.productId,
          previousStock: prevStock,
          addedRemovedQty: item.quantity,
          updatedStock: newStock,
          reason: 'NEW_PURCHASE',
          updatedByUserId: userId
        }
      });
    }

    await tx.supplier.update({
      where: { id: invoice.supplierId },
      data: {
        totalPurchases: { increment: invoice.totalAmount },
        totalPaid: { increment: invoice.paidAmount },
        outstandingDue: { increment: invoice.dueAmount }
      }
    });

    if (invoice.paidAmount > 0) {
      await tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId: invoice.supplierId,
          amount: invoice.paidAmount,
          paymentMethod: sanitizeEnumMethod(invoice.paymentMethod),
          notes: `Initial payment confirmed for Purchase Bill ${invoice.purchaseNumber}`,
          createdById: userId
        }
      });
    }

    return await tx.purchaseInvoice.update({
      where: { id: purchaseId },
      data: { purchaseStatus: 'CONFIRMED' },
      include: {
        supplier: true,
        items: { include: { product: true } }
      }
    });
  });
};

export const recordPurchaseInvoicePayment = async (tenantId, userId, purchaseId, data) => {
  const { amount, paymentMethod = 'CASH', referenceNumber, notes } = data;

  const pmtAmount = parseFloat(amount);
  if (isNaN(pmtAmount) || pmtAmount <= 0) throw new ApiError(400, 'Payment amount must be greater than zero.');

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, tenantId },
    include: { supplier: true }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');
  if (invoice.purchaseStatus === 'DRAFT') {
    throw new ApiError(400, 'Cannot record payment for a DRAFT purchase bill. Please confirm the bill first.');
  }
  if (invoice.purchaseStatus === 'CANCELLED') {
    throw new ApiError(400, 'Cannot record payment for a CANCELLED purchase bill.');
  }
  if (invoice.dueAmount <= 0) throw new ApiError(400, 'This purchase invoice is already fully paid.');

  const newPaidAmount = invoice.paidAmount + pmtAmount;
  const newDueAmount = Math.max(0, invoice.totalAmount - newPaidAmount);

  let newPaymentStatus = 'PAID';
  if (newDueAmount > 0) newPaymentStatus = 'PARTIALLY_PAID';

  const validPmtMethod = sanitizeEnumMethod(paymentMethod);

  return await prisma.$transaction(async (tx) => {
    await tx.supplierPayment.create({
      data: {
        tenantId,
        supplierId: invoice.supplierId,
        amount: pmtAmount,
        paymentMethod: validPmtMethod,
        referenceNumber: referenceNumber || null,
        notes: notes || `Payment against Purchase Invoice ${invoice.purchaseNumber}`,
        createdById: userId
      }
    });

    const updatedInvoice = await tx.purchaseInvoice.update({
      where: { id: purchaseId },
      data: {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        paymentStatus: newPaymentStatus
      },
      include: {
        supplier: true,
        items: { include: { product: true } }
      }
    });

    await tx.supplier.update({
      where: { id: invoice.supplierId },
      data: {
        totalPaid: { increment: pmtAmount },
        outstandingDue: Math.max(0, invoice.supplier.outstandingDue - pmtAmount)
      }
    });

    return updatedInvoice;
  });
};

export const cancelPurchaseInvoice = async (tenantId, userId, purchaseId) => {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, tenantId },
    include: { items: { include: { product: true } }, supplier: true }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');
  if (invoice.purchaseStatus === 'CANCELLED') {
    throw new ApiError(400, 'This purchase invoice is already cancelled.');
  }

  return await prisma.$transaction(async (tx) => {
    if (['CONFIRMED', 'PARTIALLY_RETURNED'].includes(invoice.purchaseStatus)) {
      for (const item of invoice.items) {
        const prevStock = item.product.currentStock;
        const newStock = Math.max(0, prevStock - item.quantity);

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
            reason: 'CANCELLED_BILL',
            updatedByUserId: userId
          }
        });
      }

      const newOutstandingDue = Math.max(0, invoice.supplier.outstandingDue - invoice.dueAmount);
      const newTotalPurchases = Math.max(0, invoice.supplier.totalPurchases - invoice.totalAmount);
      const newTotalPaid = Math.max(0, invoice.supplier.totalPaid - invoice.paidAmount);

      await tx.supplier.update({
        where: { id: invoice.supplierId },
        data: {
          totalPurchases: newTotalPurchases,
          totalPaid: newTotalPaid,
          outstandingDue: newOutstandingDue
        }
      });
    }

    return await tx.purchaseInvoice.update({
      where: { id: purchaseId },
      data: {
        purchaseStatus: 'CANCELLED',
        paymentStatus: 'UNPAID',
        dueAmount: 0
      },
      include: {
        supplier: true,
        items: { include: { product: true } }
      }
    });
  });
};

export const exportPurchaseInvoices = async (tenantId, filters = {}) => {
  const { status, purchaseStatus, supplierId, startDate, endDate, search } = filters;
  const where = { tenantId };

  if (supplierId) where.supplierId = supplierId;

  if (status && status !== 'ALL') {
    if (['PAID', 'PARTIALLY_PAID', 'UNPAID', 'PARTIAL'].includes(status.toUpperCase())) {
      const pStatus = status.toUpperCase() === 'PARTIAL' ? 'PARTIALLY_PAID' : status.toUpperCase();
      where.paymentStatus = pStatus;
    }
  }

  if (purchaseStatus && purchaseStatus !== 'ALL') {
    if (['DRAFT', 'CONFIRMED', 'CANCELLED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'].includes(purchaseStatus.toUpperCase())) {
      where.purchaseStatus = purchaseStatus.toUpperCase();
    }
  }

  if (startDate || endDate) {
    where.invoiceDate = {};
    if (startDate) where.invoiceDate.gte = new Date(startDate);
    if (endDate) where.invoiceDate.lte = new Date(endDate);
  }

  if (search) {
    where.OR = [
      { purchaseNumber: { contains: search, mode: 'insensitive' } },
      { supplierInvoiceNumber: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
      { supplier: { companyName: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const purchases = await prisma.purchaseInvoice.findMany({
    where,
    include: {
      supplier: { select: { name: true, companyName: true, mobileNumber: true, gstin: true } },
      items: { include: { product: { select: { name: true, sku: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return purchases.map(p => ({
    purchaseNumber: p.purchaseNumber,
    supplierInvoiceNumber: p.supplierInvoiceNumber || 'N/A',
    supplierName: p.supplier?.name || 'N/A',
    companyName: p.supplier?.companyName || 'N/A',
    mobileNumber: p.supplier?.mobileNumber || 'N/A',
    gstin: p.supplier?.gstin || 'N/A',
    invoiceDate: p.invoiceDate ? p.invoiceDate.toISOString().split('T')[0] : '',
    dueDate: p.dueDate ? p.dueDate.toISOString().split('T')[0] : '',
    subtotal: p.subtotal,
    taxAmount: p.taxAmount,
    discountAmount: p.discountAmount,
    totalAmount: p.totalAmount,
    paidAmount: p.paidAmount,
    dueAmount: p.dueAmount,
    paymentStatus: p.paymentStatus,
    purchaseStatus: p.purchaseStatus,
    totalItems: p.items.length
  }));
};

export const updatePurchaseInvoice = async (tenantId, userId, purchaseId, data) => {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, tenantId },
    include: { items: { include: { product: true } }, supplier: true }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');
  if (invoice.purchaseStatus === 'CANCELLED') {
    throw new ApiError(400, 'Cannot edit a CANCELLED purchase invoice.');
  }

  const {
    supplierId,
    supplierInvoiceNumber,
    invoiceDate,
    dueDate,
    paymentTerms,
    purchaseType,
    bankAccount,
    referenceNumber,
    attachments,
    notes,
    items,
    discountAmount: clientDiscount = 0,
    cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0,
    otherCharges = 0,
    roundOff = 0,
    paymentMethod,
    purchaseStatus,
    paidAmount
  } = data;

  const reqStatus = (data.purchaseStatus || data.status || data.action || '').toUpperCase();
  const isExplicitDraft = reqStatus === 'DRAFT' || data.saveAsDraft === true || data.isDraft === true;
  const isTargetConfirmed = reqStatus === 'CONFIRMED' || !isExplicitDraft;
  const enumPaymentMethod = sanitizeEnumMethod(paymentMethod || invoice.paymentMethod);

  return await prisma.$transaction(async (tx) => {
    if (invoice.purchaseStatus === 'DRAFT') {
      let updateSupplierId = invoice.supplierId;
      if (supplierId && supplierId !== invoice.supplierId) {
        const supp = await tx.supplier.findFirst({ where: { id: supplierId, tenantId } });
        if (!supp) throw new ApiError(404, 'New supplier not found.');
        updateSupplierId = supplierId;
      }

      let subtotal = invoice.subtotal;
      let grossDiscount = invoice.discountAmount;
      let grossTax = invoice.taxAmount;
      let grandTotal = invoice.totalAmount;
      let dueAmount = invoice.dueAmount;
      const actualPaid = paidAmount !== undefined ? parseFloat(paidAmount) : invoice.paidAmount;

      let preparedItems = [];

      if (items && Array.isArray(items) && items.length > 0) {
        subtotal = 0;
        let totalTaxCalculated = 0;
        let totalItemDiscountCalculated = 0;

        for (const item of items) {
          if (!item.productId) throw new ApiError(400, 'Product ID is required for line items.');
          const product = await tx.product.findFirst({ where: { id: item.productId, tenantId } });
          if (!product) throw new ApiError(404, `Product not found for ID ${item.productId}`);

          const qty = parseInt(item.quantity) || 1;
          const price = parseFloat(item.unitPurchasePrice) || 0;
          const itemDiscPct = parseFloat(item.discountPercent) || 0;
          let itemDisc = parseFloat(item.discountAmount) || 0;
          if (itemDiscPct > 0 && !itemDisc) {
            itemDisc = (qty * price * itemDiscPct) / 100;
          }
          const itemTaxPct = parseFloat(item.taxPercent) || 0;

          const pTaxType = (product.taxType || '').toUpperCase();
          const iTaxType = (item.taxType || '').toUpperCase();
          const isInclusive = ['INCLUSIVE', 'GST_INCLUSIVE'].includes(pTaxType) || ['INCLUSIVE', 'GST_INCLUSIVE'].includes(iTaxType);
          const lineRawTotal = qty * price;
          const rawLineNet = Math.max(0, lineRawTotal - itemDisc);

          let lineTaxable = rawLineNet;
          let lineTaxAmt = 0;
          let lineGrandTotal = rawLineNet;

          if (isInclusive && itemTaxPct > 0) {
            lineTaxable = Math.round((rawLineNet / (1 + (itemTaxPct / 100))) * 100) / 100;
            lineTaxAmt = Math.round((rawLineNet - lineTaxable) * 100) / 100;
            lineGrandTotal = rawLineNet;
          } else {
            lineTaxable = Math.round(rawLineNet * 100) / 100;
            lineTaxAmt = Math.round(((lineTaxable * itemTaxPct) / 100) * 100) / 100;
            lineGrandTotal = Math.round((lineTaxable + lineTaxAmt) * 100) / 100;
          }

          subtotal += lineTaxable;
          totalItemDiscountCalculated += itemDisc;
          totalTaxCalculated += lineTaxAmt;

          preparedItems.push({
            productId: product.id,
            product,
            sku: product.sku,
            unit: item.unit || 'Nos',
            quantity: qty,
            unitPurchasePrice: price,
            discountPercent: itemDiscPct,
            discountAmount: itemDisc,
            taxPercent: itemTaxPct,
            taxAmount: lineTaxAmt,
            totalAmount: lineGrandTotal
          });
        }

        grossDiscount = (parseFloat(clientDiscount) || 0) + totalItemDiscountCalculated;
        grossTax = (parseFloat(cgstAmount) || 0) + (parseFloat(sgstAmount) || 0) + (parseFloat(igstAmount) || 0) || totalTaxCalculated;
        const addCharges = parseFloat(otherCharges) || 0;
        const rOff = parseFloat(roundOff) || 0;

        const rawGrandTotal = subtotal - grossDiscount + grossTax + addCharges + rOff;
        grandTotal = Math.max(0, Math.round(rawGrandTotal * 100) / 100);
        dueAmount = Math.max(0, grandTotal - actualPaid);

        await tx.purchaseItem.deleteMany({ where: { purchaseInvoiceId: purchaseId } });
        await tx.purchaseItem.createMany({
          data: preparedItems.map(i => ({
            purchaseInvoiceId: purchaseId,
            productId: i.productId,
            sku: i.sku,
            unit: i.unit,
            quantity: i.quantity,
            unitPurchasePrice: i.unitPurchasePrice,
            discountPercent: i.discountPercent,
            discountAmount: i.discountAmount,
            taxPercent: i.taxPercent,
            taxAmount: i.taxAmount,
            totalAmount: i.totalAmount
          }))
        });
      }

      let paymentStatus = 'PAID';
      if (dueAmount > 0 && actualPaid > 0) paymentStatus = 'PARTIALLY_PAID';
      else if (dueAmount > 0 && actualPaid === 0) paymentStatus = 'UNPAID';

      const finalStatus = isTargetConfirmed ? 'CONFIRMED' : 'DRAFT';

      // Update Purchase Invoice Details
      const updatedInvoice = await tx.purchaseInvoice.update({
        where: { id: purchaseId },
        data: {
          supplierId: updateSupplierId,
          supplierInvoiceNumber: supplierInvoiceNumber !== undefined ? supplierInvoiceNumber : invoice.supplierInvoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : invoice.invoiceDate,
          dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
          paymentTerms: paymentTerms !== undefined ? paymentTerms : invoice.paymentTerms,
          purchaseType: purchaseType || invoice.purchaseType,
          bankAccount: bankAccount !== undefined ? bankAccount : invoice.bankAccount,
          referenceNumber: referenceNumber !== undefined ? referenceNumber : invoice.referenceNumber,
          attachments: attachments !== undefined ? attachments : invoice.attachments,
          notes: notes !== undefined ? notes : invoice.notes,
          paymentMethod: enumPaymentMethod,
          subtotal,
          taxAmount: grossTax,
          discountAmount: grossDiscount,
          cgstAmount: cgstAmount !== undefined ? parseFloat(cgstAmount) : invoice.cgstAmount,
          sgstAmount: sgstAmount !== undefined ? parseFloat(sgstAmount) : invoice.sgstAmount,
          igstAmount: igstAmount !== undefined ? parseFloat(igstAmount) : invoice.igstAmount,
          otherCharges: otherCharges !== undefined ? parseFloat(otherCharges) : invoice.otherCharges,
          roundOff: roundOff !== undefined ? parseFloat(roundOff) : invoice.roundOff,
          totalAmount: grandTotal,
          paidAmount: actualPaid,
          dueAmount,
          paymentStatus,
          purchaseStatus: finalStatus
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      // If transitioning from DRAFT -> CONFIRMED, update Stock, StockHistory & Supplier Dues
      if (isTargetConfirmed) {
        const itemsToProcess = preparedItems.length > 0 ? preparedItems : invoice.items;
        for (const item of itemsToProcess) {
          const productObj = item.product || await tx.product.findUnique({ where: { id: item.productId } });
          if (productObj) {
            const prevStock = productObj.currentStock;
            const newStock = prevStock + item.quantity;

            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: newStock,
                purchasePrice: item.unitPurchasePrice || item.purchasePrice || productObj.purchasePrice
              }
            });

            await tx.stockHistory.create({
              data: {
                tenantId,
                productId: item.productId,
                previousStock: prevStock,
                addedRemovedQty: item.quantity,
                updatedStock: newStock,
                reason: 'NEW_PURCHASE',
                updatedByUserId: userId
              }
            });
          }
        }

        await tx.supplier.update({
          where: { id: updateSupplierId },
          data: {
            totalPurchases: { increment: grandTotal },
            totalPaid: { increment: actualPaid },
            outstandingDue: { increment: dueAmount }
          }
        });
      }

      return updatedInvoice;
    } else {
      return await tx.purchaseInvoice.update({
        where: { id: purchaseId },
        data: {
          supplierInvoiceNumber: supplierInvoiceNumber !== undefined ? supplierInvoiceNumber : invoice.supplierInvoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : invoice.invoiceDate,
          dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
          paymentTerms: paymentTerms !== undefined ? paymentTerms : invoice.paymentTerms,
          purchaseType: purchaseType || invoice.purchaseType,
          bankAccount: bankAccount !== undefined ? bankAccount : invoice.bankAccount,
          referenceNumber: referenceNumber !== undefined ? referenceNumber : invoice.referenceNumber,
          attachments: attachments !== undefined ? attachments : invoice.attachments,
          notes: notes !== undefined ? notes : invoice.notes
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });
    }
  });
};

export const deletePurchaseInvoice = async (tenantId, userId, purchaseId) => {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id: purchaseId, tenantId },
    include: { items: { include: { product: true } }, supplier: true }
  });

  if (!invoice) throw new ApiError(404, 'Purchase Invoice not found.');

  return await prisma.$transaction(async (tx) => {
    if (['CONFIRMED', 'PARTIALLY_RETURNED'].includes(invoice.purchaseStatus)) {
      for (const item of invoice.items) {
        const prevStock = item.product.currentStock;
        const newStock = Math.max(0, prevStock - item.quantity);

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
            reason: 'CANCELLED_BILL',
            updatedByUserId: userId
          }
        });
      }

      const newOutstandingDue = Math.max(0, invoice.supplier.outstandingDue - invoice.dueAmount);
      const newTotalPurchases = Math.max(0, invoice.supplier.totalPurchases - invoice.totalAmount);
      const newTotalPaid = Math.max(0, invoice.supplier.totalPaid - invoice.paidAmount);

      await tx.supplier.update({
        where: { id: invoice.supplierId },
        data: {
          totalPurchases: newTotalPurchases,
          totalPaid: newTotalPaid,
          outstandingDue: newOutstandingDue
        }
      });
    }

    await tx.purchaseReturnItem.deleteMany({
      where: { purchaseReturn: { purchaseInvoiceId: purchaseId } }
    });
    await tx.purchaseReturn.deleteMany({
      where: { purchaseInvoiceId: purchaseId }
    });
    await tx.purchaseItem.deleteMany({
      where: { purchaseInvoiceId: purchaseId }
    });

    await tx.purchaseInvoice.delete({
      where: { id: purchaseId }
    });

    return { id: purchaseId, purchaseNumber: invoice.purchaseNumber };
  });
};

export const getPurchaseReturnDetails = async (tenantId, returnId) => {
  const pReturn = await prisma.purchaseReturn.findFirst({
    where: { id: returnId, tenantId },
    include: {
      supplier: { select: { id: true, name: true, companyName: true, mobileNumber: true, email: true, gstin: true } },
      purchaseInvoice: { select: { id: true, purchaseNumber: true, supplierInvoiceNumber: true, invoiceDate: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, categoryId: true } } } }
    }
  });

  if (!pReturn) throw new ApiError(404, 'Purchase Return record not found.');
  return pReturn;
};

export const exportPurchaseReturns = async (tenantId, filters = {}) => {
  const { search, startDate, endDate } = filters;
  const where = { tenantId };

  if (startDate || endDate) {
    where.returnDate = {};
    if (startDate) where.returnDate.gte = new Date(startDate);
    if (endDate) where.returnDate.lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { returnNumber: { contains: q, mode: 'insensitive' } },
      { supplier: { name: { contains: q, mode: 'insensitive' } } },
      { purchaseInvoice: { purchaseNumber: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const returns = await prisma.purchaseReturn.findMany({
    where,
    include: {
      supplier: { select: { name: true, companyName: true } },
      purchaseInvoice: { select: { purchaseNumber: true } },
      createdBy: { select: { name: true } },
      items: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return returns.map(r => ({
    returnNumber: r.returnNumber,
    purchaseNumber: r.purchaseInvoice?.purchaseNumber || 'N/A',
    supplierName: r.supplier?.name || 'N/A',
    companyName: r.supplier?.companyName || 'N/A',
    returnDate: r.returnDate ? r.returnDate.toISOString().split('T')[0] : '',
    returnReason: r.returnReason || 'N/A',
    refundType: r.refundType || 'CASH_REFUND',
    totalReturnAmount: r.totalReturnAmount,
    refundAmount: r.refundAmount,
    createdBy: r.createdBy?.name || 'Admin',
    totalItemsReturned: r.items.reduce((acc, curr) => acc + curr.returnQty, 0)
  }));
};

export const deletePurchasePayment = async (tenantId, userId, paymentId) => {
  const payment = await prisma.supplierPayment.findFirst({
    where: { id: paymentId, tenantId },
    include: { supplier: true }
  });

  if (!payment) throw new ApiError(404, 'Supplier payment record not found.');

  return await prisma.$transaction(async (tx) => {
    await tx.supplierPayment.delete({
      where: { id: paymentId }
    });

    const newTotalPaid = Math.max(0, payment.supplier.totalPaid - payment.amount);
    const newOutstandingDue = payment.supplier.outstandingDue + payment.amount;

    await tx.supplier.update({
      where: { id: payment.supplierId },
      data: {
        totalPaid: newTotalPaid,
        outstandingDue: newOutstandingDue
      }
    });

    return { id: paymentId, amount: payment.amount, supplierId: payment.supplierId };
  });
};

