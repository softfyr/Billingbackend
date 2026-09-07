import { prisma } from '../src/config/prisma.js';
import { createPurchaseInvoice, updatePurchaseInvoice, confirmPurchaseInvoice } from '../src/modules/purchase/purchase.service.js';

async function testDraftToConfirmFlow() {
  console.log('🧪 --- TESTING DRAFT PURCHASE INVOICE EDIT & CONFIRMATION FLOW ---\n');

  try {
    let tenant = await prisma.tenant.findFirst();
    let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    let supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id } });
    let category = await prisma.category.findFirst();
    let subCategory = await prisma.subCategory.findFirst({ where: { categoryId: category.id } });

    // Create a Test Product
    const testProduct = await prisma.product.create({
      data: {
        tenantId: tenant.id, categoryId: category.id, subCategoryId: subCategory.id,
        name: 'Draft Flow Test Item', sku: `SKU-DFT-${Date.now()}`,
        sellingPrice: 500, purchasePrice: 300, currentStock: 10
      }
    });

    console.log(`1️⃣ Product Created: Initial Stock = ${testProduct.currentStock}`);

    // Step A: Save Purchase Invoice as DRAFT
    console.log('\n2️⃣ Creating Purchase Invoice as DRAFT...');
    const draftInvoice = await createPurchaseInvoice(tenant.id, user.id, {
      supplierId: supplier.id,
      purchaseStatus: 'DRAFT',
      items: [{ productId: testProduct.id, quantity: 15, unitPurchasePrice: 300 }]
    });

    console.log(`   - Draft Invoice Created: ID ${draftInvoice.id}`);
    console.log(`   - Status: ${draftInvoice.purchaseStatus}`);

    const prodAfterDraft = await prisma.product.findUnique({ where: { id: testProduct.id } });
    console.log(`   - Stock after Draft creation: ${prodAfterDraft.currentStock} (Expected: 10 - Unchanged)`);

    if (draftInvoice.purchaseStatus !== 'DRAFT' || prodAfterDraft.currentStock !== 10) {
      throw new Error('Draft creation failed to keep status as DRAFT or altered stock prematurely!');
    }

    // Step B: Edit Draft Invoice & Continue/Confirm (purchaseStatus: 'CONFIRMED')
    console.log('\n3️⃣ Editing Draft Invoice & clicking Continue/Confirm...');
    const confirmedInvoice = await updatePurchaseInvoice(tenant.id, user.id, draftInvoice.id, {
      purchaseStatus: 'CONFIRMED',
      items: [{ productId: testProduct.id, quantity: 20, unitPurchasePrice: 300 }]
    });

    console.log(`   - Updated Invoice Status: ${confirmedInvoice.purchaseStatus}`);
    
    const prodAfterConfirm = await prisma.product.findUnique({ where: { id: testProduct.id } });
    console.log(`   - Stock after Confirmation: ${prodAfterConfirm.currentStock} (Expected: 10 + 20 = 30)`);

    if (confirmedInvoice.purchaseStatus !== 'CONFIRMED' || prodAfterConfirm.currentStock !== 30) {
      throw new Error(`Draft confirmation failed! Status: ${confirmedInvoice.purchaseStatus}, Stock: ${prodAfterConfirm.currentStock}`);
    }

    console.log('\n   ✅ DRAFT TO CONFIRMED TRANSITION VERIFIED SUCCESSFUL!');

    // Step C: Test updating draft with explicit saveAsDraft: true
    console.log('\n4️⃣ Creating another Draft Invoice...');
    const draft2 = await createPurchaseInvoice(tenant.id, user.id, {
      supplierId: supplier.id,
      purchaseStatus: 'DRAFT',
      items: [{ productId: testProduct.id, quantity: 5, unitPurchasePrice: 300 }]
    });

    console.log('   Updating Draft Invoice with saveAsDraft: true...');
    const updatedDraft2 = await updatePurchaseInvoice(tenant.id, user.id, draft2.id, {
      saveAsDraft: true,
      notes: 'Updated draft notes'
    });

    console.log(`   - Status: ${updatedDraft2.purchaseStatus} (Expected: DRAFT)`);

    if (updatedDraft2.purchaseStatus !== 'DRAFT') {
      throw new Error('Explicit saveAsDraft: true failed to maintain DRAFT status!');
    }

    console.log('   ✅ EXPLICIT SAVE AS DRAFT VERIFIED SUCCESSFUL!');

    // Step D: Confirming via POST /purchases/:id/confirm endpoint function
    console.log('\n5️⃣ Confirming second draft via confirmPurchaseInvoice service function...');
    const confirmed2 = await confirmPurchaseInvoice(tenant.id, user.id, draft2.id);
    console.log(`   - Status: ${confirmed2.purchaseStatus} (Expected: CONFIRMED)`);

    if (confirmed2.purchaseStatus !== 'CONFIRMED') {
      throw new Error('confirmPurchaseInvoice failed!');
    }

    console.log('\n🎉 --- ALL DRAFT CONFIRMATION & EDIT TESTS PASSED 100% PERFECTLY! ---');
  } catch (err) {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDraftToConfirmFlow();
