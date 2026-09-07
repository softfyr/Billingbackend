import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 --- SEEDING PRODUCTION INITIALIZATION DATASET ---\n');

  // 1. Seed Subscription Packages
  const packagesData = [
    {
      packageName: 'Free Trial',
      description: 'Standard 30-Day Free Trial Package for New Vendors',
      durationMonths: 1,
      amount: 0,
      isFreeTrial: true,
      status: 'ACTIVE'
    },
    {
      packageName: 'Basic',
      description: 'Essential Billing & Inventory Tools for Small Retailers',
      durationMonths: 1,
      amount: 499,
      isFreeTrial: false,
      status: 'ACTIVE'
    },
    {
      packageName: 'Professional',
      description: 'Complete Billing, Multi-Staff, Advanced Reports & Inventory Management',
      durationMonths: 12,
      amount: 4999,
      isFreeTrial: false,
      status: 'ACTIVE'
    }
  ];

  for (const pkg of packagesData) {
    const existing = await prisma.package.findFirst({ where: { packageName: pkg.packageName } });
    if (!existing) {
      await prisma.package.create({ data: pkg });
      console.log(`✅ [SEED] Master Package created: ${pkg.packageName}`);
    }
  }

  // 2. Seed Super Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@softfyr.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminMobile = process.env.ADMIN_MOBILE || '9000000000';

  let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    superAdmin = await prisma.user.create({
      data: {
        name: 'SaaS Platform Admin',
        email: adminEmail,
        mobileNumber: adminMobile,
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ [SEED] Super Admin created: ${adminEmail} (Password: ${adminPassword})`);
  } else {
    console.log(`ℹ️ [SEED] Super Admin already exists: ${superAdmin.email}`);
  }

  // 3. Seed Master Categories & Sub-Categories
  let catElectronics = await prisma.category.findUnique({ where: { name: 'Electronics & IT' } });
  if (!catElectronics) {
    catElectronics = await prisma.category.create({
      data: { name: 'Electronics & IT', description: 'Computers, Peripherals, Accessories & Mobiles' }
    });
    console.log('✅ [SEED] Master Category created: Electronics & IT');
  }

  let subPrinters = await prisma.subCategory.findUnique({
    where: { categoryId_name: { categoryId: catElectronics.id, name: 'Printers & Accessories' } }
  });
  if (!subPrinters) {
    await prisma.subCategory.create({
      data: {
        categoryId: catElectronics.id,
        name: 'Printers & Accessories',
        description: 'Laser, Thermal & Inkjet Printers',
        enableExpiryDate: false
      }
    });
    console.log('✅ [SEED] Master Sub-Category created: Printers & Accessories');
  }

  console.log('\n🎉 --- PRODUCTION SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
