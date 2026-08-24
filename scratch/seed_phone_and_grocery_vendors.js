import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function demonstrateTwoVendors() {
  console.log('🏬 --- DEMONSTRATING VENDOR 1 (PHONE RETAILER) vs VENDOR 2 (GROCERY RETAILER) ---\n');

  try {
    // 1. Create Master Categories
    console.log('1️⃣ Super Admin creates Master Categories & Sub-Categories with Dynamic Fields...');

    // Category 1: Electronics
    let electronicsCat = await prisma.category.findFirst({ where: { name: 'Electronics & Mobiles' } });
    if (!electronicsCat) {
      electronicsCat = await prisma.category.create({
        data: { name: 'Electronics & Mobiles', description: 'Smartphones, Laptops, Accessories' }
      });
    }

    // Sub-Category: Smartphones (No Expiry Date needed, but has IMEI/RAM fields)
    let smartphoneSub = await prisma.subCategory.findFirst({ where: { name: 'Smartphones' } });
    if (!smartphoneSub) {
      smartphoneSub = await prisma.subCategory.create({
        data: {
          categoryId: electronicsCat.id,
          name: 'Smartphones',
          description: 'Android & iOS Phones',
          enableExpiryDate: false // Mobile phones don't expire
        }
      });

      // Add Custom Fields for Smartphones
      await prisma.additionalField.createMany({
        data: [
          { subCategoryId: smartphoneSub.id, labelName: 'RAM Capacity', inputType: 'TEXT', isRequired: true, status: 'ACTIVE' },
          { subCategoryId: smartphoneSub.id, labelName: 'Storage / ROM', inputType: 'TEXT', isRequired: true, status: 'ACTIVE' },
          { subCategoryId: smartphoneSub.id, labelName: 'IMEI / Serial Number', inputType: 'TEXT', isRequired: true, status: 'ACTIVE' }
        ]
      });
    }

    // Category 2: Grocery
    let groceryCat = await prisma.category.findFirst({ where: { name: 'Grocery & Dairy' } });
    if (!groceryCat) {
      groceryCat = await prisma.category.create({
        data: { name: 'Grocery & Dairy', description: 'Fresh produce, milk, packaged foods' }
      });
    }

    // Sub-Category: Dairy Products (Expiry Date Required!)
    let dairySub = await prisma.subCategory.findFirst({ where: { name: 'Dairy & Milk' } });
    if (!dairySub) {
      dairySub = await prisma.subCategory.create({
        data: {
          categoryId: groceryCat.id,
          name: 'Dairy & Milk',
          description: 'Milk, Butter, Cheese',
          enableExpiryDate: true // Expiry Date is mandatory for Dairy!
        }
      });

      // Add Custom Fields for Dairy
      await prisma.additionalField.createMany({
        data: [
          { subCategoryId: dairySub.id, labelName: 'Batch Code', inputType: 'TEXT', isRequired: true, status: 'ACTIVE' },
          { subCategoryId: dairySub.id, labelName: 'Fat Percentage (%)', inputType: 'NUMBER', isRequired: false, status: 'ACTIVE' }
        ]
      });
    }

    console.log('   ✅ Categories, Sub-Categories & Dynamic Custom Fields configured.\n');

    // 2. Setup Vendor 1 (Phone Retailer)
    console.log('2️⃣ Setting up VENDOR 1: Phone Retailer ("Apex Mobile World")...');
    let vendor1 = await prisma.tenant.findFirst({ where: { email: 'owner@apexmobile.com' } });
    if (!vendor1) {
      vendor1 = await prisma.tenant.create({
        data: {
          businessName: 'Apex Mobile World',
          ownerName: 'Rahul Phone Retailer',
          email: 'owner@apexmobile.com',
          mobileNumber: '9900000001',
          subscriptionStatus: 'UPGRADED',
          accountStatus: 'ACTIVE',
          subscriptionStartDate: new Date(),
          subscriptionExpiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          isProfileComplete: true
        }
      });
    }

    // Clean up old demo products
    await prisma.product.deleteMany({ where: { tenantId: { in: [vendor1.id] } } });

    // Vendor 1 Product (iPhone 15 Pro)
    const phoneProduct = await prisma.product.create({
      data: {
        tenantId: vendor1.id,
        categoryId: electronicsCat.id,
        subCategoryId: smartphoneSub.id,
        name: 'iPhone 15 Pro (128GB - Titanium)',
        sellingPrice: 124900,
        purchasePrice: 110000,
        mrp: 134900,
        currentStock: 15,
        minStockLevel: 3,
        expiryDate: null // Phones do not expire
      }
    });
    console.log(`   📱 Vendor 1 Product Created: "${phoneProduct.name}"`);
    console.log(`      Sub-Category: Smartphones (enableExpiryDate = false)`);

    // 3. Setup Vendor 2 (Grocery Retailer)
    console.log('\n3️⃣ Setting up VENDOR 2: Grocery Retailer ("Fresh Dairy & Grocery Mart")...');
    let vendor2 = await prisma.tenant.findFirst({ where: { email: 'owner@freshgrocery.com' } });
    if (!vendor2) {
      vendor2 = await prisma.tenant.create({
        data: {
          businessName: 'Fresh Dairy & Grocery Mart',
          ownerName: 'Suresh Grocery Retailer',
          email: 'owner@freshgrocery.com',
          mobileNumber: '9900000002',
          subscriptionStatus: 'UPGRADED',
          accountStatus: 'ACTIVE',
          subscriptionStartDate: new Date(),
          subscriptionExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isProfileComplete: true
        }
      });
    }

    await prisma.product.deleteMany({ where: { tenantId: { in: [vendor2.id] } } });

    // Vendor 2 Product (Amul Taaza Milk 1L) with Expiry Date
    const milkExpiry = new Date();
    milkExpiry.setDate(milkExpiry.getDate() + 5); // Expires in 5 days!

    const groceryProduct = await prisma.product.create({
      data: {
        tenantId: vendor2.id,
        categoryId: groceryCat.id,
        subCategoryId: dairySub.id,
        name: 'Amul Taaza Toned Milk (1 Litre)',
        sellingPrice: 56,
        purchasePrice: 50,
        mrp: 56,
        currentStock: 100,
        minStockLevel: 20,
        expiryDate: milkExpiry // Mandatory expiry date for Dairy
      }
    });
    console.log(`   🥛 Vendor 2 Product Created: "${groceryProduct.name}"`);
    console.log(`      Sub-Category: Dairy & Milk (enableExpiryDate = true)`);
    console.log(`      Expiry Date Enforced: ${groceryProduct.expiryDate.toISOString().split('T')[0]} (Expires in 5 Days!)`);

    console.log('\n🎉 --- TWO VENDORS DEMONSTRATED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

demonstrateTwoVendors();
