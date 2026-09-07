import 'dotenv/config';
process.env.SMS_PROVIDER = 'CONSOLE';
import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const PORT = 5097;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function testOnboardingFlow() {
  console.log('🧪 --- STARTING VENDOR ONBOARDING FLOW TEST ---');
  let server;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, () => resolve(s));
    });

    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    // 1. Send OTP
    const sendRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile })
    });
    const sendData = await sendRes.json();
    const otpCode = sendData.data.otpCode || '123456';
    assert(sendRes.status === 200, 'OTP sent successfully.');

    // 2. Verify OTP -> Initial Vendor Onboarding
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile, otpCode })
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, 'OTP verified.');
    assert(verifyData.data.redirectUrl === '/create-business-profile/step-1', 'Initial redirect points to /create-business-profile/step-1.');
    assert(verifyData.data.hasSelectedPackage === false, 'hasSelectedPackage is false initially.');
    assert(verifyData.data.isProfileComplete === false, 'isProfileComplete is false initially.');
    assert(verifyData.data.tenant.businessName === null, 'Initial businessName is null until profile creation.');

    const token = verifyData.data.token || verifyData.data.accessToken;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // 3. Create Business Profile Step 1
    const step1Res = await fetch(`${BASE_URL}/business/create-profile/step-1`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessName: 'Rohan General Store',
        ownerName: 'Rohan Sharma',
        businessType: 'Retail'
      })
    });
    const step1Data = await step1Res.json();
    assert(step1Res.status === 201 || step1Res.status === 200, 'Profile Step 1 created.');
    assert(step1Data.data.redirectUrl === '/create-business-profile/step-2', 'Redirect updated to /create-business-profile/step-2.');

    // 4. Create Business Profile Step 2
    const step2Res = await fetch(`${BASE_URL}/business/create-profile/step-2`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessAddress: '45 MG Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        gstNumber: '08AAAAA0000A1Z5'
      })
    });
    const step2Data = await step2Res.json();
    assert(step2Res.status === 201 || step2Res.status === 200, 'Profile Step 2 created.');
    assert(step2Data.data.redirectUrl === '/choose-package', 'Redirect updated to /choose-package.');
    assert(step2Data.data.isProfileComplete === true, 'isProfileComplete is now true.');

    // 5. Package Selection
    const pkgsRes = await fetch(`${BASE_URL}/subscriptions/packages`, { headers });
    const pkgsData = await pkgsRes.json();
    const targetPkg = pkgsData.data[0];

    const chooseRes = await fetch(`${BASE_URL}/subscriptions/choose-package`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ packageId: targetPkg.id })
    });
    const chooseData = await chooseRes.json();
    assert(chooseRes.status === 200, 'Package selected.');
    assert(chooseData.data.redirectUrl === '/vendor/dashboard', 'Redirect updated to /vendor/dashboard.');
    assert(chooseData.data.hasSelectedPackage === true, 'hasSelectedPackage is now true.');

    // Cleanup
    await prisma.user.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: testMobile } });
    assert(true, 'Test records cleaned up.');

  } catch (err) {
    console.error('❌ Error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    console.log(`📊 RESULT: PASSED: ${passed} | FAILED: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

testOnboardingFlow();
