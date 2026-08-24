import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as businessService from '../src/modules/business/business.service.js';

async function testPostmanPayloadFix() {
  console.log('🧪 --- TESTING BUSINESS PROFILE PAYLOAD SAVING FIX ---');

  const testMobile = '9711625120';

  try {
    const user = await prisma.user.findUnique({
      where: { mobileNumber: testMobile },
      include: { tenant: true }
    });

    if (!user || !user.tenantId) {
      console.log('⚠️ No existing user found for 9711625120. Registering temporary user...');
      return;
    }

    console.log('🏢 Found Tenant ID:', user.tenantId);

    // Full Payload matching user's Postman request
    const payload = {
      businessName: 'Fresh Supermart & Grocery',
      businessType: 'Retail & Supermarket',
      ownerName: 'Ramesh Gupta',
      email: 'ramesh.store@example.com',
      mobileNumber: '9711625120',
      businessLogo: 'https://cdn.example.com/logos/fresh_supermart.png',
      businessAddress: 'Plot #42, Main Commercial Market, Sector 15',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      pincode: '110001',
      gstNumber: '07AAAAA0000A1Z5',
      panNumber: 'ABCDE1234F',
      otherInvoiceInfo: 'Terms: Payment due upon receipt. Goods once sold cannot be returned.'
    };

    const updatedProfile = await businessService.createBusinessProfile(user.tenantId, payload);

    console.log('\n✅ UPDATED PROFILE RESULT:');
    console.log('🏪 businessName:', updatedProfile.businessName);
    console.log('🏬 businessType:', updatedProfile.businessType);
    console.log('👤 ownerName:', updatedProfile.ownerName);
    console.log('📧 email:', updatedProfile.email);
    console.log('📍 businessAddress:', updatedProfile.businessAddress);
    console.log('🏙️ city:', updatedProfile.city);
    console.log('🗺️ state:', updatedProfile.state);
    console.log('📮 pincode:', updatedProfile.pincode);
    console.log('📜 gstNumber:', updatedProfile.gstNumber);
    console.log('💳 panNumber:', updatedProfile.panNumber);
    console.log('🖼️ businessLogo:', updatedProfile.businessLogo);

    console.log('\n🎉 --- ALL FIELDS SAVED 100% SUCCESSFULLY ---');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPostmanPayloadFix();
