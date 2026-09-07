import { prisma } from '../src/config/prisma.js';
import { generateBill, processProductReturn } from '../src/modules/bill/bill.service.js';
import { createPurchaseInvoice } from '../src/modules/purchase/purchase.service.js';

async function runTaxEdgeCasesTest() {
  console.log('🧪 --- STARTING COMPREHENSIVE TAX EDGE CASES TEST SUITE ---\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ TEST ${totalTests} PASSED: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ TEST ${totalTests} FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // 1. Setup Test Tenant & Users
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          ownerName: 'Edge Case Tester',
          mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          businessName: 'Edge Case Testing Store',
          subscriptionExpiryDate: new Date(Date.now() + 30 * 86400000)
        }
      });
    }

    let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Edge Test Staff',
          mobileNumber: tenant.mobileNumber,
          passwordHash: 'hashedpass',
          tenantId: tenant.id,
          role: 'TENANT_ADMIN'
        }
      });
    }

    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: `Edge Cat ${Date.now()}` } });
    }

    let subCategory = await prisma.subCategory.findFirst({ where: { categoryId: category.id } });
    if (!subCategory) {
      subCategory = await prisma.subCategory.create({
        data: { categoryId: category.id, name: `Edge SubCat ${Date.now()}` }
      });
    }

    let supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          tenantId: tenant.id,
          name: 'Edge Case Supplier',
          mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`
        }
      });
    }

    // Taxes Setup
    let tax0 = await prisma.tax.create({ data: { tenantId: tenant.id, name: 'GST 0%', percentage: 0 } });
    let tax12 = await prisma.tax.create({ data: { tenantId: tenant.id, name: 'GST 12%', percentage: 12 } });
    let tax18 = await prisma.tax.create({ data: { tenantId: tenant.id, name: 'GST 18%', percentage: 18 } });
    let tax28 = await prisma.tax.create({ data: { tenantId: tenant.id, name: 'GST 28%', percentage: 28 } });

    // Products Setup
    const prodExcl12 = await prisma.product.create({
      data: {
        tenantId: tenant.id, categoryId: category.id, subCategoryId: subCategory.id,
        name: 'Item Exclusive 12%', sku: `SKU-E12-${Date.now()}`,
        sellingPrice: 100, taxType: 'EXCLUSIVE', taxId: tax12.id, currentStock: 100
      }
    });

    const prodIncl18 = await prisma.product.create({
      data: {
        tenantId: tenant.id, categoryId: category.id, subCategoryId: subCategory.id,
        name: 'Item Inclusive 18%', sku: `SKU-I18-${Date.now()}`,
        sellingPrice: 500, mrp: 500, taxType: 'INCLUSIVE', taxId: tax18.id, currentStock: 100
      }
    });

    const prodZeroTax = await prisma.product.create({
      data: {
        tenantId: tenant.id, categoryId: category.id, subCategoryId: subCategory.id,
        name: 'Item Zero Tax', sku: `SKU-Z0-${Date.now()}`,
        sellingPrice: 150, taxType: 'INCLUSIVE', taxId: tax0.id, currentStock: 100
      }
    });

    const prodHighTax28 = await prisma.product.create({
      data: {
        tenantId: tenant.id, categoryId: category.id, subCategoryId: subCategory.id,
        name: 'Item Inclusive 28%', sku: `SKU-I28-${Date.now()}`,
        sellingPrice: 999.99, mrp: 999.99, taxType: 'INCLUSIVE', taxId: tax28.id, currentStock: 100
      }
    });

    // ==========================================
    // EDGE CASE 1: Mixed Invoice (Inclusive + Exclusive together)
    // ==========================================
    console.log('📌 EDGE CASE 1: Mixed Invoice (Tax Inclusive + Tax Exclusive in single bill)...');
    const billMixed = await generateBill(tenant.id, user.id, {
      customerMobile: '9900112233',
      customerName: 'Mixed Bill Customer',
      items: [
        { productId: prodExcl12.id, quantity: 2 }, // Base: 200, Tax (12%): 24, LineTotal: 224
        { productId: prodIncl18.id, quantity: 1 }  // Base: 423.73, Tax (18%): 76.27, LineTotal: 500
      ]
    });
    // Expected: Subtotal = 200 + 423.73 = 623.73, Tax = 24 + 76.27 = 100.27, GrandTotal = 724.00
    assert(billMixed.subtotal === 623.73, `Mixed Subtotal should be 623.73 (Got: ${billMixed.subtotal})`);
    assert(billMixed.totalTaxAmount === 100.27, `Mixed Tax should be 100.27 (Got: ${billMixed.totalTaxAmount})`);
    assert(billMixed.grandTotal === 724.00, `Mixed Grand Total should be 724.00 (Got: ${billMixed.grandTotal})`);

    // ==========================================
    // EDGE CASE 2: 0% Tax Exempt Product
    // ==========================================
    console.log('\n📌 EDGE CASE 2: 0% Tax Product (Nil-rated / Exempt)...');
    const billZero = await generateBill(tenant.id, user.id, {
      customerMobile: '9900112234',
      customerName: 'Zero Tax Customer',
      items: [{ productId: prodZeroTax.id, quantity: 2 }] // 2 * 150 = 300, Tax = 0
    });
    assert(billZero.subtotal === 300, `Zero Tax Subtotal should be 300 (Got: ${billZero.subtotal})`);
    assert(billZero.totalTaxAmount === 0, `Zero Tax Amount should be 0 (Got: ${billZero.totalTaxAmount})`);
    assert(billZero.grandTotal === 300, `Zero Tax Grand Total should be 300 (Got: ${billZero.grandTotal})`);

    // ==========================================
    // EDGE CASE 3: Line Item Discount + Fixed Invoice Level Discount
    // ==========================================
    console.log('\n📌 EDGE CASE 3: Line Item Discount + Overall Invoice Discount...');
    const billDisc = await generateBill(tenant.id, user.id, {
      customerMobile: '9900112235',
      customerName: 'Discount Customer',
      items: [{ productId: prodIncl18.id, quantity: 2, discountAmount: 100 }], // Gross: 1000 - 100 = 900
      discountType: 'FIXED',
      discountValue: 50 // Fixed ₹50 invoice discount
    });
    // Net Line Gross = 900, Base = 900 / 1.18 = 762.71, Tax = 137.29, LineTotal = 900
    // Invoice Grand Total = 762.71 + 137.29 - 50 = 850.00
    assert(billDisc.subtotal === 762.71, `Discounted Subtotal should be 762.71 (Got: ${billDisc.subtotal})`);
    assert(billDisc.totalTaxAmount === 137.29, `Discounted Tax should be 137.29 (Got: ${billDisc.totalTaxAmount})`);
    assert(billDisc.grandTotal === 850.00, `Discounted Grand Total should be 850.00 (Got: ${billDisc.grandTotal})`);

    // ==========================================
    // EDGE CASE 4: High GST (28%) & Decimal Fractional Quantities
    // ==========================================
    console.log('\n📌 EDGE CASE 4: High GST (28%) & Decimal MRP (₹999.99 x 3)...');
    const billHighTax = await generateBill(tenant.id, user.id, {
      customerMobile: '9900112236',
      customerName: 'High Tax Customer',
      items: [{ productId: prodHighTax28.id, quantity: 3 }] // 999.99 * 3 = 2999.97
    });
    // Base = 2999.97 / 1.28 = 2343.7265... -> 2343.73
    // Tax = 2999.97 - 2343.73 = 656.24
    // Total = 2999.97
    assert(billHighTax.subtotal === 2343.73, `High Tax Subtotal should be 2343.73 (Got: ${billHighTax.subtotal})`);
    assert(billHighTax.totalTaxAmount === 656.24, `High Tax Amount should be 656.24 (Got: ${billHighTax.totalTaxAmount})`);
    assert(billHighTax.grandTotal === 2999.97, `High Tax Grand Total should be 2999.97 (Got: ${billHighTax.grandTotal})`);

    // ==========================================
    // EDGE CASE 5: Purchase Invoice with Inclusive & Exclusive items
    // ==========================================
    console.log('\n📌 EDGE CASE 5: Purchase Invoice (Mixed Inclusive + Exclusive)...');
    const purchaseInvoice = await createPurchaseInvoice(tenant.id, user.id, {
      supplierId: supplier.id,
      items: [
        { productId: prodIncl18.id, quantity: 2, unitPurchasePrice: 500, taxPercent: 18 }, // Line Net = 1000. Base = 847.46, Tax = 152.54, Line Total = 1000
        { productId: prodExcl12.id, quantity: 2, unitPurchasePrice: 100, taxPercent: 12 }  // Line Net = 200. Base = 200, Tax = 24, Line Total = 224
      ]
    });
    // Purchase Total Amount should be 1000 + 224 = 1224.00
    assert(purchaseInvoice.totalAmount === 1224.00, `Purchase Invoice total should be 1224.00 (Got: ${purchaseInvoice.totalAmount})`);

    // ==========================================
    // EDGE CASE 6: Return on Tax Inclusive Bill
    // ==========================================
    console.log('\n📌 EDGE CASE 6: Processing Return on Tax Inclusive Invoice...');
    const returnResult = await processProductReturn(tenant.id, user.id, billMixed.id, [
      { productId: prodIncl18.id, returnQuantity: 1, reason: 'Defective' } // Returning inclusive item MRP ₹500
    ]);
    // Grand Total after return of ₹500 item: 724 - 500 = 224.00
    assert(returnResult.grandTotal === 224.00, `Updated Grand Total after return should be 224.00 (Got: ${returnResult.grandTotal})`);

    // ==========================================
    // EDGE CASE 7: Overriding `taxType` in request body
    // ==========================================
    console.log('\n📌 EDGE CASE 7: Overriding `taxType` dynamically in line item...');
    const billOverride = await generateBill(tenant.id, user.id, {
      customerMobile: '9900112237',
      customerName: 'Override Customer',
      items: [{ productId: prodExcl12.id, quantity: 1, taxType: 'INCLUSIVE' }] // Normally exclusive ₹100, but overridden to INCLUSIVE (GST 12%)
    });
    // Overridden to Inclusive: Base = 100 / 1.12 = 89.29, Tax = 10.71, GrandTotal = 100.00
    assert(billOverride.subtotal === 89.29, `Overridden Subtotal should be 89.29 (Got: ${billOverride.subtotal})`);
    assert(billOverride.totalTaxAmount === 10.71, `Overridden Tax should be 10.71 (Got: ${billOverride.totalTaxAmount})`);
    assert(billOverride.grandTotal === 100.00, `Overridden Grand Total should be 100.00 (Got: ${billOverride.grandTotal})`);

    console.log(`\n🎉 --- ALL ${passedTests}/${totalTests} EDGE CASE TESTS PASSED 100% PERFECTLY! ---`);
  } catch (err) {
    console.error('\n❌ EDGE CASE TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTaxEdgeCasesTest();
