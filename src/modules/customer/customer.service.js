import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';
import { normalizeMobileNumber } from '../../utils/mobile.utility.js';
import { sanitizePartyInput, calculatePartyLedgerRunningBalance } from '../../utils/party.utility.js';

export const findOrCreateCustomerByMobile = async (tenantId, mobileNumber, name, additionalInfo = {}, dbClient = prisma) => {
  if (!mobileNumber) throw new ApiError(400, 'Customer mobile number is required.');

  const sanitized = sanitizePartyInput({ name, mobileNumber, ...additionalInfo });
  const cleanMobile = sanitized.mobileNumber;
  const cleanName = sanitized.name;

  // Resolve customerType (B2C or B2B) - Invalid customerType throws 400
  let validCustomerType = 'B2C';
  if (additionalInfo.customerType !== undefined && additionalInfo.customerType !== null) {
    const upperType = String(additionalInfo.customerType).toUpperCase();
    if (!['B2C', 'B2B'].includes(upperType)) {
      throw new ApiError(400, "Invalid customerType. Must be 'B2C' or 'B2B'.");
    }
    validCustomerType = upperType;
  }

  // Use findUnique with compound index tenantId_mobileNumber
  let customer = await dbClient.customer.findUnique({
    where: { tenantId_mobileNumber: { tenantId, mobileNumber: cleanMobile } }
  });

  if (customer) {
    if (customer.status !== 'ACTIVE') {
      const cleanGstin = sanitized.gstin !== undefined ? sanitized.gstin : customer.gstin;
      if (validCustomerType === 'B2B' && (!cleanGstin || !cleanGstin.trim())) {
        throw new ApiError(400, 'GSTIN is required for B2B customers.');
      }

      // Reactivate soft-deleted customer using explicit value semantics
      customer = await dbClient.customer.update({
        where: { id: customer.id },
        data: {
          status: 'ACTIVE',
          name: cleanName !== undefined && cleanName !== null && cleanName !== '' ? cleanName : customer.name,
          email: sanitized.email !== undefined ? sanitized.email : customer.email,
          address: additionalInfo.address !== undefined ? additionalInfo.address : customer.address,
          city: additionalInfo.city !== undefined ? additionalInfo.city : customer.city,
          state: additionalInfo.state !== undefined ? additionalInfo.state : customer.state,
          customerType: validCustomerType,
          businessName: additionalInfo.businessName !== undefined ? additionalInfo.businessName : customer.businessName,
          gstin: cleanGstin !== undefined ? cleanGstin : customer.gstin
        }
      });
      return { customer, isNew: false };
    }
    return { customer, isNew: false };
  }

  // New Customer Registration Checks
  if (!cleanName) throw new ApiError(400, 'Customer Name is required for new customer registration.');

  const cleanGstin = sanitized.gstin || null;
  if (validCustomerType === 'B2B' && (!cleanGstin || !cleanGstin.trim())) {
    throw new ApiError(400, 'GSTIN is required for B2B customers.');
  }

  // B2B Business Rules: derive stateCode from GSTIN if stateCode not explicitly provided
  let derivedStateCode = additionalInfo.stateCode || null;
  if (cleanGstin && cleanGstin.length >= 2) {
    const extractedStateCode = cleanGstin.slice(0, 2);
    if (!derivedStateCode) {
      if (/^[0-9]{2}$/.test(extractedStateCode)) {
        derivedStateCode = extractedStateCode;
      }
    } else if (derivedStateCode !== extractedStateCode) {
      throw new ApiError(400, `GSTIN state code prefix '${extractedStateCode}' does not match stateCode '${derivedStateCode}'.`);
    }
  }

  // Direct numeric usage with type safety for string inputs
  const creditPeriodDays = (additionalInfo.creditPeriodDays !== undefined && additionalInfo.creditPeriodDays !== null && additionalInfo.creditPeriodDays !== '')
    ? (typeof additionalInfo.creditPeriodDays === 'number' ? additionalInfo.creditPeriodDays : (isNaN(Number(additionalInfo.creditPeriodDays)) ? 30 : parseInt(additionalInfo.creditPeriodDays, 10)))
    : 30;
  const creditLimit = (additionalInfo.creditLimit !== undefined && additionalInfo.creditLimit !== null && additionalInfo.creditLimit !== '')
    ? (typeof additionalInfo.creditLimit === 'number' ? additionalInfo.creditLimit : (isNaN(Number(additionalInfo.creditLimit)) ? 0 : parseFloat(additionalInfo.creditLimit)))
    : 0;

  // Handle P2002 race condition on concurrent customer creation
  try {
    customer = await dbClient.customer.create({
      data: {
        tenantId,
        mobileNumber: cleanMobile,
        name: cleanName,
        email: sanitized.email || null,
        address: additionalInfo.address || null,
        city: additionalInfo.city || null,
        state: additionalInfo.state || null,
        country: additionalInfo.country || 'India',
        pincode: additionalInfo.pincode || null,
        customerType: validCustomerType,
        businessName: additionalInfo.businessName || null,
        gstin: cleanGstin,
        contactPerson: additionalInfo.contactPerson || null,
        shippingAddress: additionalInfo.shippingAddress || null,
        panNumber: additionalInfo.panNumber || sanitized.pan || null,
        stateCode: derivedStateCode,
        status: 'ACTIVE',
        creditPeriodDays,
        creditLimit
      }
    });
  } catch (err) {
    if (err.code === 'P2002') {
      customer = await dbClient.customer.findUnique({
        where: { tenantId_mobileNumber: { tenantId, mobileNumber: cleanMobile } }
      });
      if (customer) {
        return { customer, isNew: false };
      }
    }
    throw err;
  }

  return { customer, isNew: true };
};

export const getCustomers = async (tenantId, filters = {}) => {
  const search = typeof filters === 'string' ? filters : filters.search;
  const queryObj = typeof filters === 'string' ? { search: filters } : filters;
  const { page, limit, skip, take } = getPaginationParams(queryObj, 10);

  const where = { tenantId, status: 'ACTIVE' };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } }
    ];
  }

  const totalCount = await prisma.customer.count({ where });

  // Deterministic stable sorting (updatedAt desc + id desc)
  const customers = await prisma.customer.findMany({
    where,
    skip,
    take,
    orderBy: [
      { updatedAt: 'desc' },
      { id: 'desc' }
    ]
  });

  return formatPaginatedResult(customers, totalCount, page, limit, { customers });
};

export const getCustomerDetails = async (tenantId, customerId, queryObj = {}) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, status: 'ACTIVE' }
  });

  if (!customer) throw new ApiError(404, 'Customer not found or inactive.');

  const { page, limit, skip, take } = getPaginationParams(queryObj, 10);

  const billsWhere = { customerId, tenantId };
  const totalBillsCount = await prisma.bill.count({ where: billsWhere });

  const bills = await prisma.bill.findMany({
    where: billsWhere,
    skip,
    take,
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          sku: true,
          unit: true,
          quantity: true,
          baseQuantity: true,
          returnedQuantity: true,
          unitPrice: true,
          lineTotal: true,
          product: { select: { id: true, name: true, sku: true, unit: true } }
        }
      },
      generatedBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });

  const paginatedBills = formatPaginatedResult(bills, totalBillsCount, page, limit, { bills });

  return {
    customer,
    bills: paginatedBills
  };
};

export const getCustomerBills = async (tenantId, customerId, filters = {}) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, status: 'ACTIVE' }
  });

  if (!customer) throw new ApiError(404, 'Customer not found or inactive.');

  const { status, startDate, endDate, search } = filters;
  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = { customerId, tenantId };

  if (status) where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      if (typeof endDate === 'string' && !endDate.includes('T')) {
        end.setUTCHours(23, 59, 59, 999);
      }
      where.createdAt.lte = end;
    }
  }

  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } }
    ];
  }

  const totalCount = await prisma.bill.count({ where });

  const bills = await prisma.bill.findMany({
    where,
    skip,
    take,
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          sku: true,
          unit: true,
          quantity: true,
          returnedQuantity: true,
          unitPrice: true,
          lineTotal: true,
          product: { select: { id: true, name: true, sku: true } }
        }
      },
      generatedBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });

  return formatPaginatedResult(bills, totalCount, page, limit, { bills });
};

export const getCustomerPurchasedProducts = async (tenantId, customerId, filters = {}) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, status: 'ACTIVE' }
  });

  if (!customer) throw new ApiError(404, 'Customer not found or inactive.');

  const { page, limit, skip, take } = getPaginationParams(filters, 10);

  const where = {
    bill: {
      customerId,
      tenantId,
      status: { notIn: ['CANCELLED'] }
    }
  };

  const totalCount = await prisma.billItem.count({ where });

  const items = await prisma.billItem.findMany({
    where,
    skip,
    take,
    include: {
      bill: { select: { id: true, invoiceNumber: true, createdAt: true } },
      product: { select: { id: true, name: true, sku: true, unit: true } }
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });

  const products = items.map(item => ({
    billId: item.bill ? item.bill.id : null,
    invoiceNumber: item.bill ? item.bill.invoiceNumber : 'N/A',
    purchaseDate: item.bill ? item.bill.createdAt : null,
    productId: item.productId,
    productName: item.product ? item.product.name : 'Unknown Product',
    sku: item.sku,
    unit: item.unit,
    quantity: item.quantity - item.returnedQuantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal
  }));

  return formatPaginatedResult(products, totalCount, page, limit, { products });
};

export const updateCustomer = async (tenantId, customerId, data) => {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, status: 'ACTIVE' } });
  if (!customer) throw new ApiError(404, 'Customer not found or inactive.');

  const sanitized = sanitizePartyInput(data);

  let cleanMobile = undefined;
  if (data.mobileNumber !== undefined && data.mobileNumber !== null) {
    cleanMobile = sanitized.mobileNumber;
    if (cleanMobile && cleanMobile !== customer.mobileNumber) {
      const existing = await prisma.customer.findUnique({
        where: { tenantId_mobileNumber: { tenantId, mobileNumber: cleanMobile } }
      });
      if (existing && existing.status === 'ACTIVE') {
        throw new ApiError(400, 'Another active customer with this mobile number already exists.');
      }
    }
  }

  const updatePayload = {};

  if (sanitized.name) updatePayload.name = sanitized.name;

  if (data.customerType !== undefined && data.customerType !== null) {
    const upperType = String(data.customerType).toUpperCase();
    if (!['B2C', 'B2B'].includes(upperType)) {
      throw new ApiError(400, "Invalid customerType. Must be 'B2C' or 'B2B'.");
    }
    updatePayload.customerType = upperType;
  }

  if (data.businessName !== undefined) updatePayload.businessName = data.businessName;

  if (sanitized.gstin !== undefined) {
    updatePayload.gstin = sanitized.gstin;
    if (sanitized.gstin && sanitized.gstin.length >= 2 && data.stateCode === undefined) {
      const stateCodeFromGst = sanitized.gstin.slice(0, 2);
      if (/^[0-9]{2}$/.test(stateCodeFromGst)) {
        updatePayload.stateCode = stateCodeFromGst;
      }
    }
  }

  if (data.contactPerson !== undefined) updatePayload.contactPerson = data.contactPerson;
  if (cleanMobile !== undefined) updatePayload.mobileNumber = cleanMobile;
  if (sanitized.email !== undefined) updatePayload.email = sanitized.email;

  if (data.address !== undefined) updatePayload.address = data.address;

  if (data.shippingAddress !== undefined) updatePayload.shippingAddress = data.shippingAddress;
  if (data.city !== undefined) updatePayload.city = data.city;
  if (data.state !== undefined) updatePayload.state = data.state;
  if (data.country !== undefined) updatePayload.country = data.country;
  if (data.pincode !== undefined) updatePayload.pincode = data.pincode;

  if (data.panNumber !== undefined) updatePayload.panNumber = data.panNumber;

  if (data.stateCode !== undefined) updatePayload.stateCode = data.stateCode;

  if (data.creditPeriodDays !== undefined) {
    if (data.creditPeriodDays === null || data.creditPeriodDays === '') {
      updatePayload.creditPeriodDays = 30;
    } else {
      updatePayload.creditPeriodDays = typeof data.creditPeriodDays === 'number' ? data.creditPeriodDays : (isNaN(Number(data.creditPeriodDays)) ? 30 : parseInt(data.creditPeriodDays, 10));
    }
  }

  if (data.creditLimit !== undefined) {
    if (data.creditLimit === null || data.creditLimit === '') {
      updatePayload.creditLimit = 0;
    } else {
      updatePayload.creditLimit = typeof data.creditLimit === 'number' ? data.creditLimit : (isNaN(Number(data.creditLimit)) ? 0 : parseFloat(data.creditLimit));
    }
  }

  // Merged Final-State B2B Validation
  const finalCustomerType = updatePayload.customerType !== undefined ? updatePayload.customerType : customer.customerType;
  const finalGstin = updatePayload.gstin !== undefined ? updatePayload.gstin : customer.gstin;
  const finalStateCode = updatePayload.stateCode !== undefined ? updatePayload.stateCode : customer.stateCode;

  if (finalCustomerType === 'B2B' && (!finalGstin || !finalGstin.trim())) {
    throw new ApiError(400, 'GSTIN is required for B2B customers.');
  }

  if (finalGstin && finalGstin.length >= 2 && finalStateCode) {
    const gstinPrefix = finalGstin.slice(0, 2);
    if (gstinPrefix !== finalStateCode) {
      throw new ApiError(400, `GSTIN state code prefix '${gstinPrefix}' does not match stateCode '${finalStateCode}'.`);
    }
  }

  return await prisma.customer.update({
    where: { id: customerId },
    data: updatePayload
  });
};

export const deleteCustomer = async (tenantId, customerId) => {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, status: 'ACTIVE' } });
  if (!customer) throw new ApiError(404, 'Customer not found or inactive.');

  // Soft Delete customer so historical invoice records stay preserved for financial auditing
  return await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'SUSPENDED' }
  });
};

export const exportCustomers = async (tenantId, search) => {
  const where = { tenantId, status: 'ACTIVE' };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'desc' }]
  });

  return customers.map(c => ({
    name: c.name,
    businessName: c.businessName || 'N/A',
    mobileNumber: c.mobileNumber,
    customerType: c.customerType || 'B2C',
    email: c.email || 'N/A',
    city: c.city || 'N/A',
    state: c.state || 'N/A',
    gstin: c.gstin || 'N/A',
    panNumber: c.panNumber || 'N/A',
    totalInvoices: c.totalInvoices,
    totalPurchaseAmount: c.totalPurchaseAmount,
    totalPaidAmount: c.totalPaidAmount,
    totalDueAmount: c.totalDueAmount,
    lastPurchaseDate: c.lastPurchaseDate ? c.lastPurchaseDate.toISOString().split('T')[0] : 'N/A'
  }));
};

export const getCustomerLedger = async (tenantId, customerId) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, status: 'ACTIVE' },
    include: {
      bills: {
        where: { status: { notIn: ['CANCELLED'] } },
        include: { returns: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!customer) throw new ApiError(404, 'Customer not found or inactive.');

  const transactions = [];

  for (const bill of customer.bills) {
    const totalReturnAmount = (bill.returns || []).reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
    const originalGrandTotal = Math.round((bill.grandTotal + totalReturnAmount) * 100) / 100;

    transactions.push({
      id: bill.id,
      date: bill.createdAt,
      type: 'SALES_BILL',
      referenceNumber: bill.invoiceNumber,
      credit: originalGrandTotal,
      debit: bill.paidAmount,
      notes: `Sales Invoice #${bill.invoiceNumber} generated`
    });

    for (const ret of (bill.returns || [])) {
      transactions.push({
        id: ret.id,
        date: ret.createdAt,
        type: 'SALES_RETURN',
        referenceNumber: bill.invoiceNumber,
        credit: 0,
        debit: ret.returnAmount,
        notes: `Product Return against Invoice #${bill.invoiceNumber}: ${ret.reason || 'Customer Return'}`
      });
    }
  }

  const ledgerResult = calculatePartyLedgerRunningBalance(transactions);

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      mobileNumber: customer.mobileNumber,
      businessName: customer.businessName,
      gstin: customer.gstin
    },
    statementSummary: {
      totalCredit: ledgerResult.totalCredit,
      totalDebit: ledgerResult.totalDebit,
      closingBalance: ledgerResult.closingBalance
    },
    ledgerEntries: ledgerResult.ledgerEntries
  };
};
