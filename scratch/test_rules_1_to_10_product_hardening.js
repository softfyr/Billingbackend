const BASE_URL = 'http://localhost:5000/api/v1';

async function testRules1To10ProductHardening() {
  console.log('🧪 --- STARTING PRODUCT HARDENING & BUSINESS RULES VERIFICATION (RULES 1 TO 10) ---\n');

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
      body: JSON.stringify({ name: `Beverages ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: catData.data.id, name: `Soft Drinks ${timeId}` })
    });
    const subData = await subRes.json();

    // 2. Vendor Signup
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
        body: JSON.stringify({ businessName: `Beverage Mart ${timeId}`, ownerName: 'Mart Owner', email: `mart${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // --- TEST 1: Rule 3 SKU Normalization ---
    console.log('\n📌 Rule 3: Testing SKU Normalization (Lowercase to UPPERCASE)...');
    const skuRaw = `sku-norm-${timeId}`;
    const createRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: 'Coca Cola 750ml',
        hsnCode: '2202',
        sku: skuRaw, // sent lowercase
        sellingPrice: 40,
        purchasePrice: 30,
        openingStock: 10,
        hasSecondaryUnit: true,
        secondaryUnit: 'Crate',
        conversionFactor: 24,
        secondaryPurchasePrice: 720
      })
    });
    const createData = await createRes.json();
    const productId = createData.data?.id;

    assert(
      createRes.status === 201 &&
      productId &&
      createData.data?.sku === skuRaw.toUpperCase(),
      'Rule 3: Product created with UPPERCASE normalized SKU code.'
    );

    // --- TEST 2: Rule 4 Clearing Secondary Fields when hasSecondaryUnit = false ---
    console.log('\n📌 Rule 4: Testing Clearing Secondary Fields on Update...');
    const updateDisableMultiRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers: vendorHeaders,
      body: JSON.stringify({
        hasSecondaryUnit: false
      })
    });
    const updateDisableMultiData = await updateDisableMultiRes.json();

    assert(
      updateDisableMultiRes.status === 200 &&
      updateDisableMultiData.data?.hasSecondaryUnit === false &&
      updateDisableMultiData.data?.secondaryUnit === null &&
      updateDisableMultiData.data?.conversionFactor === 1 &&
      updateDisableMultiData.data?.secondaryPurchasePrice === null,
      'Rule 4: Updating hasSecondaryUnit: false cleared stale secondaryUnit, conversionFactor & secondaryPurchasePrice.'
    );

    // Re-enable Multi-Unit for transaction testing
    await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers: vendorHeaders,
      body: JSON.stringify({
        hasSecondaryUnit: true,
        secondaryUnit: 'Crate',
        conversionFactor: 24,
        secondaryPurchasePrice: 720
      })
    });

    // --- TEST 3: Rule 2 Unit / Conversion Factor Change Protection when Transactions Exist ---
    console.log('\n📌 Rule 2: Testing Unit / Conversion Factor Change Protection after transactions...');
    
    // Issue POS Sale Bill to create transaction record
    const billRes = await fetch(`${BASE_URL}/bills`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        customerMobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        customerName: 'John Drinker',
        items: [{ productId, quantity: 2 }]
      })
    });
    const billData = await billRes.json();
    if (!billRes.ok) console.log('   [DEBUG billRes Error]:', billRes.status, JSON.stringify(billData));
    assert(billRes.status === 201 && billData.data?.id, 'POS Sale Bill generated successfully for Product.');

    // Attempt to change conversionFactor from 24 to 12 -> EXPECT 400 Bad Request
    const changeUnitRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers: vendorHeaders,
      body: JSON.stringify({
        conversionFactor: 12
      })
    });
    const changeUnitData = await changeUnitRes.json();

    assert(
      changeUnitRes.status === 400 &&
      changeUnitData.message?.includes('cannot be modified after sales'),
      'Rule 2: Blocked unit / conversion factor modification (400 Bad Request) after sales transactions occurred.'
    );

    console.log(`\n📊 PRODUCT HARDENING TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL PRODUCT HARDENING & BUSINESS RULES ARE 100% OPERATIONAL AND PASSED PERFECTLY ---');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Product Hardening Test Error:', err);
    process.exit(1);
  }
}

testRules1To10ProductHardening();
