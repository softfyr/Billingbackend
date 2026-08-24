import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export const createSupplier = async (tenantId, data) => {
  const {
    name,
    companyName,
    mobileNumber,
    email,
    pan,
    gstin,
    address,
    city,
    state,
    pincode,
    supplierType,
    creditLimit,
    paymentTerms
  } = data;

  if (!name || !name.trim() || !mobileNumber) {
    throw new ApiError(400, 'Supplier Name and Mobile Number are required.');
  }

  const cleanMobile = mobileNumber.toString().trim().replace(/\D/g, '').slice(-10);

  const createData = {
    tenantId,
    name: name.trim(),
    companyName: companyName ? companyName.trim() : null,
    mobileNumber: cleanMobile,
    email: email ? email.trim() : null,
    gstin: gstin ? gstin.trim().toUpperCase() : null,
    pan: pan ? pan.trim().toUpperCase() : null,
    address: address ? address.trim() : null,
    city: city ? city.trim() : null,
    state: state ? state.trim() : null,
    pincode: pincode ? pincode.trim() : null,
    supplierType: supplierType ? supplierType.trim() : 'Local',
    creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) || 0 : 0,
    paymentTerms: paymentTerms ? paymentTerms.trim() : '30 Days'
  };

  return await prisma.supplier.create({ data: createData });
};

import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';

export const getSuppliers = async (tenantId, filters = {}) => {
  const {
    search,
    status,
    city,
    paymentStatus
  } = filters;

  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { tenantId };

  if (status && status !== 'ALL') {
    where.status = status.toUpperCase() === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  }

  if (city && city !== 'ALL' && city.trim()) {
    where.city = { equals: city.trim(), mode: 'insensitive' };
  }

  if (paymentStatus && paymentStatus !== 'ALL') {
    if (paymentStatus === 'HAS_DUE' || paymentStatus === 'UNPAID') {
      where.outstandingDue = { gt: 0 };
    } else if (paymentStatus === 'FULLY_PAID' || paymentStatus === 'PAID') {
      where.outstandingDue = { equals: 0 };
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { mobileNumber: { contains: q, mode: 'insensitive' } },
      { gstin: { contains: q, mode: 'insensitive' } }
    ];
  }

  // --- Top Banner KPI Aggregation ---
  const totalSuppliersCount = await prisma.supplier.count({ where: { tenantId, status: 'ACTIVE' } });
  
  // Outstanding Due sum overall
  const overallDueAgg = await prisma.supplier.aggregate({
    where: { tenantId },
    _sum: { outstandingDue: true }
  });
  const totalPayableOverall = overallDueAgg._sum.outstandingDue || 0;

  // Monthly Purchases & Paid sum
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyPurchasesAgg = await prisma.purchaseInvoice.aggregate({
    where: { tenantId, invoiceDate: { gte: startOfMonth }, purchaseStatus: { notIn: ['CANCELLED'] } },
    _sum: { totalAmount: true, paidAmount: true }
  });
  const totalPurchasesThisMonth = monthlyPurchasesAgg._sum.totalAmount || 0;
  const totalPaidThisMonth = monthlyPurchasesAgg._sum.paidAmount || 0;

  // Total items query & suppliers list
  const totalCount = await prisma.supplier.count({ where });

  const suppliers = await prisma.supplier.findMany({
    where,
    skip,
    take,
    include: {
      purchaseInvoices: {
        where: { purchaseStatus: { notIn: ['CANCELLED'] } },
        select: { invoiceDate: true, paidAmount: true, totalAmount: true },
        orderBy: { invoiceDate: 'desc' },
        take: 1
      },
      _count: { select: { purchaseInvoices: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const formattedSuppliers = suppliers.map(supplier => {
    const lastPurchaseDate = supplier.purchaseInvoices[0]?.invoiceDate || null;
    const totalPaid = supplier.totalPaid !== undefined ? supplier.totalPaid : 0;
    const totalPayable = Math.max(0, supplier.outstandingDue);

    return {
      id: supplier.id,
      name: supplier.name,
      companyName: supplier.companyName,
      mobileNumber: supplier.mobileNumber,
      email: supplier.email,
      gstin: supplier.gstin,
      pan: supplier.pan,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      pincode: supplier.pincode,
      supplierType: supplier.supplierType || 'Local',
      creditLimit: supplier.creditLimit || 0,
      paymentTerms: supplier.paymentTerms || '30 Days',
      totalPurchases: supplier.totalPurchases,
      totalPaid,
      totalPayable,
      outstandingDue: totalPayable,
      lastPurchaseDate,
      status: supplier.status === 'SUSPENDED' ? 'Inactive' : 'Active',
      purchaseCount: supplier._count.purchaseInvoices,
      createdAt: supplier.createdAt
    };
  });

  const extraSummary = {
    summary: {
      totalSuppliers: totalSuppliersCount,
      totalPurchasesThisMonth,
      totalPaidThisMonth,
      totalPayableOverall
    },
    suppliers: formattedSuppliers
  };

  return formatPaginatedResult(formattedSuppliers, totalCount, page, limit, extraSummary);
};

export const getSupplierDetails = async (tenantId, supplierId) => {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    include: {
      purchaseInvoices: {
        where: { purchaseStatus: { notIn: ['CANCELLED'] } },
        include: { items: { include: { product: true } } },
        orderBy: { invoiceDate: 'desc' }
      },
      supplierPayments: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' }
      }
    }
  });

  if (!supplier) throw new ApiError(404, 'Supplier not found.');

  const totalPurchases = supplier.totalPurchases || 0;
  const totalPaid = supplier.totalPaid || 0;
  const totalOutstanding = Math.max(0, supplier.outstandingDue);
  const lastPurchaseDate = supplier.purchaseInvoices[0]?.invoiceDate || null;

  // Purchase Summary Calculations
  const totalBillsCount = supplier.purchaseInvoices.length;
  let totalItemsCount = 0;
  for (const inv of supplier.purchaseInvoices) {
    for (const item of inv.items) {
      totalItemsCount += item.quantity;
    }
  }
  const avgBillValue = totalBillsCount > 0 ? Math.round((totalPurchases / totalBillsCount) * 100) / 100 : 0;

  // Payment Summary Calculations
  const totalPaymentsCount = supplier.supplierPayments.length;
  const lastPaymentDate = supplier.supplierPayments[0]?.paymentDate || null;

  return {
    supplierInformation: {
      id: supplier.id,
      name: supplier.name,
      companyName: supplier.companyName,
      mobileNumber: supplier.mobileNumber,
      email: supplier.email,
      gstin: supplier.gstin,
      pan: supplier.pan,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      pincode: supplier.pincode,
      supplierType: supplier.supplierType || 'Local',
      creditLimit: supplier.creditLimit || 0,
      paymentTerms: supplier.paymentTerms || '30 Days',
      status: supplier.status === 'SUSPENDED' ? 'Inactive' : 'Active',
      createdAt: supplier.createdAt
    },
    lifetimeStats: {
      totalPurchases,
      totalPaid,
      totalPayable: totalOutstanding,
      outstandingDue: totalOutstanding,
      lastPurchaseDate
    },
    purchaseSummary: {
      totalBills: totalBillsCount,
      totalItems: totalItemsCount,
      avgBillValue,
      lastPurchaseDate
    },
    paymentSummary: {
      totalPaid,
      totalPayments: totalPaymentsCount,
      lastPaymentDate,
      currentBalance: totalOutstanding
    },
    purchaseHistory: supplier.purchaseInvoices.map(inv => ({
      id: inv.id,
      purchaseNumber: inv.purchaseNumber,
      supplierInvoiceNumber: inv.supplierInvoiceNumber,
      invoiceDate: inv.invoiceDate,
      itemsCount: inv.items.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      dueAmount: inv.dueAmount,
      paymentStatus: inv.paymentStatus,
      purchaseStatus: inv.purchaseStatus
    })),
    paymentHistory: supplier.supplierPayments.map(pmt => ({
      id: pmt.id,
      paymentDate: pmt.paymentDate,
      amount: pmt.amount,
      paymentMethod: pmt.paymentMethod,
      referenceNumber: pmt.referenceNumber || 'N/A',
      notes: pmt.notes || '-',
      recordedBy: pmt.createdBy?.name || 'Admin'
    }))
  };
};

export const getSupplierLedger = async (tenantId, supplierId) => {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    include: {
      purchaseInvoices: {
        where: { purchaseStatus: { notIn: ['CANCELLED'] } },
        orderBy: { invoiceDate: 'asc' }
      },
      supplierPayments: {
        orderBy: { paymentDate: 'asc' }
      }
    }
  });

  if (!supplier) throw new ApiError(404, 'Supplier not found.');

  const transactions = [];

  for (const inv of supplier.purchaseInvoices) {
    transactions.push({
      id: inv.id,
      date: inv.invoiceDate,
      type: 'PURCHASE_INVOICE',
      referenceNumber: inv.purchaseNumber,
      credit: inv.totalAmount,
      debit: 0,
      notes: `Purchase Invoice #${inv.purchaseNumber} generated`
    });
  }

  for (const pmt of supplier.supplierPayments) {
    transactions.push({
      id: pmt.id,
      date: pmt.paymentDate,
      type: 'SUPPLIER_PAYMENT',
      referenceNumber: pmt.referenceNumber || 'PAYMENT',
      credit: 0,
      debit: pmt.amount,
      notes: pmt.notes || `Payment made via ${pmt.paymentMethod}`
    });
  }

  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = 0;
  const ledgerEntries = transactions.map(entry => {
    runningBalance += (entry.credit - entry.debit);
    return {
      ...entry,
      runningBalance: Math.max(0, runningBalance)
    };
  });

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      companyName: supplier.companyName,
      gstin: supplier.gstin,
      mobileNumber: supplier.mobileNumber
    },
    statementSummary: {
      totalCredit: ledgerEntries.reduce((acc, curr) => acc + curr.credit, 0),
      totalDebit: ledgerEntries.reduce((acc, curr) => acc + curr.debit, 0),
      closingBalance: Math.max(0, runningBalance)
    },
    ledgerEntries
  };
};

export const recordSupplierPayment = async (tenantId, userId, supplierId, data) => {
  const { amount, paymentMethod = 'CASH', referenceNumber, notes } = data;

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new ApiError(400, 'Payment amount must be a positive number.');
  }

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new ApiError(404, 'Supplier not found.');

  const validPmtMethod = ['CASH', 'UPI', 'CARD', 'OTHER'].includes((paymentMethod || '').toUpperCase())
    ? paymentMethod.toUpperCase()
    : 'OTHER';

  return await prisma.$transaction(async (tx) => {
    // 1. Create SupplierPayment record
    const pmt = await tx.supplierPayment.create({
      data: {
        tenantId,
        supplierId,
        amount: paymentAmount,
        paymentMethod: validPmtMethod,
        referenceNumber: referenceNumber || null,
        notes: notes || 'Direct payment against supplier account dues',
        createdById: userId
      }
    });

    // 2. Update Supplier totalPaid and outstandingDue
    const newOutstandingDue = Math.max(0, supplier.outstandingDue - paymentAmount);
    const updatedSupplier = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        totalPaid: { increment: paymentAmount },
        outstandingDue: newOutstandingDue
      }
    });

    return {
      payment: pmt,
      supplier: updatedSupplier
    };
  });
};

export const updateSupplier = async (tenantId, supplierId, data) => {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new ApiError(404, 'Supplier not found.');

  const updateData = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.companyName !== undefined) updateData.companyName = data.companyName ? data.companyName.trim() : null;
  if (data.mobileNumber) updateData.mobileNumber = data.mobileNumber.toString().trim().replace(/\D/g, '').slice(-10);
  if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
  if (data.gstin !== undefined) updateData.gstin = data.gstin ? data.gstin.trim().toUpperCase() : null;
  if (data.pan !== undefined) updateData.pan = data.pan ? data.pan.trim().toUpperCase() : null;
  if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
  if (data.city !== undefined) updateData.city = data.city ? data.city.trim() : null;
  if (data.state !== undefined) updateData.state = data.state ? data.state.trim() : null;
  if (data.pincode !== undefined) updateData.pincode = data.pincode ? data.pincode.trim() : null;
  if (data.supplierType !== undefined) updateData.supplierType = data.supplierType;
  if (data.creditLimit !== undefined) updateData.creditLimit = parseFloat(data.creditLimit) || 0;
  if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
  if (data.status) updateData.status = data.status === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE';

  return await prisma.supplier.update({
    where: { id: supplierId },
    data: updateData
  });
};

export const deleteSupplier = async (tenantId, supplierId) => {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new ApiError(404, 'Supplier not found.');

  return await prisma.supplier.delete({ where: { id: supplierId } });
};

export const importSuppliers = async (tenantId, suppliersArray = []) => {
  if (!Array.isArray(suppliersArray) || suppliersArray.length === 0) {
    throw new ApiError(400, 'Suppliers list array is required.');
  }

  const createdSuppliers = [];

  for (const s of suppliersArray) {
    if (s.name && s.mobileNumber) {
      const cleanMobile = s.mobileNumber.toString().trim().replace(/\D/g, '').slice(-10);
      const supplier = await prisma.supplier.create({
        data: {
          tenantId,
          name: s.name.trim(),
          companyName: s.companyName ? s.companyName.trim() : null,
          mobileNumber: cleanMobile,
          email: s.email ? s.email.trim() : null,
          gstin: s.gstin ? s.gstin.trim().toUpperCase() : null,
          pan: s.pan ? s.pan.trim().toUpperCase() : null,
          address: s.address ? s.address.trim() : null,
          city: s.city ? s.city.trim() : null,
          state: s.state ? s.state.trim() : null,
          pincode: s.pincode ? s.pincode.trim() : null,
          supplierType: s.supplierType || 'Local',
          creditLimit: s.creditLimit ? parseFloat(s.creditLimit) || 0 : 0,
          paymentTerms: s.paymentTerms || '30 Days'
        }
      });
      createdSuppliers.push(supplier);
    }
  }

  return {
    importedCount: createdSuppliers.length,
    suppliers: createdSuppliers
  };
};

export const exportSuppliers = async (tenantId, filters = {}) => {
  const { search, status, city, paymentStatus } = filters;
  const where = { tenantId };

  if (status && status !== 'ALL') {
    where.status = status.toUpperCase() === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  }

  if (city && city !== 'ALL' && city.trim()) {
    where.city = { equals: city.trim(), mode: 'insensitive' };
  }

  if (paymentStatus && paymentStatus !== 'ALL') {
    if (paymentStatus === 'HAS_DUE' || paymentStatus === 'UNPAID') {
      where.outstandingDue = { gt: 0 };
    } else if (paymentStatus === 'FULLY_PAID' || paymentStatus === 'PAID') {
      where.outstandingDue = { equals: 0 };
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { mobileNumber: { contains: q, mode: 'insensitive' } },
      { gstin: { contains: q, mode: 'insensitive' } }
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  return suppliers.map(s => ({
    name: s.name,
    companyName: s.companyName || 'N/A',
    mobileNumber: s.mobileNumber,
    email: s.email || 'N/A',
    gstin: s.gstin || 'N/A',
    pan: s.pan || 'N/A',
    city: s.city || 'N/A',
    state: s.state || 'N/A',
    supplierType: s.supplierType || 'Local',
    creditLimit: s.creditLimit || 0,
    paymentTerms: s.paymentTerms || '30 Days',
    totalPurchases: s.totalPurchases,
    totalPaid: s.totalPaid,
    totalPayable: s.outstandingDue,
    status: s.status === 'SUSPENDED' ? 'Inactive' : 'Active',
    joiningDate: s.createdAt ? s.createdAt.toISOString().split('T')[0] : ''
  }));
};
