import { prisma } from '../src/config/prisma.js';
import * as productService from '../src/modules/product/product.service.js';
import * as supplierService from '../src/modules/supplier/supplier.service.js';
import * as purchaseService from '../src/modules/purchase/purchase.service.js';
import * as billService from '../src/modules/bill/bill.service.js';

async function runDeepEdgeCaseTests() {
  console.log('🔬 --- STARTING COMPREHENSIVE EDGE CASE & FUNCTIONALITY AUDIT ---');

  const mobileT1 = '9991112223';
  const mobileT2 = '8881112223';
  const supplierMobile = '9870001122';
  const customerMobile = '9870003344';

  try {
    // 1. Cleanup Test Environment
    console.log('\n🧹 Cleaning up test tenants...');
    const oldTenants = await prisma.tenant.findMany({ where: { mobileNumber: { in: [mobileT1, mobileT2] } } });
    const oldIds = oldTenants.map(t => t.id);
    if (oldIds.length > 0) {
      await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { tenantId: { in: oldIds } } } });
      await prisma.purchaseReturn.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseInvoice: { tenantId: { in: oldIds } } } });
      await prisma.purchaseInvoice.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.supplierPayment.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.supplier.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.stockHistory.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.billItem.deleteMany({ where: { bill: { tenantId: { in: oldIds } } } });
      await prisma.bill.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.customer.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.product.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.user.deleteMany({ where: { tenantId: { in: oldIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: oldIds } } });
    }

    // Create 2 Isolated Tenants
    console.log('📌 Setup Tenant 1 and Tenant 2...');
    const tenant1 = await prisma.tenant.create({
      data: { businessName: 'Store Tenant 1', ownerName: 'Owner 1', mobileNumber: mobileT1, subscriptionStartDate: new Date(), subscriptionExpiryDate: new Date(Date.now() + 30*86400000) }
    });
    const user1 = await prisma.user.create({
      data: { name: 'Owner 1', mobileNumber: mobileT1, passwordHash: 'hash', role: 'TENANT_ADMIN', tenantId: tenant1.id }
    });

    const tenant2 = await prisma.tenant.create({
      data: { businessName: 'Store Tenant 2', ownerName: 'Owner 2', mobileNumber: mobileT2, subscriptionStartDate: new Date(), subscriptionExpiryDate: new Date(Date.now() + 30*86400000) }
    });

    // Ensure Categories exist
    let cat = await prisma.category.create({ data: { name: 'Electronics Test ' + Date.now() } });
    let subCat = await prisma.subCategory.create({ data: { categoryId: cat.id, name: 'Mobile Accessories Test ' + Date.now() } });

    // Tax setup
    const tax18 = await prisma.tax.create({
      data: { tenantId: tenant1.id, name: 'GST 18%', percentage: 18, type: 'PERCENTAGE' }
    });

    // TEST 1: Product Creation & Stock Alert
    console.log('\n--- TEST 1: PRODUCT CREATION & LOW STOCK ALERT ---');
    const prodA = await productService.createProduct(tenant1.id, user1.id, {
      name: 'USB-C Cable',
      sku: 'USBC-001',
      hsnCode: '84713010',
      purchasePrice: 80,
      sellingPrice: 150,
      openingStock: 50,
      minStockLevel: 10,
      categoryId: cat.id,
      subCategoryId: subCat.id,
      taxId: tax18.id
    });
    console.log('✅ Product A created with stock:', prodA.currentStock);

    // TEST 2: Supplier & Purchase Invoice (Stock Addition)
    console.log('\n--- TEST 2: SUPPLIER CREATION & PURCHASE INVOICE (STOCK INCREASE) ---');
    const supplier = await supplierService.createSupplier(tenant1.id, {
      name: 'Tech Distributors',
      companyName: 'Tech Dist Pvt Ltd',
      mobileNumber: supplierMobile,
      email: 'tech@supplier.com'
    });
    console.log('✅ Supplier created:', supplier.name);

    const purchaseInvoice = await purchaseService.createPurchaseInvoice(tenant1.id, user1.id, {
      supplierId: supplier.id,
      supplierInvoiceNumber: 'SUP-INV-101',
      paidAmount: 1000,
      paymentMethod: 'UPI',
      items: [
        { productId: prodA.id, quantity: 20, unitPurchasePrice: 80 }
      ]
    });
    console.log('✅ Purchase Invoice created:', {
      purchaseNumber: purchaseInvoice.purchaseNumber,
      totalAmount: purchaseInvoice.totalAmount,
      paidAmount: purchaseInvoice.paidAmount,
      dueAmount: purchaseInvoice.dueAmount,
      paymentStatus: purchaseInvoice.paymentStatus
    });

    // Verify Stock Increased to 50 + 20 = 70
    const updatedProdAfterPur = await prisma.product.findUnique({ where: { id: prodA.id } });
    console.log('✅ Updated Stock of Product A after purchase:', updatedProdAfterPur.currentStock);
    if (updatedProdAfterPur.currentStock !== 70) {
      throw new Error(`FAILED: Expected stock 70, got ${updatedProdAfterPur.currentStock}`);
    }

    // TEST 3: Supplier Payment Record
    console.log('\n--- TEST 3: SUPPLIER PAYMENT RECORD (CLEARING DUE) ---');
    const payRes = await supplierService.recordSupplierPayment(tenant1.id, user1.id, supplier.id, {
      amount: purchaseInvoice.dueAmount,
      paymentMethod: 'CASH',
      notes: 'Cleared remaining due'
    });
    console.log('✅ Supplier Payment recorded:', payRes.message);

    const checkSupplierAfterPay = await supplierService.getSupplierDetails(tenant1.id, supplier.id);
    console.log('✅ Supplier ledger after payment:', {
      totalPurchases: checkSupplierAfterPay.lifetimeStats.totalPurchases,
      totalPaid: checkSupplierAfterPay.lifetimeStats.totalPaid,
      outstandingDue: checkSupplierAfterPay.lifetimeStats.outstandingDue
    });
    if (checkSupplierAfterPay.lifetimeStats.outstandingDue !== 0) {
      throw new Error(`FAILED: Expected outstandingDue 0, got ${checkSupplierAfterPay.lifetimeStats.outstandingDue}`);
    }

    // TEST 4: Customer Billing & Inventory Deduction
    console.log('\n--- TEST 4: CUSTOMER BILL GENERATION (STOCK DEDUCTION & TAX MATH) ---');
    const bill = await billService.generateBill(tenant1.id, user1.id, {
      customerMobile,
      customerName: 'Amit Verma',
      discountType: 'FIXED',
      discountValue: 50,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      items: [
        { productId: prodA.id, quantity: 10, discountAmount: 0 }
      ]
    });
    console.log('✅ Bill generated:', {
      invoiceNumber: bill.invoiceNumber,
      subtotal: bill.subtotal,
      totalTaxAmount: bill.totalTaxAmount,
      discountAmount: bill.discountAmount,
      grandTotal: bill.grandTotal
    });

    // Check stock after sale: 70 - 10 = 60
    const updatedProdAfterBill = await prisma.product.findUnique({ where: { id: prodA.id } });
    console.log('✅ Updated Stock of Product A after sale:', updatedProdAfterBill.currentStock);
    if (updatedProdAfterBill.currentStock !== 60) {
      throw new Error(`FAILED: Expected stock 60, got ${updatedProdAfterBill.currentStock}`);
    }

    // TEST 5: Edge Case - Out of Stock Rejection
    console.log('\n--- TEST 5: EDGE CASE - OUT OF STOCK REJECTION ---');
    try {
      await billService.generateBill(tenant1.id, user1.id, {
        customerMobile,
        paymentStatus: 'PAID',
        items: [{ productId: prodA.id, quantity: 100 }]
      });
      throw new Error('FAILED: Over-stock sale should have thrown 400 Insufficient Stock Error');
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('Insufficient stock')) {
        console.log('✅ PASS: Over-stock request correctly blocked with 400 Insufficient Stock Error.');
      } else {
        throw err;
      }
    }

    // TEST 6: Edge Case - Multi-Tenant Data Isolation (Cross Tenant Access Rejection)
    console.log('\n--- TEST 6: EDGE CASE - MULTI-TENANT ISOLATION ---');
    try {
      // Tenant 2 trying to access Tenant 1's product
      await productService.getProductDetails(tenant2.id, prodA.id);
      throw new Error('FAILED: Tenant 2 accessed Tenant 1 product without error!');
    } catch (err) {
      if (err.statusCode === 404 && err.message.includes('Product not found')) {
        console.log('✅ PASS: Tenant 2 prevented from accessing Tenant 1 product (404 Not Found).');
      } else {
        throw err;
      }
    }

    try {
      // Tenant 2 trying to bill Tenant 1's product
      await billService.generateBill(tenant2.id, user1.id, {
        customerMobile,
        customerName: 'Tenant 2 Customer',
        items: [{ productId: prodA.id, quantity: 1 }]
      });
      throw new Error('FAILED: Tenant 2 billed Tenant 1 product without error!');
    } catch (err) {
      if (err.statusCode === 404 && err.message.includes('not found')) {
        console.log('✅ PASS: Tenant 2 prevented from billing Tenant 1 product (404 Not Found).');
      } else {
        throw err;
      }
    }

    // TEST 7: Bill Return (Partial Return & Stock Restoration)
    console.log('\n--- TEST 7: BILL PARTIAL RETURN & STOCK RESTORATION ---');
    const returnRes = await billService.processProductReturn(tenant1.id, user1.id, bill.id, [
      { productId: prodA.id, returnQuantity: 3, reason: 'Defective packaging' }
    ]);
    console.log('✅ Partial return processed:', {
      returnQuantity: 3,
      totalReturnAmount: returnRes.totalReturnAmount
    });

    // Stock should restore 60 + 3 = 63
    const prodAfterReturn = await prisma.product.findUnique({ where: { id: prodA.id } });
    console.log('✅ Stock after partial return:', prodAfterReturn.currentStock);
    if (prodAfterReturn.currentStock !== 63) {
      throw new Error(`FAILED: Expected stock 63 after return, got ${prodAfterReturn.currentStock}`);
    }

    // TEST 8: Soft Delete Safety for Products & Suppliers with History
    console.log('\n--- TEST 8: SOFT DELETE SAFETY FOR LINKED RECORDS ---');
    const deleteProdRes = await productService.deleteProduct(tenant1.id, prodA.id);
    console.log('✅ Product deletion status:', deleteProdRes.status);
    if (deleteProdRes.status !== 'SUSPENDED') {
      throw new Error('FAILED: Product with billing history should be SUSPENDED soft-deleted');
    }

    const deleteSupRes = await supplierService.deleteSupplier(tenant1.id, supplier.id);
    console.log('✅ Supplier deletion result:', deleteSupRes.message);
    if (!deleteSupRes.isSoftDeleted) {
      throw new Error('FAILED: Supplier with purchase history should be soft-deleted');
    }

    console.log('\n🎉 --- ALL COMPREHENSIVE DEEP EDGE-CASE TESTS PASSED 100% PERFECTLY ---');
  } catch (err) {
    console.error('❌ Edge case test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDeepEdgeCaseTests();
