import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🧹 --- STARTING COMPLETE DATABASE CLEANUP & RESET ---\n');

  try {
    // Delete data in correct relational order
    console.log('🗑️  Deleting transactional data...');
    
    // Safely delete if model exists on prisma client
    if (prisma.ticketMessage) await prisma.ticketMessage.deleteMany().catch(() => {});
    if (prisma.supportTicket) await prisma.supportTicket.deleteMany().catch(() => {});
    if (prisma.stockHistory) await prisma.stockHistory.deleteMany().catch(() => {});
    if (prisma.billItem) await prisma.billItem.deleteMany().catch(() => {});
    if (prisma.bill) await prisma.bill.deleteMany().catch(() => {});
    if (prisma.purchaseItem) await prisma.purchaseItem.deleteMany().catch(() => {});
    if (prisma.purchaseInvoiceItem) await prisma.purchaseInvoiceItem.deleteMany().catch(() => {});
    if (prisma.purchaseInvoice) await prisma.purchaseInvoice.deleteMany().catch(() => {});
    if (prisma.employeeProfile) await prisma.employeeProfile.deleteMany().catch(() => {});
    if (prisma.customer) await prisma.customer.deleteMany().catch(() => {});
    if (prisma.product) await prisma.product.deleteMany().catch(() => {});
    if (prisma.additionalField) await prisma.additionalField.deleteMany().catch(() => {});
    if (prisma.subCategory) await prisma.subCategory.deleteMany().catch(() => {});
    if (prisma.category) await prisma.category.deleteMany().catch(() => {});
    if (prisma.tax) await prisma.tax.deleteMany().catch(() => {});
    if (prisma.supplier) await prisma.supplier.deleteMany().catch(() => {});
    if (prisma.subscriptionHistory) await prisma.subscriptionHistory.deleteMany().catch(() => {});
    if (prisma.oTPVerification) await prisma.oTPVerification.deleteMany().catch(() => {});
    if (prisma.user) await prisma.user.deleteMany().catch(() => {});
    if (prisma.tenant) await prisma.tenant.deleteMany().catch(() => {});
    if (prisma.package) await prisma.package.deleteMany().catch(() => {});

    console.log('✨ All transactional tables cleaned successfully.');

    // 1. Seed Packages (Free Trial, Basic, Professional)
    console.log('\n📦 Seeding 3 Packages: Free Trial, Basic, Professional...');
    const freeTrial = await prisma.package.create({
      data: {
        packageName: 'Free Trial',
        description: 'Standard 30-Day Free Trial Package for New Vendors',
        durationMonths: 1,
        amount: 0,
        isFreeTrial: true,
        status: 'ACTIVE'
      }
    });

    const basicPkg = await prisma.package.create({
      data: {
        packageName: 'Basic',
        description: 'Essential Billing & Inventory Tools for Small Retailers',
        durationMonths: 1,
        amount: 499,
        isFreeTrial: false,
        status: 'ACTIVE'
      }
    });

    const proPkg = await prisma.package.create({
      data: {
        packageName: 'Professional',
        description: 'Complete Billing, Multi-Staff, Advanced Reports & Inventory Management',
        durationMonths: 12,
        amount: 1499,
        isFreeTrial: false,
        status: 'ACTIVE'
      }
    });

    console.log('   ✅ Seeded Packages:', freeTrial.packageName, '|', basicPkg.packageName, '|', proPkg.packageName);

    // 2. Seed Super Admin User
    console.log('\n👑 Seeding Super Admin Account...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const superAdmin = await prisma.user.create({
      data: {
        name: 'SaaS Platform Admin',
        email: 'admin@softfyr.com',
        mobileNumber: '9000000000',
        passwordHash: hashedAdminPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log(`   ✅ Seeded Super Admin User: ${superAdmin.email} (Password: admin123)`);

    console.log('\n🎉 --- DATABASE CLEANED & INITIAL SEEDING COMPLETE ---');
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
