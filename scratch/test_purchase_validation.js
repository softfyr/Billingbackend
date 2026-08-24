const BASE_URL = 'http://localhost:5000/api/v1';

async function testPurchaseValidation() {
  console.log('🧪 --- STARTING PURCHASE MODULE VALIDATION TEST SUITE ---\n');

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

    // 1. Vendor OTP Sign-up
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
        body: JSON.stringify({ businessName: `Pur Validation Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 2. Test Block Missing Supplier ID
    const noSuppRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ items: [{ productId: 'some-id', quantity: 1, unitPurchasePrice: 100 }] })
    });
    assert(noSuppRes.status === 400, '1. VALIDATION -> Blocked Purchase Bill creation without supplierId with 400 Bad Request.');

    // 3. Test Block Empty Items Array
    const noItemsRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ supplierId: 'some-id', items: [] })
    });
    assert(noItemsRes.status === 400, '2. VALIDATION -> Blocked Purchase Bill creation with empty items array with 400 Bad Request.');

    // 4. Test Block Invalid Item Quantity (Zero/Negative)
    const invQtyRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ supplierId: 'some-id', items: [{ productId: 'some-id', quantity: 0, unitPurchasePrice: 100 }] })
    });
    assert(invQtyRes.status === 400, '3. VALIDATION -> Blocked Purchase line item with zero quantity with 400 Bad Request.');

    // 5. Setup Real Category, Supplier & Product for Valid Test
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;

    const catRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Pur Val Cat ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ categoryId: catData.data.id, name: `Pur Val SubCat ${timeId}` })
    });
    const subData = await subRes.json();

    const suppRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Val Supplier', mobileNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}` })
    });
    const suppData = await suppRes.json();
    const supplierId = suppData.data?.id;

    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ categoryId: catData.data.id, subCategoryId: subData.data.id, name: 'Val Item', sellingPrice: 500 })
    });
    const prodData = await prodRes.json();
    const productId = prodData.data?.id;

    // 6. Test Valid Purchase Bill Creation
    const validPurRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId,
        items: [{ productId, quantity: 5, unitPurchasePrice: 300 }],
        paidAmount: 1000,
        paymentMethod: 'CASH'
      })
    });
    const validPurData = await validPurRes.json();
    const purchaseId = validPurData.data?.id;

    assert(validPurRes.status === 201 && purchaseId, '4. VALIDATION -> Accepted valid Purchase Bill payload.');

    // 7. Test Block Invalid Payment Amount in Record Payment Modal (-100)
    const invPmtRes = await fetch(`${BASE_URL}/purchases/${purchaseId}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ amount: -100 })
    });
    assert(invPmtRes.status === 400, '5. VALIDATION -> Blocked negative payment amount (-100) in Record Payment Modal with 400 Bad Request.');

    console.log(`\n📊 PURCHASE VALIDATION TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL PURCHASE MODULE VALIDATIONS ARE 100% OPERATIONAL & VERIFIED ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Purchase Validation Test Error:', error);
    process.exit(1);
  }
}

testPurchaseValidation();
