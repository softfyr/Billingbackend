const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyVendorLogoutRevocation() {
  console.log('🧪 --- STARTING SERVER-SIDE TOKEN REVOCATION UPON LOGOUT TEST ---\n');

  try {
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    console.log(`1️⃣ Logging in Vendor with Mobile Number: ${testMobile}...`);

    // Send OTP
    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile })
    });
    const sendOtpData = await sendOtpRes.json();
    const otpCode = sendOtpData.data.otpCode || '123456';

    // Verify OTP
    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile, otpCode })
    });
    const verifyOtpData = await verifyOtpRes.json();
    const vendorToken = verifyOtpData.data.accessToken || verifyOtpData.data.token;
    console.log('   ✅ Vendor logged in successfully.');

    // 2. Test Before Logout Access
    console.log('\n2️⃣ Testing Access BEFORE Logout (GET /auth/me)...');
    const beforeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    console.log('   Before Logout Access Status:', beforeRes.status, `(Expected: 200 OK)`);

    // 3. Perform Logout
    console.log('\n3️⃣ Performing Vendor Logout (POST /auth/logout)...');
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    const logoutData = await logoutRes.json();
    console.log('   Logout Response Status:', logoutRes.status, `(Expected: 200 OK)`);
    console.log('   Logout Message:', logoutData.message);

    // 4. Test After Logout Access with the SAME Token
    console.log('\n4️⃣ Testing Access AFTER Logout using the SAME Token (GET /auth/me)...');
    const afterRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    const afterData = await afterRes.json();

    console.log('   After Logout Access Status:', afterRes.status, `(Expected: 401 Unauthorized)`);
    console.log('   Error Response Message:', afterData.message);

    if (afterRes.status === 401) {
      console.log('\n🎉 --- SERVER-SIDE TOKEN REVOCATION VERIFIED: LOGGED OUT TOKEN IS BLOCKED 100% PERFECTLY ---');
    } else {
      console.error('\n❌ FAILED: Logged out token was still able to access protected endpoints.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Token revocation test failed:', error);
    process.exit(1);
  }
}

verifyVendorLogoutRevocation();
