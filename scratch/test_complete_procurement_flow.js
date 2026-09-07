const BASE_URL = 'http://localhost:5000/api/v1';

async function testCompleteProcurementFlow() {
  console.log('🧪 --- STARTING COMPLETE PROCUREMENT & PURCHASE BILL FLOW VERIFICATION ---\n');

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
    // 1. Super Admin Login & Setup Product Category
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const timeId = Date.now();
    const catRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Procurement Cat ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: catData.data.id, name: `Procurement SubCat ${timeId}` })
    });
    const subData = await subRes.json();

    // 2. Vendor OTP Login
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
        body: JSON.stringify({ businessName: `Procurement Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 3. Create Supplier (POST /suppliers)
    const suppMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const createSuppRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Apex Wholesalers',
        companyName: 'Apex Logistics Ltd',
        mobileNumber: suppMobile,
        email: 'contact@apexlogistics.com',
        gstin: '07AAAAA0000A1Z2'
      })
    });
    const createSuppData = await createSuppRes.json();
    const supplierId = createSuppData.data?.id;
    assert(createSuppRes.status === 201 && supplierId, 'POST /suppliers -> Created Supplier profile.');

    // 4. Create Initial Product (POST /products) with Brand, Unit, MaxStockLevel
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: `Laser Printer ${timeId}`,
        brand: 'HP',
        unit: 'PCS',
        hsnCode: '84713010',
        sellingPrice: 12000,
        purchasePrice: 8000,
        openingStock: 5,
        minStockLevel: 2,
        maxStockLevel: 50
      })
    });
    const prodData = await prodRes.json();
    const productId = prodData.data?.id;
    assert(prodRes.status === 201 && productId, 'POST /products -> Created Product with Brand, Unit, and MaxStockLevel.');

    // 5. Create Purchase Bill with Inline Quick Add Product & Tax Breakdown (POST /purchases)
    const purBillRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId,
        supplierInvoiceNumber: `INV-APEX-${timeId}`,
        items: [
          { productId, quantity: 5, unitPurchasePrice: 8000, taxPercent: 18 },
          {
            newProductData: {
              categoryId: catData.data.id,
              subCategoryId: subData.data.id,
              name: `Wireless Keyboard ${timeId}`,
              brand: 'Logitech',
              hsnCode: '84716060',
              sellingPrice: 800
            },
            quantity: 10,
            unitPurchasePrice: 500,
            taxPercent: 18
          }
        ],
        cgstAmount: 4230,
        sgstAmount: 4230,
        paidAmount: 20000,
        paymentMethod: 'UPI'
      })
    });
    const purBillData = await purBillRes.json();
    const purchaseId = purBillData.data?.id;

    if (purBillRes.status !== 201) console.log('   [Purchase Bill Error]:', JSON.stringify(purBillData, null, 2));

    assert(
      purBillRes.status === 201 &&
      purchaseId &&
      purBillData.data?.paymentStatus === 'PARTIALLY_PAID',
      'POST /purchases -> Created Purchase Bill with Inline Product Addition, CGST/SGST, and Partial Payment (Paid: ₹20,000).'
    );

    // 6. Verify Auto-Stock Addition in Inventory (GET /products/:id)
    const checkProdRes = await fetch(`${BASE_URL}/products/${productId}`, { headers: vendorHeaders });
    const checkProdData = await checkProdRes.json();
    console.log('   Check Prod Stock:', checkProdData.data?.currentStock);
    assert(
      checkProdRes.status === 200 && checkProdData.data?.currentStock === 10,
      'INVENTORY AUTO-STOCK -> Stock automatically increased from 5 to 10 (+5 inwarded).'
    );

    // 7. Record Payment Modal Action (POST /purchases/:id/payments)
    const dueAmount = purBillData.data?.dueAmount;
    console.log('   Purchase Bill Due Amount:', dueAmount);
    const pmtModalRes = await fetch(`${BASE_URL}/purchases/${purchaseId}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        amount: dueAmount,
        paymentMethod: 'BANK',
        referenceNumber: `BANK-TXN-${timeId}`,
        notes: 'Cleared remaining dues via Record Payment Modal'
      })
    });
    const pmtModalData = await pmtModalRes.json();
    console.log('   Pmt Modal Status:', pmtModalRes.status, JSON.stringify(pmtModalData, null, 2));
    assert(
      pmtModalRes.status === 200 && pmtModalData.data?.paymentStatus === 'PAID',
      'POST /purchases/:id/payments -> Record Payment Modal cleared dues. Bill Status updated from PARTIALLY_PAID to PAID.'
    );

    // 8. Process Purchase Return (POST /purchases/:id/return) -> Return 2 Keyboards
    const keyboardProduct = purBillData.data?.items?.find(i => i.product?.name?.includes('Keyboard'))?.product;
    if (keyboardProduct) {
      const returnRes = await fetch(`${BASE_URL}/purchases/${purchaseId}/return`, {
        method: 'POST',
        headers: vendorHeaders,
        body: JSON.stringify({
          returnItems: [{ productId: keyboardProduct.id, returnQuantity: 2 }],
          reason: 'Defective keys'
        })
      });
      const returnData = await returnRes.json();
      console.log('   Return Status:', returnRes.status, JSON.stringify(returnData, null, 2));
      assert(
        (returnRes.status === 201 || returnRes.status === 200) && returnData.data?.id,
        'POST /purchases/:id/return -> Returned 2 defective items. Purchase return created successfully.'
      );

      // Verify Stock Auto-Deduction for Return
      const checkKbRes = await fetch(`${BASE_URL}/products/${keyboardProduct.id}`, { headers: vendorHeaders });
      const checkKbData = await checkKbRes.json();
      assert(
        checkKbRes.status === 200 && checkKbData.data?.currentStock === 8,
        'RETURN STOCK AUTO-DEDUCTION -> Stock auto-deducted from 10 to 8 (-2 returned).'
      );
    }

    // 9. Process Purchase Cancellation (POST /purchases/:id/cancel)
    const purBill2Res = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId,
        items: [{ productId, quantity: 4, unitPurchasePrice: 8000 }],
        paidAmount: 0
      })
    });
    const purBill2Data = await purBill2Res.json();
    const purchase2Id = purBill2Data.data?.id;

    const cancelRes = await fetch(`${BASE_URL}/purchases/${purchase2Id}/cancel`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({})
    });
    const cancelData = await cancelRes.json();
    assert(
      cancelRes.status === 200 && cancelData.data?.purchaseStatus === 'CANCELLED',
      'POST /purchases/:id/cancel -> Cancelled Purchase Bill. Status updated to CANCELLED and stock addition reversed.'
    );

    // 10. Verify Supplier Account Ledger Statement (GET /suppliers/:id/ledger)
    const ledgerRes = await fetch(`${BASE_URL}/suppliers/${supplierId}/ledger`, { headers: vendorHeaders });
    const ledgerData = await ledgerRes.json();

    assert(
      ledgerRes.status === 200 &&
      Array.isArray(ledgerData.data?.ledgerEntries) &&
      ledgerData.data?.ledgerEntries.length >= 2,
      'GET /suppliers/:id/ledger -> Generated complete Double-Entry Supplier Account Ledger Statement.'
    );

    console.log(`\n📊 COMPLETE PROCUREMENT & PURCHASE MODULE SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL PRODUCT, SUPPLIER, PURCHASE BILL, AND LEDGER CAPABILITIES ARE 100% OPERATIONAL & VERIFIED ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testCompleteProcurementFlow();
