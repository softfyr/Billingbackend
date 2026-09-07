import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export const createTax = async (tenantId, data) => {
  const { name, percentage, type, status } = data;

  return await prisma.tax.create({
    data: {
      tenantId,
      name,
      percentage: parseFloat(percentage),
      type: type || 'PERCENTAGE',
      status: status || 'ACTIVE'
    }
  });
};

export const getTaxes = async (tenantId) => {
  return await prisma.tax.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' }
  });
};

export const getTaxById = async (tenantId, taxId) => {
  const tax = await prisma.tax.findFirst({
    where: { id: taxId, tenantId }
  });
  if (!tax) throw new ApiError(404, 'Tax record not found.');
  return tax;
};

export const updateTax = async (tenantId, taxId, data) => {
  const tax = await prisma.tax.findFirst({ where: { id: taxId, tenantId } });
  if (!tax) throw new ApiError(404, 'Tax record not found.');

  return await prisma.tax.update({
    where: { id: taxId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.percentage !== undefined && { percentage: parseFloat(data.percentage) }),
      ...(data.type && { type: data.type }),
      ...(data.status && { status: data.status })
    }
  });
};

export const deleteTax = async (tenantId, taxId) => {
  const tax = await prisma.tax.findFirst({ where: { id: taxId, tenantId } });
  if (!tax) throw new ApiError(404, 'Tax record not found.');

  return await prisma.tax.delete({ where: { id: taxId } });
};
