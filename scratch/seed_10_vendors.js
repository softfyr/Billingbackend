import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTenVendors() {
  console.log('🏬 --- SEEDING 10 REALISTIC TEST VENDORS FOR SUPER ADMIN DASHBOARD ---\n');

  try {
    const packages = await prisma.package.findMany({ orderBy: { amount: 'asc' } });
    if (packages.length === 0) {
      console.log('⚠️ No packages found. Please run node scratch/reset_db.js first.');
      process.exit(1);
    }

    const freeTrialPkg = packages.find(p => p.isFreeTrial) || packages[0];
    const basicPkg = packages.find(p => p.packageName === 'Basic') || packages[1] || packages[0];
    const proPkg = packages.find(p => p.packageName === 'Professional') || packages[packages.length - 1];

    const vendorsData = [
      { businessName: 'Super Mart Retail', ownerName: 'Amit Verma', mobileNumber: '9810000001', email: 'amit@supermart.com', status: 'FREE_TRIAL', package: freeTrialPkg, daysAgo: 2, daysExpiry: 28, account: 'ACTIVE' },
      { businessName: 'Apex Electronics', ownerName: 'Priya Sharma', mobileNumber: '9810000002', email: 'priya@apexelectronics.com', status: 'UPGRADED', package: proPkg, daysAgo: 45, daysExpiry: 320, account: 'ACTIVE' },
      { businessName: 'Fresh Organics Grocery', ownerName: 'Rohan Gupta', mobileNumber: '9810000003', email: 'rohan@freshorganics.com', status: 'UPGRADED', package: basicPkg, daysAgo: 10, daysExpiry: 20, account: 'ACTIVE' },
      { businessName: 'City Pharmacy & Meds', ownerName: 'Dr. Sunita Patel', mobileNumber: '9810000004', email: 'sunita@citymeds.com', status: 'FREE_TRIAL', package: freeTrialPkg, daysAgo: 5, daysExpiry: 25, account: 'ACTIVE' },
      { businessName: 'Urban Wear Apparel', ownerName: 'Vikram Malhotra', mobileNumber: '9810000005', email: 'vikram@urbanwear.com', status: 'EXPIRED', package: basicPkg, daysAgo: 40, daysExpiry: -10, account: 'ACTIVE' },
      { businessName: 'Metro Hardware Store', ownerName: 'Suresh Kumar', mobileNumber: '9810000006', email: 'suresh@metrohardware.com', status: 'UPGRADED', package: proPkg, daysAgo: 60, daysExpiry: 305, account: 'ACTIVE' },
      { businessName: 'Global Book Emporium', ownerName: 'Ananya Roy', mobileNumber: '9810000007', email: 'ananya@globalbooks.com', status: 'FREE_TRIAL', package: freeTrialPkg, daysAgo: 1, daysExpiry: 29, account: 'ACTIVE' },
      { businessName: 'Daily Needs Supermarket', ownerName: 'Manish Joshi', mobileNumber: '9810000008', email: 'manish@dailyneeds.com', status: 'FREE_TRIAL_ENDED', package: freeTrialPkg, daysAgo: 35, daysExpiry: -5, account: 'ACTIVE' },
      { businessName: 'Star Auto Spare Parts', ownerName: 'Harpreet Singh', mobileNumber: '9810000009', email: 'harpreet@starauto.com', status: 'UPGRADED', package: basicPkg, daysAgo: 15, daysExpiry: 15, account: 'ACTIVE' },
      { businessName: 'Blocked Test Store', ownerName: 'Rajesh Mishra', mobileNumber: '9810000010', email: 'rajesh@blockedstore.com', status: 'EXPIRED', package: freeTrialPkg, daysAgo: 50, daysExpiry: -20, account: 'SUSPENDED' }
    ];

    console.log('🧹 Cleaning up old 10 test vendors...');
    await prisma.user.deleteMany({ where: { mobileNumber: { in: vendorsData.map(v => v.mobileNumber) } } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: { in: vendorsData.map(v => v.mobileNumber) } } });

    console.log('🌱 Seeding 10 Vendors...');
    for (const v of vendorsData) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - v.daysAgo);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + v.daysExpiry);

      const tenant = await prisma.tenant.create({
        data: {
          businessName: v.businessName,
          ownerName: v.ownerName,
          email: v.email,
          mobileNumber: v.mobileNumber,
          country: 'India',
          subscriptionStatus: v.status,
          accountStatus: v.account,
          currentPackageId: v.package ? v.package.id : null,
          subscriptionStartDate: startDate,
          subscriptionExpiryDate: expiryDate,
          isProfileComplete: true
        }
      });

      const hashedPwd = await bcrypt.hash(`OTP_VERIFIED_${v.mobileNumber}`, 10);
      await prisma.user.create({
        data: {
          name: v.ownerName,
          email: v.email,
          mobileNumber: v.mobileNumber,
          passwordHash: hashedPwd,
          role: 'TENANT_ADMIN',
          status: v.account,
          tenantId: tenant.id
        }
      });

      if (v.status === 'UPGRADED' && v.package) {
        await prisma.subscriptionHistory.create({
          data: {
            tenantId: tenant.id,
            packageId: v.package.id,
            amount: v.package.amount,
            paymentMethod: 'UPI',
            paymentStatus: 'SUCCESS',
            transactionId: `SEED_TXN_${Date.now()}_${v.mobileNumber}`,
            startDate,
            expiryDate
          }
        });
      }

      console.log(`   ✅ Seeded Vendor: ${v.businessName} (${v.ownerName}) | Status: ${v.status} | Account: ${v.account}`);
    }

    console.log('\n🎉 --- 10 REALISTIC VENDORS SEEDED SUCCESSFULLY ---');
  } catch (error) {
    console.error('❌ Seeding 10 vendors failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTenVendors();
