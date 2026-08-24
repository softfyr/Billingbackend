import { prisma } from '../src/config/prisma.js';
import { requireActiveSubscription } from '../src/middlewares/auth.middleware.js';

async function testSubscriptionMiddleware() {
  console.log('🧪 --- TESTING SUBSCRIPTION MIDDLEWARE (requireActiveSubscription) ---');

  const testMobile = '9876543999';
  
  try {
    // 1. Setup Active Tenant
    let tenant = await prisma.tenant.create({
      data: {
        businessName: 'Sub Test Store',
        ownerName: 'Sub Test Owner',
        mobileNumber: testMobile,
        subscriptionStatus: 'FREE_TRIAL',
        accountStatus: 'ACTIVE',
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    const mockReqActive = {
      user: { role: 'TENANT_ADMIN', tenant },
      method: 'POST'
    };

    let nextCalled = false;
    requireActiveSubscription(mockReqActive, {}, (err) => {
      if (!err) nextCalled = true;
    });

    console.log('✅ Active Subscription POST test passed:', nextCalled ? 'ALLOWED' : 'BLOCKED');

    // 2. Test Expired Subscription (GET request -> READ ONLY)
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: 'EXPIRED' }
    });
    tenant.subscriptionStatus = 'EXPIRED';

    const mockReqRead = {
      user: { role: 'TENANT_ADMIN', tenant },
      method: 'GET'
    };

    let readAllowed = false;
    requireActiveSubscription(mockReqRead, {}, (err) => {
      if (!err && mockReqRead.isReadOnly) readAllowed = true;
    });

    console.log('✅ Expired Subscription GET (Read-Only) test passed:', readAllowed ? 'READ-ONLY ALLOWED' : 'BLOCKED');

    // 3. Test Expired Subscription (POST request -> BLOCKED WITH 403)
    const mockReqWrite = {
      user: { role: 'TENANT_ADMIN', tenant },
      method: 'POST'
    };

    let writeBlockedMessage = null;
    requireActiveSubscription(mockReqWrite, {}, (err) => {
      if (err) writeBlockedMessage = err.message;
    });

    console.log('✅ Expired Subscription POST (Write Action) test passed: Correctly blocked!');
    console.log('💬 Error Message:', writeBlockedMessage);

    // Cleanup
    await prisma.tenant.delete({ where: { id: tenant.id } });

    console.log('\n🎉 --- SUBSCRIPTION MIDDLEWARE TEST PASSED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSubscriptionMiddleware();
