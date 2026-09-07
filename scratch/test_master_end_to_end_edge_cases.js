import { prisma } from '../src/config/prisma.js';
import { createSupplier, getSupplierDetails, recordSupplierPayment } from '../src/modules/supplier/supplier.service.js';
import { createProduct, getProductDetails, getLowStockProducts } from '../src/modules/product/product.service.js';
import { createPurchaseInvoice, confirmPurchaseInvoice, createPurchaseReturn } from '../src/modules/purchase/purchase.service.js';
import { generateBill, cancelBill, processProductReturn } from '../src/modules/bill/bill.service.js';

async function runMasterFlowEdgeCases() {
  console.log('🚀 --- STARTING MASTER E2E INTEGRATION & EDGE CASES TEST SUITE ---');
  console.log('   Modules tested: Supplier ➔ Product ➔ Purchase ➔ Bill ➔ Inventory StockHistory\n');

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
    // Setup Tenant & User
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          ownerName: 'Master Tester',
          mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          businessName: 'Master E2E Store',
          subscriptionExpiryDate: new Date(Date.now() + 30 * 86400000)
        }
      });
    }

    let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Master Staff',
          mobileNumber: tenant.mobileNumber,
          passwordHash: 'hashedpass',
          tenantId: tenant.id,
          role: 'TENANT_ADMIN'
        }
      });
    }

    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: `Master Cat ${Date.now()}` } });
    }

    let subCategory = await prisma.subCategory.findFirst({ where: { categoryId: category.id } });
    if (!subCategory) {
      subCategory = await prisma.subCategory.create({
        data: { categoryId: category.id, name: `Master SubCat ${Date.now()}` }
      });
    }

    let tax18 = await prisma.tax.findFirst({ where: { tenantId: tenant.id, percentage: 18 } }) ||
                 await prisma.tax.create({ data: { tenantId: tenant.id, name: 'GST 18%', percentage: 18 } });

    // ==========================================
    // STEP 1: SUPPLIER MODULE
    // ==========================================
    console.log('1️⃣ --- SUPPLIER MODULE TESTING ---');
    const supplier = await createSupplier(tenant.id, {
      name: 'Omni Global Wholesalers',
      companyName: 'Omni Traders Ltd',
      mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      gstin: '27AAAAA0000A1Z5',
      creditLimit: 50000
    });
    assert(supplier.id !== undefined, 'Supplier created successfully.');
    assert(supplier.totalPurchases === 0 && supplier.outstandingDue === 0, 'Supplier initial balance is 0.');

    // ==========================================
    // STEP 2: PRODUCT MODULE
    // ==========================================
    console.log('\n2️⃣ --- PRODUCT MODULE TESTING ---');
    const prodA = await createProduct(tenant.id, user.id, {
      categoryId: category.id, subCategoryId: subCategory.id,
      name: 'Smart Tablet (Tax Inclusive)', sku: `SKU-TAB-${Date.now()}`, barcode: `BAR-TAB-${Date.now()}`,
      purchasePrice: 800, sellingPrice: 1000, mrp: 1000, taxType: 'INCLUSIVE', taxId: tax18.id,
      openingStock: 10, minStockLevel: 5
    });

    const prodB = await createProduct(tenant.id, user.id, {
      categoryId: category.id, subCategoryId: subCategory.id,
      name: 'Bluetooth Earbuds (Tax Exclusive)', sku: `SKU-EAR-${Date.now()}`, barcode: `BAR-EAR-${Date.now()}`,
      purchasePrice: 200, sellingPrice: 250, taxType: 'EXCLUSIVE', taxId: tax18.id,
      openingStock: 5, minStockLevel: 10
    });

    assert(prodA.currentStock === 10, 'Product A opening stock initialized to 10.');
    assert(prodB.currentStock === 5, 'Product B opening stock initialized to 5.');

    // ==========================================
    // STEP 3: PURCHASE INVOICE & SUPPLIER LEDGER FLOW
    // ==========================================
    console.log('\n3️⃣ --- PURCHASE MODULE TESTING ---');
    // Create DRAFT Purchase
    const draftPurchase = await createPurchaseInvoice(tenant.id, user.id, {
      supplierId: supplier.id,
      purchaseStatus: 'DRAFT',
      items: [
        { productId: prodA.id, quantity: 20, unitPurchasePrice: 800, taxPercent: 18 }, // Tax Inclusive purchase
        { productId: prodB.id, quantity: 30, unitPurchasePrice: 200, taxPercent: 18 }  // Tax Exclusive purchase
      ]
    });
    assert(draftPurchase.purchaseStatus === 'DRAFT', 'Purchase Invoice created in DRAFT state.');

    // Confirm DRAFT Purchase -> Stock & Supplier balance should be updated
    const confirmedPurchase = await confirmPurchaseInvoice(tenant.id, user.id, draftPurchase.id);
    assert(confirmedPurchase.purchaseStatus === 'CONFIRMED', 'Purchase Invoice confirmed.');

    // Check Updated Product Stock after Purchase:
    // ProdA: 10 + 20 = 30
    // ProdB: 5 + 30 = 35
    const updatedProdA = await getProductDetails(tenant.id, prodA.id);
    const updatedProdB = await getProductDetails(tenant.id, prodB.id);
    assert(updatedProdA.currentStock === 30, `Product A stock increased to 30 (Got: ${updatedProdA.currentStock})`);
    assert(updatedProdB.currentStock === 35, `Product B stock increased to 35 (Got: ${updatedProdB.currentStock})`);

    // Check Supplier Ledger after Purchase:
    const supplierAfterPurchase = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    assert(supplierAfterPurchase.outstandingDue > 0, `Supplier outstanding due updated to ${supplierAfterPurchase.outstandingDue}.`);

    // Record Partial Supplier Payment
    const paymentRes = await recordSupplierPayment(tenant.id, user.id, supplier.id, {
      amount: 5000,
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-REF-998877'
    });
    assert(paymentRes.payment.amount === 5000, 'Supplier payment of 5000 recorded successfully.');

    // ==========================================
    // STEP 4: SALES BILLING & CUSTOMER LEDGER FLOW
    // ==========================================
    console.log('\n4️⃣ --- SALES BILLING MODULE TESTING ---');
    const bill1 = await generateBill(tenant.id, user.id, {
      customerMobile: '9123456789', customerName: 'Rohan Sharma',
      items: [
        { productId: prodA.id, quantity: 2 }, // Inclusive: 2 * 1000 = 2000. Base: 1694.92, Tax: 305.08
        { productId: prodB.id, quantity: 5 }  // Exclusive: 5 * 250 = 1250. Base: 1250, Tax: 225
      ],
      paymentStatus: 'PAID'
    });
    // Expected Grand Total: 2000 + 1475 = 3475.00
    assert(bill1.grandTotal === 3475.00, `Bill 1 Grand Total is 3475.00 (Got: ${bill1.grandTotal})`);

    // Stock check after sale:
    // ProdA: 30 - 2 = 28
    // ProdB: 35 - 5 = 30
    const prodAAfterSale = await getProductDetails(tenant.id, prodA.id);
    const prodBAfterSale = await getProductDetails(tenant.id, prodB.id);
    assert(prodAAfterSale.currentStock === 28, `ProdA stock deducted to 28 (Got: ${prodAAfterSale.currentStock})`);
    assert(prodBAfterSale.currentStock === 30, `ProdB stock deducted to 30 (Got: ${prodBAfterSale.currentStock})`);

    // ==========================================
    // STEP 5: PRODUCT RETURNS & BILL CANCELLATIONS
    // ==========================================
    console.log('\n5️⃣ --- PRODUCT RETURN & BILL CANCELLATION TESTING ---');
    // Return 1 unit of ProdA from Bill 1
    const billReturnRes = await processProductReturn(tenant.id, user.id, bill1.id, [
      { productId: prodA.id, returnQuantity: 1, reason: 'Color mismatched' }
    ]);
    assert(billReturnRes.status === 'PARTIALLY_RETURNED', 'Bill status updated to PARTIALLY_RETURNED.');

    // ProdA stock should increase back from 28 to 29
    const prodAAfterReturn = await getProductDetails(tenant.id, prodA.id);
    assert(prodAAfterReturn.currentStock === 29, `ProdA stock restored to 29 after return (Got: ${prodAAfterReturn.currentStock})`);

    // Cancel Bill 1 completely -> Restores rest of items
    const cancelledBill = await cancelBill(tenant.id, user.id, bill1.id);
    assert(cancelledBill.status === 'CANCELLED', 'Bill cancelled successfully.');

    // Check final stock after cancellation:
    // ProdA restorable quantity = 2 - 1 = 1 unit -> 29 + 1 = 30
    // ProdB restorable quantity = 5 units -> 30 + 5 = 35
    const prodAAfterCancel = await getProductDetails(tenant.id, prodA.id);
    const prodBAfterCancel = await getProductDetails(tenant.id, prodB.id);
    assert(prodAAfterCancel.currentStock === 30, `ProdA stock fully restored to 30 (Got: ${prodAAfterCancel.currentStock})`);
    assert(prodBAfterCancel.currentStock === 35, `ProdB stock fully restored to 35 (Got: ${prodBAfterCancel.currentStock})`);

    // ==========================================
    // STEP 6: INVENTORY & STOCKHISTORY AUDIT
    // ==========================================
    console.log('\n6️⃣ --- INVENTORY & STOCKHISTORY AUDIT ---');
    const stockLogsA = await prisma.stockHistory.findMany({
      where: { tenantId: tenant.id, productId: prodA.id },
      orderBy: { createdAt: 'asc' }
    });
    assert(stockLogsA.length >= 4, `Stock history for ProdA recorded ${stockLogsA.length} stock movement events.`);
    console.log('   ProdA Stock History Timeline:');
    stockLogsA.forEach(log => {
      console.log(`   - Reason: ${log.reason.padEnd(18)} | Prev: ${log.previousStock} | Adj: ${log.addedRemovedQty > 0 ? '+' : ''}${log.addedRemovedQty} | New: ${log.updatedStock}`);
    });

    console.log(`\n🎉 --- MASTER E2E INTEGRATION SUITE COMPLETED (${passedTests}/${totalTests} TESTS PASSED 100%) ---`);
  } catch (err) {
    console.error('\n❌ MASTER E2E INTEGRATION TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMasterFlowEdgeCases();
