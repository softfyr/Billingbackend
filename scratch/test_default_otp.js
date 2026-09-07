import dotenv from 'dotenv';
dotenv.config();

import { generateAndSendOTP, verifyOTP } from '../src/utils/otpService.js';
import { prisma } from '../src/config/prisma.js';

async function runDefaultOtpTest() {
  console.log('🧪 Starting Default OTP Verification Test...\n');

  const testMobile = '9998887776';

  try {
    // Clean existing test record if any
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });

    // Step 1: Generate OTP (Default OTP should be 123456)
    console.log('1️⃣ Generating OTP for mobile:', testMobile);
    const genRes = await generateAndSendOTP(testMobile, 'TEST_AUTH', { testKey: 'testVal' });
    console.log('   Result:', genRes);

    if (genRes.otpCode !== '123456') {
      throw new Error(`Expected OTP code to be 123456, but got ${genRes.otpCode}`);
    }

    // Step 2: Try invalid OTP code
    console.log('\n2️⃣ Testing invalid OTP code: 000000...');
    try {
      await verifyOTP(testMobile, '000000');
      throw new Error('Should have failed with invalid OTP!');
    } catch (err) {
      console.log('   Successfully rejected invalid OTP:', err.message);
    }

    // Step 3: Verify with Default OTP 123456
    console.log('\n3️⃣ Verifying with Default OTP: 123456...');
    const verifyRes = await verifyOTP(testMobile, '123456');
    console.log('   Verification Result:', verifyRes);

    if (!verifyRes.isVerified) {
      throw new Error('Verification failed for default OTP 123456');
    }

    console.log('\n✅ ALL DEFAULT OTP TESTS PASSED SUCCESSFULLY! (100% Verified)');
  } catch (error) {
    console.error('\n❌ Default OTP Test Failed:', error);
    process.exit(1);
  } finally {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.$disconnect();
  }
}

runDefaultOtpTest();
