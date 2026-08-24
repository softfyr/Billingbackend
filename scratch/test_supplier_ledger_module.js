const BASE_URL = 'http://localhost:5000/api/v1';

async function testSupplierLedgerModule() {
  console.log('🧪 --- STARTING ADVANCED SUPPLIER & LEDGER MODULE VERIFICATION ---\n');

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
      body: JSON.stringify({ name: `Category ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: catData.data.id, name: `SubCat ${timeId}` })
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
        body: JSON.stringify({ businessName: `Supplier Test Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 3. Add Product
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: `Wholesale Item ${timeId}`,
        sellingPrice: 500,
        purchasePrice: 350,
        openingStock: 10
      })
    });
    const prodData = await prodRes.json();
    const productId = prodData.data?.id;

    // 4. Create Supplier (POST /suppliers)
    const suppMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const createSuppRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Sharma Distributors',
        companyName: 'Sharma & Sons Pvt Ltd',
        mobileNumber: suppMobile,
        email: 'sharma@distributors.com',
        gstin: '08AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
        address: 'Plot 45, Transport Nagar',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302003'
      })
    });
    const createSuppData = await createSuppRes.json();
    console.log('   Create Supp Status:', createSuppRes.status);
    console.log('   Create Supp Response:', JSON.stringify(createSuppData, null, 2));
    const supplierId = createSuppData.data?.id;

    assert(createSuppRes.status === 201 && supplierId, 'POST /suppliers -> Created Supplier profile with GSTIN & PAN.');

    // 5. Create Purchase Invoice 1 (Total ₹35,000, Paid ₹10,000, Due ₹25,000)
    const pur1Res = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId,
        items: [{ productId, quantity: 100, unitPurchasePrice: 350 }],
        paidAmount: 10000
      })
    });
    const pur1Data = await pur1Res.json();
    if (pur1Res.status !== 201) console.log('   [Purchase Error]:', JSON.stringify(pur1Data, null, 2));
    assert(pur1Res.status === 201, 'POST /purchases -> Created Purchase Invoice 1 (₹35,000 total, ₹10,000 paid).');

    // 6. Record Standalone Supplier Payment (POST /suppliers/:id/payments) -> Paid ₹15,000 via UPI
    const pmtRes = await fetch(`${BASE_URL}/suppliers/${supplierId}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        amount: 15000,
        paymentMethod: 'UPI',
        referenceNumber: `UPI-TXN-${timeId}`,
        notes: 'Partial payment towards outstanding dues'
      })
    });
    const pmtData = await pmtRes.json();
    assert(pmtRes.status === 201 && pmtData.data?.id, 'POST /suppliers/:id/payments -> Recorded standalone Supplier Payment of ₹15,000.');

    // 7. Get Supplier Details (GET /suppliers/:id)
    const detailsRes = await fetch(`${BASE_URL}/suppliers/${supplierId}`, { headers: vendorHeaders });
    const detailsData = await detailsRes.json();
    const finSummary = detailsData.data?.financialSummary;

    assert(
      detailsRes.status === 200 &&
      finSummary?.totalPurchases === 35000 &&
      finSummary?.totalPaid === 25000 &&
      finSummary?.totalOutstanding === 10000,
      `GET /suppliers/:id -> Fetched Deep Details & Financial Summary (Purchases: ₹35,000, Paid: ₹25,000, Outstanding: ₹10,000).`
    );

    // 8. Get Supplier Ledger (GET /suppliers/:id/ledger)
    const ledgerRes = await fetch(`${BASE_URL}/suppliers/${supplierId}/ledger`, { headers: vendorHeaders });
    const ledgerData = await ledgerRes.json();
    const ledgerEntries = ledgerData.data?.ledgerEntries;

    assert(
      ledgerRes.status === 200 &&
      Array.isArray(ledgerEntries) &&
      ledgerEntries.length === 2 &&
      ledgerEntries[1].runningBalance === 10000,
      `GET /suppliers/:id/ledger -> Generated Account Ledger Statement with accurate Running Balance (₹10,000).`
    );

    // 9. Get Supplier Listing with Filters & Search (GET /suppliers?search=Sharma)
    const listRes = await fetch(`${BASE_URL}/suppliers?search=Sharma`, { headers: vendorHeaders });
    const listData = await listRes.json();
    const listedSupplier = listData.data?.find(s => s.id === supplierId);

    assert(
      listRes.status === 200 &&
      listedSupplier &&
      listedSupplier.totalPayable === 10000 &&
      listedSupplier.lastPurchaseDate !== null,
      `GET /suppliers -> Listed Supplier with calculated totalPayable, totalPaid, and lastPurchaseDate.`
    );

    console.log(`\n📊 SUPPLIER & LEDGER MODULE SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL SUPPLIER & LEDGER MODULE CAPABILITIES ARE 100% OPERATIONAL & VERIFIED ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testSupplierLedgerModule();
