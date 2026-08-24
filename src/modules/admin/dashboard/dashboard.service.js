import { prisma } from '../../../config/prisma.js';

export const getAdminDashboardData = async () => {
  // 1. Tenant Overview Breakdown
  const totalTenants = await prisma.tenant.count();
  const freeTrial = await prisma.tenant.count({ where: { subscriptionStatus: 'FREE_TRIAL' } });
  const freeTrialEnded = await prisma.tenant.count({ where: { subscriptionStatus: 'FREE_TRIAL_ENDED' } });
  const upgraded = await prisma.tenant.count({ where: { subscriptionStatus: 'UPGRADED' } });
  const planExpired = await prisma.tenant.count({ where: { subscriptionStatus: 'EXPIRED' } });

  // Date Boundaries
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // 2. Tenant Registration Overview
  const registrationsOverview = {
    total: totalTenants,
    today: await prisma.tenant.count({ where: { createdAt: { gte: startOfToday } } }),
    thisWeek: await prisma.tenant.count({ where: { createdAt: { gte: startOfWeek } } }),
    thisMonth: await prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } })
  };

  // 3. Revenue Overview
  const totalRevAgg = await prisma.subscriptionHistory.aggregate({
    where: { paymentStatus: 'SUCCESS' },
    _sum: { amount: true }
  });
  const todayRevAgg = await prisma.subscriptionHistory.aggregate({
    where: { paymentStatus: 'SUCCESS', createdAt: { gte: startOfToday } },
    _sum: { amount: true }
  });
  const monthlyRevAgg = await prisma.subscriptionHistory.aggregate({
    where: { paymentStatus: 'SUCCESS', createdAt: { gte: startOfMonth } },
    _sum: { amount: true }
  });
  const yearlyRevAgg = await prisma.subscriptionHistory.aggregate({
    where: { paymentStatus: 'SUCCESS', createdAt: { gte: startOfYear } },
    _sum: { amount: true }
  });

  const revenueOverview = {
    totalRevenue: totalRevAgg._sum.amount || 0,
    todayRevenue: todayRevAgg._sum.amount || 0,
    monthlyRevenue: monthlyRevAgg._sum.amount || 0,
    yearlyRevenue: yearlyRevAgg._sum.amount || 0
  };

  // 4. Recent Tenant Registrations (Last 5)
  const recentRegistrations = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      businessName: true,
      ownerName: true,
      email: true,
      mobileNumber: true,
      subscriptionStatus: true,
      accountStatus: true,
      createdAt: true,
      currentPackage: true
    }
  });

  // 5. Recent Payments (Last 5)
  const recentPayments = await prisma.subscriptionHistory.findMany({
    where: { paymentStatus: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      tenant: { select: { id: true, businessName: true, ownerName: true, mobileNumber: true } },
      package: true
    }
  });

  // 6. Recent System Activities (Latest Bills across platform)
  const recentBills = await prisma.bill.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      tenant: { select: { businessName: true } },
      customer: { select: { name: true } }
    }
  });
  const recentActivities = recentBills.map(bill => ({
    id: bill.id,
    type: 'INVOICE_GENERATED',
    description: `Invoice #${bill.invoiceNumber} generated for ₹${bill.grandTotal} in ${bill.tenant.businessName}`,
    createdAt: bill.createdAt
  }));

  // 7. Support Ticket Summary
  const supportTicketSummary = {
    open: await prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    pending: await prisma.supportTicket.count({ where: { status: 'PENDING' } }),
    closed: await prisma.supportTicket.count({ where: { status: 'CLOSED' } })
  };

  return {
    tenantOverview: {
      totalTenants,
      freeTrial,
      freeTrialEnded,
      upgraded,
      planExpired
    },
    registrationsOverview,
    revenueOverview,
    recentRegistrations,
    recentPayments,
    recentActivities,
    supportTicketSummary
  };
};
