import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { getPaginationParams, formatPaginatedResult } from '../../utils/pagination.utility.js';

export const findOrCreateCustomerByMobile = async (tenantId, mobileNumber, name, additionalInfo = {}) => {
  if (!mobileNumber) throw new ApiError(400, 'Customer mobile number is required.');

  let customer = await prisma.customer.findFirst({
    where: { tenantId, mobileNumber }
  });

  if (customer) return { customer, isNew: false };

  if (!name) throw new ApiError(400, 'Customer Name is required for new customer registration.');

  customer = await prisma.customer.create({
    data: {
      tenantId,
      mobileNumber,
      name,
      email: additionalInfo.email || null,
      address: additionalInfo.address || null,
      city: additionalInfo.city || null,
      state: additionalInfo.state || null,
      country: additionalInfo.country || 'India',
      pincode: additionalInfo.pincode || null
    }
  });

  return { customer, isNew: true };
};

export const getCustomers = async (tenantId, filters = {}) => {
  const search = typeof filters === 'string' ? filters : filters.search;
  const queryObj = typeof filters === 'string' ? { search: filters } : filters;
  const { page, limit, skip, take } = getPaginationParams(queryObj, 10);

  const where = { tenantId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } }
    ];
  }

  const totalCount = await prisma.customer.count({ where });

  const customers = await prisma.customer.findMany({
    where,
    skip,
    take,
    orderBy: { updatedAt: 'desc' }
  });

  return formatPaginatedResult(customers, totalCount, page, limit, { customers });
};

export const getCustomerDetails = async (tenantId, customerId) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    include: {
      bills: {
        include: {
          items: { include: { product: true } },
          generatedBy: { select: { id: true, name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!customer) throw new ApiError(404, 'Customer not found.');

  // Extract date-wise product purchase history
  const purchasedProducts = [];
  for (const bill of customer.bills) {
    for (const item of bill.items) {
      purchasedProducts.push({
        billId: bill.id,
        invoiceNumber: bill.invoiceNumber,
        purchaseDate: bill.createdAt,
        productName: item.product ? item.product.name : 'Unknown Product',
        sku: item.sku,
        quantity: item.quantity - item.returnedQuantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal
      });
    }
  }

  return {
    customer,
    purchasedProducts
  };
};

export const updateCustomer = async (tenantId, customerId, data) => {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new ApiError(404, 'Customer not found.');

  return await prisma.customer.update({
    where: { id: customerId },
    data
  });
};

export const deleteCustomer = async (tenantId, customerId) => {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new ApiError(404, 'Customer not found.');

  return await prisma.customer.delete({ where: { id: customerId } });
};

export const exportCustomers = async (tenantId, search) => {
  const where = { tenantId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } }
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  return customers.map(c => ({
    name: c.name,
    mobileNumber: c.mobileNumber,
    email: c.email || 'N/A',
    city: c.city || 'N/A',
    state: c.state || 'N/A',
    totalInvoices: c.totalInvoices,
    totalPurchaseAmount: c.totalPurchaseAmount,
    totalPaidAmount: c.totalPaidAmount,
    totalDueAmount: c.totalDueAmount,
    lastPurchaseDate: c.lastPurchaseDate ? c.lastPurchaseDate.toISOString().split('T')[0] : 'N/A'
  }));
};

