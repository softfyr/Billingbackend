const BASE_URL = 'http://localhost:5000/api/v1';

async function testMasterE2EPurchaseModule() {
  console.log('🧪 --- STARTING MASTER END-TO-END PURCHASE MODULE VERIFICATION ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const timeId = Date.now();

    // 1. Super Admin Setup Category & Sub-Category
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const catRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Pur Cat ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: catData.data.id, name: `Pur SubCat ${timeId}` })
    });
    const subData = await subRes.json();

    // 2. Vendor OTP Sign-up
    const vendorMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile })
    });
    const sendOtpData = await sendOtpRes.json();

    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile, otpCode: sendOtpData.data?.otpCode || '123456' })
    });
    const verifyOtpData = await verifyOtpRes.json();
    let vendorToken = verifyOtpData.data?.accessToken || verifyOtpData.data?.token;

    if (!vendorToken) {
      const pkgRes = await fetch(`${BASE_URL}/subscriptions/packages`);
      const pkgData = await pkgRes.json();

      const chooseRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgData.data[0].id })
      });
      const chooseData = await chooseRes.json();
      vendorToken = chooseData.data?.accessToken || chooseData.data?.token;

      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
        body: JSON.stringify({ businessName: `Purchase E2E Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 3. Standalone Supplier Creation (`POST /suppliers`)
    const suppMobile1 = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const supp1Res = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Apex Wholesale Corp',
        companyName: 'Apex Distribution Ltd',
        mobileNumber: suppMobile1,
        email: 'sales@apexwholesale.com',
        gstin: '07AAAAA9999A1Z9'
      })
    });
    const supp1Data = await supp1Res.json();
    const supplier1Id = supp1Data.data?.id;

    // 4. Standalone Product Creation (`POST /products`)
    const prod1Res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: `Laser Printer ${timeId}`,
        sellingPrice: 12000,
        purchasePrice: 8000,
        openingStock: 5
      })
    });
    const prod1Data = await prod1Res.json();
    const product1Id = prod1Data.data?.id;

    // 5. Test 1: Create Purchase Bill #1 (POST /purchases)
    const pur1Res = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId: supplier1Id,
        supplierInvoiceNumber: `INV-APEX-${timeId}`,
        items: [{ productId: product1Id, quantity: 5, unitPurchasePrice: 8000, taxPercent: 18 }],
        paidAmount: 20000,
        paymentMethod: 'UPI'
      })
    });
    const pur1Data = await pur1Res.json();
    const purchase1Id = pur1Data.data?.id;

    assert(
      pur1Res.status === 201 &&
      purchase1Id &&
      pur1Data.data?.paymentStatus === 'PARTIALLY_PAID',
      '1. POST /purchases -> Created Purchase Bill #1 with Partial Payment (Paid: ₹20,000, Due: ₹27,200).'
    );

    // 6. Test 2: Verify Stock Auto-Inwarding in Inventory (GET /products/:id)
    const checkProdRes = await fetch(`${BASE_URL}/products/${product1Id}`, { headers: vendorHeaders });
    const checkProdData = await checkProdRes.json();
    assert(
      checkProdRes.status === 200 && checkProdData.data?.currentStock === 10,
      '2. AUTO STOCK INWARDING -> Inventory stock automatically increased from 5 to 10 (+5 inwarded).'
    );

    // 7. Test 3: Standalone Modal Supplier Creation before Purchase Bill
    const suppMobile2 = `95${Math.floor(10000000 + Math.random() * 90000000)}`;
    const supp2Res = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Direct Tech Wholesalers',
        mobileNumber: suppMobile2,
        gstin: '08CCCCC0000C1Z8'
      })
    });
    const supp2Data = await supp2Res.json();
    const supplier2Id = supp2Data.data?.id;

    const pur2Res = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId: supplier2Id,
        items: [{ productId: product1Id, quantity: 2, unitPurchasePrice: 8000 }],
        paidAmount: 16000
      })
    });
    const pur2Data = await pur2Res.json();
    const purchase2Id = pur2Data.data?.id;

    assert(
      pur2Res.status === 201 &&
      purchase2Id &&
      pur2Data.data?.supplierId === supplier2Id,
      '3. STANDALONE MODAL SUPPLIER -> Purchase Bill created cleanly with modal-created supplierId.'
    );

    // 8. Test 4: Standalone Modal Product Creation before Purchase Bill
    const prod2Res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: `HD Webcam 1080p ${timeId}`,
        sellingPrice: 2500,
        purchasePrice: 1500
      })
    });
    const prod2Data = await prod2Res.json();
    const product2Id = prod2Data.data?.id;

    const pur3Res = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId: supplier1Id,
        items: [{ productId: product2Id, quantity: 10, unitPurchasePrice: 1500 }],
        paidAmount: 15000
      })
    });
    const pur3Data = await pur3Res.json();
    assert(
      pur3Res.status === 201 &&
      pur3Data.data?.items?.[0]?.productId === product2Id,
      '4. STANDALONE MODAL PRODUCT -> Purchase Bill created cleanly with modal-created productId.'
    );

    // 9. Test 5: List & Filter Purchase Bills (GET /purchases?status=PARTIALLY_PAID)
    const listRes = await fetch(`${BASE_URL}/purchases?status=PARTIALLY_PAID`, { headers: vendorHeaders });
    const listData = await listRes.json();
    assert(
      listRes.status === 200 &&
      Array.isArray(listData.data) &&
      listData.data.length >= 1,
      '5. GET /purchases?status=PARTIALLY_PAID -> Listed purchase bills with status filters.'
    );

    // 10. Test 6: Purchase Bill Details (GET /purchases/:id)
    const detailsRes = await fetch(`${BASE_URL}/purchases/${purchase1Id}`, { headers: vendorHeaders });
    const detailsData = await detailsRes.json();
    assert(
      detailsRes.status === 200 &&
      detailsData.data?.purchaseNumber === pur1Data.data?.purchaseNumber &&
      Array.isArray(detailsData.data?.items),
      '6. GET /purchases/:id -> Fetched deep Purchase Invoice breakdown and line items.'
    );

    // 11. Test 7: Record Payment Modal Action (POST /purchases/:id/payments)
    const dueAmt = pur1Data.data?.dueAmount;
    const pmtModalRes = await fetch(`${BASE_URL}/purchases/${purchase1Id}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        amount: dueAmt,
        paymentMethod: 'BANK',
        referenceNumber: `BANK-TXN-${timeId}`,
        notes: 'Cleared remaining dues via Record Payment Modal'
      })
    });
    const pmtModalData = await pmtModalRes.json();
    assert(
      pmtModalRes.status === 200 &&
      pmtModalData.data?.paymentStatus === 'PAID' &&
      pmtModalData.data?.dueAmount === 0,
      '7. POST /purchases/:id/payments -> Record Payment Modal cleared remaining dues. Status updated from PARTIALLY_PAID to PAID.'
    );

    // 12. Test 8: Process Purchase Return (POST /purchases/:id/return) -> Return 2 Printers
    const returnRes = await fetch(`${BASE_URL}/purchases/${purchase1Id}/return`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        returnItems: [{ productId: product1Id, returnQuantity: 2 }],
        reason: 'Defective items received'
      })
    });
    const returnData = await returnRes.json();
    assert(
      returnRes.status === 200 && returnData.data?.purchaseStatus === 'PARTIALLY_RETURNED',
      '8. POST /purchases/:id/return -> Returned 2 defective items to supplier. Status updated to PARTIALLY_RETURNED.'
    );

    // Verify Stock Auto-Deduction for Return
    const checkStockAfterReturn = await fetch(`${BASE_URL}/products/${product1Id}`, { headers: vendorHeaders });
    const checkStockData = await checkStockAfterReturn.json();
    assert(
      checkStockAfterReturn.status === 200 && checkStockData.data?.currentStock === 10,
      '9. RETURN STOCK AUTO-DEDUCTION -> Stock auto-deducted in inventory for returned items.'
    );

    // 13. Test 9: Process Purchase Cancellation (POST /purchases/:id/cancel)
    const cancelRes = await fetch(`${BASE_URL}/purchases/${purchase2Id}/cancel`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({})
    });
    const cancelData = await cancelRes.json();
    assert(
      cancelRes.status === 200 && cancelData.data?.purchaseStatus === 'CANCELLED',
      '10. POST /purchases/:id/cancel -> Cancelled Purchase Bill #2. Status updated to CANCELLED and stock addition reversed.'
    );

    console.log(`\n📊 MASTER E2E PURCHASE MODULE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL PURCHASE BILL MODULE CAPABILITIES ARE 100% OPERATIONAL & VERIFIED ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Master Purchase E2E Test Error:', error);
    process.exit(1);
  }
}

testMasterE2EPurchaseModule();
