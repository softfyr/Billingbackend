import { prisma } from '../src/config/prisma.js';
import * as businessService from '../src/modules/business/business.service.js';

async function testMobileLocking() {
  console.log('🧪 Testing Mobile Number locking on Profile update...');
  const testPhone = '7777777777';
  
  // Cleanup
  const existing = await prisma.tenant.findUnique({ where: { mobileNumber: testPhone } });
  if (existing) {
    await prisma.user.deleteMany({ where: { tenantId: existing.id } });
    await prisma.tenant.delete({ where: { id: existing.id } });
  }

  const tenant = await prisma.tenant.create({
    data: {
      ownerName: 'Test Owner',
      mobileNumber: testPhone,
      subscriptionStartDate: new Date(),
      subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isProfileComplete: false
    }
  });

  try {
    // Attempt to update profile with DIFFERENT mobile number
    await businessService.updateBusinessInfo(tenant.id, {
      mobileNumber: '9999999999',
      ownerName: 'Test Owner Updated'
    });
    console.error('❌ FAIL: Expected error when changing mobile number, but succeeded!');
    process.exit(1);
  } catch (err) {
    if (err.statusCode === 400 && err.message.includes('Registered mobile number cannot be modified')) {
      console.log('✅ PASS: Mobile number modification rejected with HTTP 400 ApiError as expected.');
    } else {
      console.error('❌ FAIL: Unexpected error:', err);
      process.exit(1);
    }
  } finally {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
}

testMobileLocking();
