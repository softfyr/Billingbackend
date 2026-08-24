import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';

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
      if (!item.productId) {
        throw new ApiError(400, 'Product ID is required for each purchase line item.');
      }

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

      const lineRawTotal = qty * price;
      const lineTaxable = Math.max(0, lineRawTotal - itemDisc);
      const lineTaxAmt = (lineTaxable * itemTaxPct) / 100;
      const lineGrandTotal = lineTaxable + lineTaxAmt;

      subtotal += lineRawTotal;
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

    const grossDiscount = (parseFloat(clientDiscount) || 0) + totalItemDiscountCalculated;
    const grossTax = (parseFloat(cgstAmount) || 0) + (parseFloat(sgstAmount) || 0) + (parseFloat(igstAmount) || 0) || totalTaxCalculated;
    const addCharges = parseFloat(otherCharges) || 0;
    const rOff = parseFloat(roundOff) || 0;

    const rawGrandTotal = subtotal - grossDiscount + grossTax + addCharges + rOff;
    const grandTotal = Math.max(0, Math.round(rawGrandTotal * 100) / 100);

    const actualPaid = parseFloat(paidAmount) || 0;
    const dueAmount = Math.max(0, grandTotal - actualPaid);

    let paymentStatus = 'PAID';
    if (dueAmount > 0 && actualPaid > 0) paymentStatus = 'PARTIALLY_PAID';
    else if (dueAmount > 0 && actualPaid === 0) paymentStatus = 'UNPAID';

    const purchaseCount = await tx.purchaseInvoice.count({ where: { tenantId } });
    const purchaseNumber = `PUR-${String(purchaseCount + 1001)}`;

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
        cgstAmount: parseFloat(cgstAmount) || 0,
        sgstAmount: parseFloat(sgstAmount) || 0,
        igstAmount: parseFloat(igstAmount) || 0,
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

    return purchaseInvoice;
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
    const returnNumber = `RET-${String(returnCount + 1001)}`;

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

    // 3. Update PurchaseInvoice status
    await tx.purchaseInvoice.update({
      where: { id: purchaseInvoiceId },
      data: {
        purchaseStatus: 'PARTIALLY_RETURNED'
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
