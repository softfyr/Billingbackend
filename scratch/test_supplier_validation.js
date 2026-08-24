const BASE_URL = 'http://localhost:5000/api/v1';

async function testSupplierValidation() {
  console.log('🧪 --- STARTING SUPPLIER MODULE VALIDATION TEST SUITE ---\n');

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
        body: JSON.stringify({ businessName: `Validation Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 2. Test Invalid Mobile Number
    const invMobileRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Test Supplier', mobileNumber: '12345' })
    });
    assert(invMobileRes.status === 400, '1. VALIDATION -> Blocked invalid mobile number (12345) with 400 Bad Request.');

    // 3. Test Invalid GSTIN Format
    const invGstinRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Test Supplier', mobileNumber: '9812345678', gstin: 'INVALID-GSTIN' })
    });
    assert(invGstinRes.status === 400, '2. VALIDATION -> Blocked invalid GSTIN format with 400 Bad Request.');

    // 4. Test Invalid PAN Format
    const invPanRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Test Supplier', mobileNumber: '9812345678', pan: 'INVALID-PAN' })
    });
    assert(invPanRes.status === 400, '3. VALIDATION -> Blocked invalid PAN format with 400 Bad Request.');

    // 5. Test Valid Supplier Creation
    const validMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const validSuppRes = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Valid Electronics',
        companyName: 'Valid Distributions',
        mobileNumber: validMobile,
        email: 'info@validelectronics.com',
        gstin: '08AAAAA0000A1Z5',
        pan: 'AAAAA0000A'
      })
    });
    const validSuppData = await validSuppRes.json();
    const supplierId = validSuppData.data?.id;

    assert(validSuppRes.status === 201 && supplierId, '4. VALIDATION -> Accepted valid Supplier registration payload.');

    // 6. Test Invalid Payment Amount (Negative or Zero)
    const invPmtRes = await fetch(`${BASE_URL}/suppliers/${supplierId}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ amount: -500 })
    });
    assert(invPmtRes.status === 400, '5. VALIDATION -> Blocked negative payment amount (-500) with 400 Bad Request.');

    console.log(`\n📊 SUPPLIER VALIDATION TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL SUPPLIER MODULE VALIDATIONS ARE 100% OPERATIONAL & VERIFIED ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation Test Error:', error);
    process.exit(1);
  }
}

testSupplierValidation();
