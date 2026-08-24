import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as businessService from '../src/modules/business/business.service.js';

async function testBusinessProfileSetup() {
  console.log('🧪 --- TESTING BUSINESS PROFILE CREATION FLOW ---');

  const testMobile = '9876543300';
  const testEmail = 'profile_test_' + Date.now() + '@example.com';
  const testName = 'Ramesh Gupta';

  try {
    // 1. Cleanup
    await prisma.user.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });

    // 2. Vendor Registration & OTP Verification
    const regRes = await authService.requestVendorRegistration({
      name: testName,
      email: testEmail,
      mobileNumber: testMobile
    });
    const verifyRes = await authService.verifyOTPAndRegisterVendor({
      mobileNumber: testMobile,
      otpCode: regRes.otpCode
    });

    const tenantId = verifyRes.tenant.id;
    console.log('✅ Vendor Created with Initial Tenant ID:', tenantId);
    console.log('📌 Initial isProfileComplete Status:', verifyRes.tenant.isProfileComplete);

    // 3. Complete Business Profile Setup (matching UI fields)
    console.log('\n2️⃣ Submitting Business Profile Setup Form (POST /business/create-profile)...');
    const profileSetupPayload = {
      businessName: 'Fresh Supermart & Grocery',
      businessType: 'Retail & Supermarket',
      gstNumber: '07AAAAA0000A1Z5',
      panNumber: 'ABCDE1234F',
      businessAddress: 'Plot #42, Main Commercial Market, Sector 15',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      pincode: '110001',
      businessLogo: 'https://cdn.example.com/logos/fresh_supermart.png',
      ownerName: 'Ramesh Gupta',
      email: testEmail
    };

    const updatedProfile = await businessService.createBusinessProfile(tenantId, profileSetupPayload);

    console.log('✅ Business Profile Setup Complete!');
    console.log('🏪 Store Name:', updatedProfile.businessName);
    console.log('🏬 Business Type:', updatedProfile.businessType);
    console.log('📜 GST Number:', updatedProfile.gstNumber);
    console.log('💳 PAN Number:', updatedProfile.panNumber);
    console.log('📍 Address:', `${updatedProfile.businessAddress}, ${updatedProfile.city}, ${updatedProfile.state} - ${updatedProfile.pincode}`);
    console.log('🖼️ Business Logo:', updatedProfile.businessLogo);
    console.log('✨ isProfileComplete:', updatedProfile.isProfileComplete);

    console.log('\n🎉 --- BUSINESS PROFILE SETUP TEST PASSED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBusinessProfileSetup();
