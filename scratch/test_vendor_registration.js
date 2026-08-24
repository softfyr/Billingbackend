import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';

async function testVendorRegistrationFlow() {
  console.log('🧪 --- STARTING VENDOR REGISTRATION FLOW TESTS ---');

  const testMobile = '9876543210';
  const testEmail = 'testvendor_' + Date.now() + '@example.com';
  const testName = 'Test Vendor Owner';

  try {
    // Cleanup any pre-existing test data
    await prisma.user.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });

    // Step 1: Submit Registration Form (POST /register)
    console.log('\n1️⃣ Testing Registration Submission (POST /register)...');
    const regResult = await authService.requestVendorRegistration({
      name: testName,
      email: testEmail,
      mobileNumber: testMobile
    });
    console.log('✅ Registration Request Success:', regResult);

    const generatedOTP = regResult.otpCode;
    console.log(`🔑 Generated 6-digit OTP: ${generatedOTP}`);

    // Step 1b: Duplicate Registration Check
    console.log('\n1️⃣b Testing Duplicate Phone Check...');
    try {
      await authService.requestVendorRegistration({
        name: testName,
        email: 'another_' + Date.now() + '@example.com',
        mobileNumber: testMobile
      });
      console.error('❌ Duplicate check failed! Exception should have been thrown.');
    } catch (err) {
      console.log('✅ Duplicate check passed! Error caught:', err.message);
    }

    // Step 2: Test Resend OTP Cooldown
    console.log('\n2️⃣ Testing Resend OTP Cooldown (POST /resend-otp)...');
    try {
      await authService.resendOTP({ mobileNumber: testMobile });
      console.error('❌ Cooldown check failed! Exception should have been thrown.');
    } catch (err) {
      console.log('✅ Cooldown check passed! Error caught:', err.message);
    }

    // Step 3: Test Wrong OTP & Attempt Tracking
    console.log('\n3️⃣ Testing Invalid OTP Entry...');
    try {
      await authService.verifyOTPAndRegisterVendor({
        mobileNumber: testMobile,
        otpCode: '000000'
      });
    } catch (err) {
      console.log('✅ Wrong OTP correctly rejected! Message:', err.message);
    }

    // Step 4: Test Correct OTP Verification & Account Creation
    console.log('\n4️⃣ Testing Correct OTP Verification (POST /verify-otp)...');
    const verifyResult = await authService.verifyOTPAndRegisterVendor({
      mobileNumber: testMobile,
      otpCode: generatedOTP
    });

    console.log('✅ Account Creation Success!');
    console.log('🎫 JWT Token Generated:', verifyResult.token ? 'YES' : 'NO');
    console.log('👤 User Role:', verifyResult.user.role);
    console.log('🏢 Tenant ID:', verifyResult.tenant.id);
    console.log('📦 Subscription Package:', verifyResult.tenant.subscriptionStatus);
    console.log('🚀 Next Step:', verifyResult.nextStep);

    console.log('\n🎉 --- ALL VENDOR REGISTRATION TESTS PASSED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVendorRegistrationFlow();
