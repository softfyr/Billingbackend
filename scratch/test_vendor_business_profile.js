const BASE_URL = 'http://localhost:5000/api/v1';

async function testVendorBusinessProfileAPI() {
  console.log('🧪 --- STARTING VENDOR CREATE BUSINESS PROFILE API VERIFICATION ---\n');

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

    // 1. Send OTP & Verify OTP for Vendor
    const mobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: mobile })
    });
    const sendOtpData = await sendOtpRes.json();

    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: mobile, otpCode: sendOtpData.data?.otpCode || '123456' })
    });
    const verifyOtpData = await verifyOtpRes.json();
    let vendorToken = verifyOtpData.data?.accessToken || verifyOtpData.data?.token;

    // 2. Assign Package if needed
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
    }

    assert(vendorToken, '1. AUTH -> Obtained Vendor Access Token for Store Profile setup.');

    const vendorHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vendorToken}`
    };

    // 3. Create Business Profile API Call (POST /api/v1/business/create-profile)
    const createProfileRes = await fetch(`${BASE_URL}/business/create-profile`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        businessName: `Jaipur Superstore ${timeId}`,
        businessType: 'Retail & Grocery Store',
        ownerName: 'Rajesh Sharma',
        mobileNumber: mobile,
        email: `store${timeId}@jaipursuper.com`,
        businessAddress: 'Plot 45, Tonk Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302018',
        gstNumber: '08AAAAA9999A1Z5',
        panNumber: 'AAAAA9999A',
        otherInvoiceInfo: 'Thank you for shopping with us!'
      })
    });
    const createProfileData = await createProfileRes.json();

    assert(
      createProfileRes.status === 201 &&
      createProfileData.data?.isProfileComplete === true &&
      createProfileData.data?.businessName?.includes('Jaipur Superstore'),
      '2. POST /api/v1/business/create-profile -> Created Business Store Profile and set isProfileComplete: true.'
    );

    // 4. Fetch Business Info API Call (GET /api/v1/business/info)
    const getInfoRes = await fetch(`${BASE_URL}/business/info`, { headers: vendorHeaders });
    const getInfoData = await getInfoRes.json();

    assert(
      getInfoRes.status === 200 &&
      getInfoData.data?.isProfileComplete === true &&
      getInfoData.data?.city === 'Jaipur',
      '3. GET /api/v1/business/info -> Verified stored Business Profile Info.'
    );

    console.log(`\n📊 VENDOR BUSINESS PROFILE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- BACKEND API FOR VENDOR CREATE BUSINESS PROFILE IS 100% OPERATIONAL & VERIFIED ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Vendor Business Profile Test Error:', error);
    process.exit(1);
  }
}

testVendorBusinessProfileAPI();
