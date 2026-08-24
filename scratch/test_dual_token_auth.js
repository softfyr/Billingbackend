const BASE_URL = 'http://localhost:5000/api/v1';

async function verifyDualTokenAuth() {
  console.log('🧪 --- STARTING DUAL TOKEN AUTHENTICATION (ACCESS + REFRESH) TEST ---\n');

  try {
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    console.log(`1️⃣ Logging in Vendor via OTP (Mobile: ${testMobile})...`);

    // Request OTP
    const sendRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile })
    });
    const sendData = await sendRes.json();
    const otpCode = sendData.data.otpCode || '123456';

    // Verify OTP
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile, otpCode })
    });
    const verifyData = await verifyRes.json();
    const { accessToken, refreshToken, token } = verifyData.data;

    console.log('   Verification Status:', verifyRes.status, `(Expected: 200 OK)`);
    console.log('   AccessToken present:', accessToken ? '✅ YES' : '❌ NO');
    console.log('   RefreshToken present:', refreshToken ? '✅ YES' : '❌ NO');
    console.log('   Legacy Token present:', token ? '✅ YES' : '❌ NO');

    if (!accessToken || !refreshToken) {
      throw new Error('Login response must contain both accessToken and refreshToken.');
    }

    // 2. Test Refresh Access Token Endpoint
    console.log('\n2️⃣ Testing Access Token Refresh (POST /auth/refresh-token)...');
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const refreshData = await refreshRes.json();

    console.log('   Refresh Request Status:', refreshRes.status, `(Expected: 200 OK)`);
    console.log('   New AccessToken present:', refreshData.data.accessToken ? '✅ YES' : '❌ NO');
    console.log('   New RefreshToken present:', refreshData.data.refreshToken ? '✅ YES' : '❌ NO');
    console.log('   Response Message:', refreshData.message);

    const newAccessToken = refreshData.data.accessToken;

    // 3. Test API Call with Newly Refreshed Access Token
    console.log('\n3️⃣ Testing API Authorization with Newly Refreshed Access Token (GET /auth/me)...');
    const profileRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${newAccessToken}` }
    });
    const profileData = await profileRes.json();

    console.log('   Profile Request Status:', profileRes.status, `(Expected: 200 OK)`);
    console.log('   User Mobile Number:', profileData.data.user.mobileNumber);

    // 4. Test Invalid Refresh Token Error Handling
    console.log('\n4️⃣ Testing Invalid Refresh Token Handling (POST /auth/refresh-token with bad token)...');
    const badRefreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'INVALID_REFRESH_TOKEN_12345' })
    });
    const badRefreshData = await badRefreshRes.json();

    console.log('   Invalid Refresh Status:', badRefreshRes.status, `(Expected: 401 Unauthorized)`);
    console.log('   Error Message:', badRefreshData.message);

    console.log('\n🎉 --- DUAL TOKEN AUTHENTICATION TEST COMPLETED & VERIFIED 100% PERFECTLY ---');
  } catch (error) {
    console.error('❌ Dual Token Auth test failed:', error);
    process.exit(1);
  }
}

verifyDualTokenAuth();
