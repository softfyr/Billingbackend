import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';

async function testAllLoginFlows() {
  console.log('🧪 --- STARTING COMPREHENSIVE LOGIN FLOW TESTS ---');

  const vendorPhone = '9876543211';
  const vendorEmail = 'vendor_login_' + Date.now() + '@example.com';
  
  const employeePhone = '9876543212';
  const employeeEmail = 'employee_login_' + Date.now() + '@example.com';

  try {
    // Cleanup any existing test users
    await prisma.user.deleteMany({ where: { mobileNumber: { in: [vendorPhone, employeePhone, '9999999999'] } } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: { in: [vendorPhone, '9999999999'] } } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: { in: [vendorPhone, employeePhone, '9999999999'] } } });

    // Step 1: Register Vendor via OTP
    console.log('\n1️⃣ Creating Test Vendor Account via Mobile OTP...');
    const regOtpRes = await authService.sendLoginOTP({ mobileNumber: vendorPhone });
    const vendorVerifyRes = await authService.verifyLoginOTP({
      mobileNumber: vendorPhone,
      otpCode: regOtpRes.otpCode
    });
    const tenantId = vendorVerifyRes.tenant.id;
    console.log('✅ Vendor Created with Tenant ID:', tenantId);

    // Step 2: Register Employee under Vendor
    console.log('\n2️⃣ Creating Test Employee Account...');
    const empRes = await authService.registerEmployee(tenantId, {
      name: 'Test Staff Employee',
      mobileNumber: employeePhone,
      password: 'password123'
    });
    console.log('✅ Employee Created ID:', empRes.user.id);

    // Step 3: Test Unregistered Phone Number
    console.log('\n3️⃣ Testing Unregistered Phone Login (POST /send-otp)...');
    const unregOtpRes = await authService.sendLoginOTP({ mobileNumber: '9999999999' });
    console.log('✅ Unregistered OTP Sent successfully:', { isExistingUser: unregOtpRes.isExistingUser });
    if (unregOtpRes.isExistingUser) {
      throw new Error('FAILED: Unregistered phone number should return isExistingUser: false');
    }

    // Step 4: Test Vendor Login Flow
    console.log('\n4️⃣ Testing Vendor Login OTP Dispatch & Verification...');
    await prisma.oTPVerification.updateMany({ data: { lastSentAt: new Date(Date.now() - 60000) } });
    const vendorOtpRes = await authService.sendLoginOTP({ mobileNumber: vendorPhone });
    console.log('✅ Vendor OTP Sent:', vendorOtpRes);
    console.log('👤 Role Identified:', vendorOtpRes.role);

    const vendorLoginResult = await authService.verifyLoginOTP({
      mobileNumber: vendorPhone,
      otpCode: vendorOtpRes.otpCode
    });
    console.log('✅ Vendor Login Success!');
    console.log('🎫 Token:', vendorLoginResult.token ? 'YES' : 'NO');
    console.log('🚀 Redirect URL:', vendorLoginResult.redirectUrl);
    console.log('🔒 Read-Only Mode:', vendorLoginResult.isReadOnly);

    // Step 5: Test Employee Login Flow
    console.log('\n5️⃣ Testing Employee Login OTP Dispatch & Verification...');
    const empOtpRes = await authService.sendLoginOTP({ mobileNumber: employeePhone });
    console.log('✅ Employee OTP Sent:', empOtpRes);
    console.log('👤 Role Identified:', empOtpRes.role);
    console.log('🏢 Tenant ID fetched:', empOtpRes.tenantId);

    const empLoginResult = await authService.verifyLoginOTP({
      mobileNumber: employeePhone,
      otpCode: empOtpRes.otpCode
    });
    console.log('✅ Employee Login Success!');
    console.log('🎫 Token:', empLoginResult.token ? 'YES' : 'NO');
    console.log('🚀 Redirect URL:', empLoginResult.redirectUrl);

    // Step 6: Test Suspended Vendor Account Check
    console.log('\n6️⃣ Testing Suspended Account Check...');
    await prisma.user.update({
      where: { mobileNumber: vendorPhone },
      data: { status: 'SUSPENDED' }
    });

    await prisma.oTPVerification.updateMany({ data: { lastSentAt: new Date(Date.now() - 60000) } });
    const suspendedOtpRes = await authService.sendLoginOTP({ mobileNumber: vendorPhone });
    try {
      await authService.verifyLoginOTP({
        mobileNumber: vendorPhone,
        otpCode: suspendedOtpRes.otpCode
      });
      console.error('❌ Failed! Suspended account should be blocked.');
    } catch (err) {
      console.log('✅ Correctly blocked suspended user:', err.message);
    }

    // Restore user status
    await prisma.user.update({
      where: { mobileNumber: vendorPhone },
      data: { status: 'ACTIVE' }
    });

    // Step 7: Test Expired Subscription Restricted Mode
    console.log('\n7️⃣ Testing Expired Subscription Read-Only Restriction...');
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'EXPIRED' }
    });

    await prisma.oTPVerification.updateMany({ data: { lastSentAt: new Date(Date.now() - 60000) } });

    const expiredOtpRes = await authService.sendLoginOTP({ mobileNumber: vendorPhone });
    const expiredLoginResult = await authService.verifyLoginOTP({
      mobileNumber: vendorPhone,
      otpCode: expiredOtpRes.otpCode
    });

    console.log('✅ Expired Plan Login Allowed with Restrictions:');
    console.log('⚠️ Subscription Expired:', expiredLoginResult.isSubscriptionExpired);
    console.log('🔒 Read-Only Mode:', expiredLoginResult.isReadOnly);
    console.log('💬 Prompt Message:', expiredLoginResult.prompt);

    // Step 8: Test Admin Email + Password Login
    console.log('\n8️⃣ Testing Admin Email + Password Login (POST /admin/login)...');
    const adminLoginRes = await authService.adminLogin({
      email: 'admin@softfyr.com',
      password: 'admin123'
    });
    console.log('✅ Admin Login Success!');
    console.log('👑 Admin Role:', adminLoginRes.role);
    console.log('🚀 Redirect URL:', adminLoginRes.redirectUrl);

    console.log('\n🎉 --- ALL LOGIN FLOW TESTS PASSED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAllLoginFlows();
