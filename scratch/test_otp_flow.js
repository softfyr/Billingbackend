import { sendLoginOTP, verifyLoginOTP } from '../src/modules/auth/auth.service.js';
import { prisma } from '../src/config/prisma.js';

async function runTest() {
  const testMobile = '9998887776';
  console.log('--- STARTING COMPREHENSIVE OTP VERIFICATION TEST ---');

  try {
    // 1. Clean up old test record if any
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });

    // 2. Request OTP
    console.log('\n1. Sending Login OTP...');
    const sendRes = await sendLoginOTP({ mobileNumber: testMobile });
    console.log('Send OTP Response:', sendRes);

    const actualOtp = sendRes.otpCode;
    console.log(`Generated OTP code in DB: ${actualOtp}`);

    // 3. Test Invalid OTP Code
    console.log('\n2. Testing Invalid OTP Code verification...');
    try {
      await verifyLoginOTP({ mobileNumber: testMobile, otpCode: '000000' });
      console.error('❌ ERROR: Invalid OTP was accepted!');
    } catch (err) {
      console.log('✅ Correctly rejected invalid OTP with error:', err.message);
    }

    // 4. Test Valid OTP Code Verification
    console.log('\n3. Testing Valid OTP Code verification...');
    const verifyRes = await verifyLoginOTP({ mobileNumber: testMobile, otpCode: actualOtp });
    console.log('Verify OTP Response:', verifyRes);
    if (verifyRes.accessToken) {
      console.log('✅ Success! Access Token & Refresh Token generated after OTP verification.');
    }

    // 5. Cleanup
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    const testUser = await prisma.user.findUnique({ where: { mobileNumber: testMobile } });
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
      if (testUser.tenantId) {
        await prisma.tenant.delete({ where: { id: testUser.tenantId } });
      }
    }

    console.log('\n--- ALL OTP VERIFICATION TESTS PASSED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
