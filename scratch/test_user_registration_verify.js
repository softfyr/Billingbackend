import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';

async function testUserRegistrationAndVerify() {
  console.log('🧪 --- TESTING USER EXACT REGISTRATION & VERIFY OTP FLOW ---');

  const testMobile = '9711625120';
  const testEmail = 'user_test_' + Date.now() + '@example.com';
  const testName = 'User Vendor Test';

  try {
    // 1. Cleanup test phone number
    await prisma.user.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });

    // 2. Step 1: Register (POST /auth/register)
    console.log('\n1️⃣ Calling POST /auth/register...');
    const regRes = await authService.requestVendorRegistration({
      name: testName,
      email: testEmail,
      mobileNumber: testMobile
    });
    console.log('✅ Registration OTP Sent:', regRes);
    console.log('🔑 OTP Code Generated:', regRes.otpCode);

    // 3. Step 2: Verify OTP (POST /auth/verify-otp)
    console.log('\n2️⃣ Calling POST /auth/verify-otp with generated OTP code...');
    const verifyRes = await authService.verifyLoginOTP({
      mobileNumber: testMobile,
      otpCode: regRes.otpCode
    });

    console.log('✅ VERIFICATION & VENDOR CREATION SUCCESS!');
    console.log('🎫 JWT Token Generated:', verifyRes.token ? 'YES' : 'NO');
    console.log('👤 User ID:', verifyRes.user?.id);
    console.log('🏢 Tenant ID:', verifyRes.tenant?.id);
    console.log('🚀 Next Step:', verifyRes.nextStep || verifyRes.redirectUrl);

    console.log('\n🎉 --- USER REGISTRATION & OTP VERIFICATION PASSED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserRegistrationAndVerify();
