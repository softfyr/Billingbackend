import { prisma } from '../src/config/prisma.js';
import { generateBill } from '../src/modules/bill/bill.service.js';

async function testTaxModes() {
  console.log('🧪 --- STARTING TAX INCLUSIVE & EXCLUSIVE MODES VERIFICATION TEST ---\n');

  try {
    // 1. Create or Find Test Tenant, User, and Tax
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          ownerName: 'Test Owner',
          mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          businessName: 'Tax Test Store',
          subscriptionExpiryDate: new Date(Date.now() + 30 * 86400000)
        }
      });
    }

    let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Test Staff',
          mobileNumber: tenant.mobileNumber,
          passwordHash: 'hashedpass',
          tenantId: tenant.id,
          role: 'TENANT_ADMIN'
        }
      });
    }

    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: `Test Category ${Date.now()}` } });
    }

    let subCategory = await prisma.subCategory.findFirst({ where: { categoryId: category.id } });
    if (!subCategory) {
      subCategory = await prisma.subCategory.create({
        data: { categoryId: category.id, name: `Test SubCategory ${Date.now()}` }
      });
    }

    let tax18 = await prisma.tax.findFirst({ where: { tenantId: tenant.id, percentage: 18 } });
    if (!tax18) {
      tax18 = await prisma.tax.create({
        data: { tenantId: tenant.id, name: 'GST 18%', percentage: 18 }
      });
    }

    // 2. Create Product A (Tax Exclusive: Selling Price ₹250, GST 18%)
    const prodExclusive = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: 'Item Exclusive Mode',
        sku: `SKU-EXCL-${Date.now()}`,
        sellingPrice: 250,
        mrp: 295,
        taxType: 'EXCLUSIVE',
        taxId: tax18.id,
        currentStock: 100
      }
    });

    // 3. Create Product B (Tax Inclusive: MRP/Selling Price ₹250, GST 18%)
    const prodInclusive = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: 'Item Inclusive Mode',
        sku: `SKU-INCL-${Date.now()}`,
        sellingPrice: 250,
        mrp: 250,
        taxType: 'INCLUSIVE',
        taxId: tax18.id,
        currentStock: 100
      }
    });

    console.log('1️⃣ Created Test Products:');
    console.log(`   - Product EXCLUSIVE: ID ${prodExclusive.id}, Selling Price ₹250, GST 18%`);
    console.log(`   - Product INCLUSIVE: ID ${prodInclusive.id}, MRP ₹250, GST 18%\n`);

    // 4. Test Exclusive Mode Bill Generation
    console.log('2️⃣ Generating Invoice for TAX EXCLUSIVE item...');
    const billExclusive = await generateBill(tenant.id, user.id, {
      customerMobile: '9876543210',
      customerName: 'Exclusive Mode Customer',
      items: [{ productId: prodExclusive.id, quantity: 1 }]
    });

    console.log('   --- EXCLUSIVE BILL RESULTS ---');
    console.log(`   Subtotal (Base Price): ₹${billExclusive.subtotal} (Expected: 250)`);
    console.log(`   Tax Added (18%): ₹${billExclusive.totalTaxAmount} (Expected: 45)`);
    console.log(`   Grand Total: ₹${billExclusive.grandTotal} (Expected: 295)`);

    const isExclSubtotalOk = billExclusive.subtotal === 250;
    const isExclTaxOk = billExclusive.totalTaxAmount === 45;
    const isExclGrandTotalOk = billExclusive.grandTotal === 295;

    if (isExclSubtotalOk && isExclTaxOk && isExclGrandTotalOk) {
      console.log('   ✅ Tax Exclusive Mode Calculation VERIFIED SUCCESSFUL!\n');
    } else {
      throw new Error(`Tax Exclusive calculation mismatch: ${JSON.stringify(billExclusive)}`);
    }

    // 5. Test Inclusive Mode Bill Generation
    console.log('3️⃣ Generating Invoice for TAX INCLUSIVE item...');
    const billInclusive = await generateBill(tenant.id, user.id, {
      customerMobile: '9876543211',
      customerName: 'Inclusive Mode Customer',
      items: [{ productId: prodInclusive.id, quantity: 1 }]
    });

    console.log('   --- INCLUSIVE BILL RESULTS ---');
    console.log(`   Taxable Base (Back-Calculated): ₹${billInclusive.subtotal} (Expected: 211.86)`);
    console.log(`   Extracted GST (18%): ₹${billInclusive.totalTaxAmount} (Expected: 38.14)`);
    console.log(`   Grand Total (MRP Total): ₹${billInclusive.grandTotal} (Expected: 250)`);

    const isInclSubtotalOk = Math.abs(billInclusive.subtotal - 211.86) < 0.01;
    const isInclTaxOk = Math.abs(billInclusive.totalTaxAmount - 38.14) < 0.01;
    const isInclGrandTotalOk = billInclusive.grandTotal === 250;

    if (isInclSubtotalOk && isInclTaxOk && isInclGrandTotalOk) {
      console.log('   ✅ Tax Inclusive Mode Calculation VERIFIED SUCCESSFUL!\n');
    } else {
      throw new Error(`Tax Inclusive calculation mismatch: ${JSON.stringify(billInclusive)}`);
    }

    console.log('🎉 --- ALL TAX INCLUSIVE AND EXCLUSIVE TESTS PASSED 100% PERFECTLY! ---');
  } catch (err) {
    console.error('❌ Tax Modes Verification Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTaxModes();
