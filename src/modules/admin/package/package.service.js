import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';

export const createPackage = async (data) => {
  const { packageName, description, durationMonths, amount, isFreeTrial } = data;

  if (!packageName || !packageName.trim()) {
    throw new ApiError(400, 'Package Name is required.');
  }

  return await prisma.package.create({
    data: {
      packageName: packageName.trim(),
      description: description ? description.trim() : null,
      durationMonths: durationMonths ? parseInt(durationMonths) : 1,
      amount: amount !== undefined ? parseFloat(amount) : 0,
      isFreeTrial: Boolean(isFreeTrial),
      status: 'ACTIVE'
    }
  });
};

export const getPackages = async () => {
  return await prisma.package.findMany({ orderBy: { amount: 'asc' } });
};

export const getPackageById = async (packageId) => {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new ApiError(404, 'Package not found.');
  return pkg;
};

export const updatePackage = async (packageId, data) => {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new ApiError(404, 'Package not found.');

  return await prisma.package.update({
    where: { id: packageId },
    data: {
      ...(data.packageName && { packageName: data.packageName.trim() }),
      ...(data.description !== undefined && { description: data.description ? data.description.trim() : null }),
      ...(data.durationMonths !== undefined && { durationMonths: parseInt(data.durationMonths) }),
      ...(data.amount !== undefined && { amount: parseFloat(data.amount) }),
      ...(data.isFreeTrial !== undefined && { isFreeTrial: Boolean(data.isFreeTrial) }),
      ...(data.status && { status: data.status })
    }
  });
};

export const deletePackage = async (packageId) => {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new ApiError(404, 'Package not found.');

  return await prisma.package.update({
    where: { id: packageId },
    data: { status: 'SUSPENDED' }
  });
};
