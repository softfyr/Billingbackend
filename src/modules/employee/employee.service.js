import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export const createEmployee = async (tenantId, data) => {
  const { name, mobileNumber, password, fatherName, address, city, state, pincode, monthlySalary, salaryDate } = data;

  if (!name || !name.trim() || !mobileNumber || !password) {
    throw new ApiError(400, 'Employee Name, Mobile Number, and Password are required.');
  }

  const cleanMobile = mobileNumber.toString().trim().replace(/\D/g, '').slice(-10);

  const existingUser = await prisma.user.findUnique({ where: { mobileNumber: cleanMobile } });
  if (existingUser) {
    throw new ApiError(400, 'A user with this mobile number already exists in the system.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: name.trim(),
        mobileNumber: cleanMobile,
        passwordHash: hashedPassword,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        tenantId
      }
    });

    const profile = await tx.employeeProfile.create({
      data: {
        tenantId,
        userId: user.id,
        fatherName: fatherName ? fatherName.trim() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        monthlySalary: monthlySalary ? parseFloat(monthlySalary) : null,
        salaryDate: salaryDate ? parseInt(salaryDate) : null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            role: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    return profile;
  });
};

export const getEmployees = async (tenantId, search) => {
  const where = { tenantId };

  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } }
      ]
    };
  }

  return await prisma.employeeProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          mobileNumber: true,
          role: true,
          status: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const getEmployeeDetails = async (tenantId, employeeId) => {
  const employee = await prisma.employeeProfile.findFirst({
    where: { OR: [{ id: employeeId }, { userId: employeeId }], tenantId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          mobileNumber: true,
          status: true,
          createdAt: true,
          generatedBills: {
            include: { customer: { select: { name: true, mobileNumber: true } } },
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    }
  });

  if (!employee) throw new ApiError(404, 'Employee record not found.');

  // Calculate Employee Billing Activity Aggregations
  const totalBillsGenerated = employee.user.generatedBills.length;
  const totalSalesGenerated = employee.user.generatedBills.reduce((acc, bill) => acc + bill.grandTotal, 0);

  return {
    employee,
    metrics: {
      totalBillsGenerated,
      totalSalesGenerated
    }
  };
};

export const updateEmployee = async (tenantId, employeeId, data) => {
  const { name, fatherName, address, city, state, pincode, monthlySalary, salaryDate, status } = data;

  const employee = await prisma.employeeProfile.findFirst({
    where: { OR: [{ id: employeeId }, { userId: employeeId }], tenantId },
    include: { user: true }
  });

  if (!employee) throw new ApiError(404, 'Employee record not found.');

  return await prisma.$transaction(async (tx) => {
    // Update User Name and Status if passed
    if (name || status) {
      await tx.user.update({
        where: { id: employee.userId },
        data: {
          ...(name && { name: name.trim() }),
          ...(status && { status })
        }
      });
    }

    // Update Employee Profile details
    const updatedProfile = await tx.employeeProfile.update({
      where: { id: employee.id },
      data: {
        ...(fatherName !== undefined && { fatherName: fatherName ? fatherName.trim() : null }),
        ...(address !== undefined && { address: address ? address.trim() : null }),
        ...(city !== undefined && { city: city ? city.trim() : null }),
        ...(state !== undefined && { state: state ? state.trim() : null }),
        ...(pincode !== undefined && { pincode: pincode ? pincode.trim() : null }),
        ...(monthlySalary !== undefined && { monthlySalary: parseFloat(monthlySalary) }),
        ...(salaryDate !== undefined && { salaryDate: parseInt(salaryDate) })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            role: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    return updatedProfile;
  });
};

export const updateEmployeeStatus = async (tenantId, employeeId, status) => {
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    throw new ApiError(400, 'Invalid status. Must be ACTIVE or SUSPENDED.');
  }

  const employee = await prisma.employeeProfile.findFirst({
    where: { OR: [{ id: employeeId }, { userId: employeeId }], tenantId }
  });

  if (!employee) throw new ApiError(404, 'Employee record not found.');

  await prisma.user.update({
    where: { id: employee.userId },
    data: { status }
  });

  return { employeeId, status };
};

export const deleteEmployee = async (tenantId, employeeId) => {
  const employee = await prisma.employeeProfile.findFirst({
    where: { OR: [{ id: employeeId }, { userId: employeeId }], tenantId }
  });

  if (!employee) throw new ApiError(404, 'Employee record not found.');

  return await prisma.$transaction(async (tx) => {
    await tx.employeeProfile.delete({ where: { id: employee.id } });
    await tx.user.delete({ where: { id: employee.userId } });
  });
};

