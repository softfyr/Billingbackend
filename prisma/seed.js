import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 --- SEEDING COMPLETE BILLING SAAS DEMO DATASET ---\n');

  // 1. Seed Packages
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

  let freeTrialPkg = null;
  for (const pkg of packagesData) {
    let existing = await prisma.package.findFirst({ where: { packageName: pkg.packageName } });
    if (!existing) {
      existing = await prisma.package.create({ data: pkg });
      console.log(`✅ [SEED] Package created: ${pkg.packageName}`);
    }
    if (pkg.isFreeTrial) freeTrialPkg = existing;
  }

  // 2. Seed Super Admin User
  const adminEmail = 'admin@softfyr.com';
  const adminMobile = '9000000000';
  let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
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
    console.log(`✅ [SEED] Super Admin created: ${adminEmail} (Password: admin123)`);
  }

  // 3. Seed Master Categories & Sub-Categories
  let catElectronics = await prisma.category.findUnique({ where: { name: 'Electronics & IT' } });
  if (!catElectronics) {
    catElectronics = await prisma.category.create({
      data: { name: 'Electronics & IT', description: 'Computers, Peripherals, Accessories & Mobiles' }
    });
    console.log('✅ [SEED] Category created: Electronics & IT');
  }

  let subPrinters = await prisma.subCategory.findUnique({
    where: { categoryId_name: { categoryId: catElectronics.id, name: 'Printers & Accessories' } }
  });
  if (!subPrinters) {
    subPrinters = await prisma.subCategory.create({
      data: {
        categoryId: catElectronics.id,
        name: 'Printers & Accessories',
        description: 'Laser, Thermal & Inkjet Printers',
        enableExpiryDate: false
      }
    });
    console.log('✅ [SEED] Sub-Category created: Printers & Accessories');
  }

  // 4. Seed Demo Vendor Store & Owner Profile
  const vendorMobile = '9876543210';
  const vendorEmail = 'owner@apexretail.com';
  let vendorUser = await prisma.user.findUnique({ where: { mobileNumber: vendorMobile } });

  let tenant = null;
  if (!vendorUser) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    tenant = await prisma.tenant.create({
      data: {
        businessName: 'Apex Retail Superstore Jaipur',
        businessType: 'Retail & Electronics Superstore',
        ownerName: 'Rajesh Sharma',
        email: vendorEmail,
        mobileNumber: vendorMobile,
        businessAddress: 'Plot 102, MI Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        gstNumber: '08ABCDE1234F1Z5',
        panNumber: 'ABCDE1234F',
        isProfileComplete: true,
        subscriptionStatus: 'FREE_TRIAL',
        accountStatus: 'ACTIVE',
        currentPackageId: freeTrialPkg.id,
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: expiryDate
      }
    });

    const hashedPassword = await bcrypt.hash('vendor123', 10);
    vendorUser = await prisma.user.create({
      data: {
        name: 'Rajesh Sharma (Store Owner)',
        email: vendorEmail,
        mobileNumber: vendorMobile,
        passwordHash: hashedPassword,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        tenantId: tenant.id
      }
    });
    console.log(`✅ [SEED] Vendor Store Created: Apex Retail Superstore Jaipur (Mobile: 9876543210)`);
  } else {
    tenant = await prisma.tenant.findUnique({ where: { id: vendorUser.tenantId } });
  }

  // 5. Seed Store Employees
  const emp1Mobile = '9876543211';
  let emp1User = await prisma.user.findUnique({ where: { mobileNumber: emp1Mobile } });
  if (!emp1User) {
    const hashedPassword = await bcrypt.hash('employee123', 10);
    emp1User = await prisma.user.create({
      data: {
        name: 'Ramesh Kumar (Cashier)',
        mobileNumber: emp1Mobile,
        passwordHash: hashedPassword,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        tenantId: tenant.id
      }
    });

    await prisma.employeeProfile.create({
      data: {
        tenantId: tenant.id,
        userId: emp1User.id,
        fatherName: 'Suresh Kumar',
        address: 'Bapu Nagar',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302015',
        monthlySalary: 18000,
        salaryDate: 5
      }
    });
    console.log(`✅ [SEED] Employee Created: Ramesh Kumar (Mobile: 9876543211)`);
  }

  // 6. Seed Suppliers
  let supplier1 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: 'Mahaveer Electronics' } });
  if (!supplier1) {
    supplier1 = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: 'Mahaveer Electronics',
        companyName: 'Mahaveer Distribution Pvt Ltd',
        mobileNumber: '9829011223',
        email: 'sales@mahaveerelectronics.com',
        gstin: '08AAAAA1111A1Z1',
        address: 'Sector 5, Transport Nagar',
        totalPurchases: 0,
        outstandingDue: 0
      }
    });
    console.log('✅ [SEED] Supplier Created: Mahaveer Electronics');
  }

  let supplier2 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: 'Shree Ram Traders' } });
  if (!supplier2) {
    supplier2 = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: 'Shree Ram Traders',
        companyName: 'Shree Ram Logistics Jaipur',
        mobileNumber: '9829044556',
        email: 'info@shreeramtraders.com',
        gstin: '08BBBBB2222B1Z2',
        address: 'VKI Area, Road No 14',
        totalPurchases: 0,
        outstandingDue: 0
      }
    });
    console.log('✅ [SEED] Supplier Created: Shree Ram Traders');
  }

  // 7. Seed Products
  let prodPrinter = await prisma.product.findFirst({ where: { tenantId: tenant.id, name: 'HP Laserjet Pro M126nw Printer' } });
  if (!prodPrinter) {
    prodPrinter = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catElectronics.id,
        subCategoryId: subPrinters.id,
        name: 'HP Laserjet Pro M126nw Printer',
        sku: 'SKU-HP-126NW',
        barcode: '8901234567891',
        purchasePrice: 14500,
        sellingPrice: 17500,
        mrp: 18990,
        openingStock: 5,
        currentStock: 5,
        minStockLevel: 2,
        status: 'ACTIVE'
      }
    });
    console.log('✅ [SEED] Product Created: HP Laserjet Pro M126nw Printer');
  }

  let prodMouse = await prisma.product.findFirst({ where: { tenantId: tenant.id, name: 'Logitech B170 Wireless Mouse' } });
  if (!prodMouse) {
    prodMouse = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catElectronics.id,
        subCategoryId: subPrinters.id,
        name: 'Logitech B170 Wireless Mouse',
        sku: 'SKU-LOGI-B170',
        barcode: '8909876543210',
        purchasePrice: 450,
        sellingPrice: 699,
        mrp: 895,
        openingStock: 20,
        currentStock: 20,
        minStockLevel: 5,
        status: 'ACTIVE'
      }
    });
    console.log('✅ [SEED] Product Created: Logitech B170 Wireless Mouse');
  }

  // 8. Seed Purchase Bill with Supplier Balance & Stock Inwarding
  let purchaseBill = await prisma.purchaseInvoice.findFirst({ where: { tenantId: tenant.id, purchaseNumber: 'PUR-SEED-1001' } });
  if (!purchaseBill) {
    const subtotal = (5 * 14500) + (10 * 450); // 72,500 + 4,500 = 77,000
    const taxAmt = Math.round(subtotal * 0.18); // 13,860
    const grandTotal = subtotal + taxAmt; // 90,860
    const paidAmt = 40860;
    const dueAmt = 50000;

    purchaseBill = await prisma.purchaseInvoice.create({
      data: {
        tenantId: tenant.id,
        supplierId: supplier1.id,
        purchaseNumber: 'PUR-SEED-1001',
        invoiceDate: new Date(),
        subtotal,
        taxAmount: taxAmt,
        discountAmount: 0,
        totalAmount: grandTotal,
        paidAmount: paidAmt,
        dueAmount: dueAmt,
        paymentStatus: 'PARTIALLY_PAID',
        items: {
          create: [
            { productId: prodPrinter.id, quantity: 5, unitPurchasePrice: 14500, totalAmount: 72500 },
            { productId: prodMouse.id, quantity: 10, unitPurchasePrice: 450, totalAmount: 4500 }
          ]
        }
      }
    });

    // Update Product Stock (+5 Printer, +10 Mouse)
    await prisma.product.update({ where: { id: prodPrinter.id }, data: { currentStock: { increment: 5 } } });
    await prisma.product.update({ where: { id: prodMouse.id }, data: { currentStock: { increment: 10 } } });

    // Update Supplier Dues
    await prisma.supplier.update({
      where: { id: supplier1.id },
      data: {
        totalPurchases: { increment: grandTotal },
        outstandingDue: { increment: dueAmt }
      }
    });

    console.log(`✅ [SEED] Purchase Invoice Inwarded: PUR-SEED-1001 (Bill: ₹${grandTotal}, Paid: ₹${paidAmt}, Due: ₹${dueAmt})`);
  }

  console.log('\n🎉 --- DATABASE SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
