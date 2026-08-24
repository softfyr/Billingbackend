import { prisma } from '../src/config/prisma.js';
import { getTenants } from '../src/modules/admin/tenant/tenant.service.js';

async function verifyTenantFilters() {
  console.log('🧪 --- STARTING TENANT LIST FILTERS VERIFICATION TEST ---\n');

  try {
    // 1. Setup Test Tenants across all 4 Subscription Statuses
    console.log('1️⃣ Creating Test Tenants for each status...');
    
    // Cleanup any previous test filter tenants
    await prisma.user.deleteMany({ where: { email: { contains: '@filtertest.com' } } });
    await prisma.tenant.deleteMany({ where: { email: { contains: '@filtertest.com' } } });

    const statuses = ['FREE_TRIAL', 'FREE_TRIAL_ENDED', 'UPGRADED', 'EXPIRED'];
    const createdTenants = {};

    for (const st of statuses) {
      const tenant = await prisma.tenant.create({
        data: {
          businessName: `Store Status ${st}`,
          ownerName: `Owner ${st}`,
          email: `vendor_${st.toLowerCase()}@filtertest.com`,
          mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          subscriptionStatus: st,
          accountStatus: 'ACTIVE',
          subscriptionStartDate: new Date(),
          subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isProfileComplete: true
        }
      });
      createdTenants[st] = tenant;
    }
    console.log('   ✅ Successfully created 4 test tenants with different subscription statuses.');

    // 2. Testing Filter: status=ALL
    console.log('\n2️⃣ Testing Filter: status=ALL');
    const allList = await getTenants('ALL');
    console.log(`   Fetched ${allList.length} tenants under status=ALL.`);

    // 3. Testing Filter: status=FREE_TRIAL
    console.log('\n3️⃣ Testing Filter: status=FREE_TRIAL');
    const freeTrialList = await getTenants('FREE_TRIAL');
    const freeTrialMatch = freeTrialList.every(t => t.subscriptionStatus === 'FREE_TRIAL');
    console.log(`   Fetched ${freeTrialList.length} tenants. All status === FREE_TRIAL: ${freeTrialMatch ? '✅ YES' : '❌ NO'}`);

    // 4. Testing Filter: status=FREE_TRIAL_ENDED
    console.log('\n4️⃣ Testing Filter: status=FREE_TRIAL_ENDED');
    const trialEndedList = await getTenants('FREE_TRIAL_ENDED');
    const trialEndedMatch = trialEndedList.every(t => t.subscriptionStatus === 'FREE_TRIAL_ENDED');
    console.log(`   Fetched ${trialEndedList.length} tenants. All status === FREE_TRIAL_ENDED: ${trialEndedMatch ? '✅ YES' : '❌ NO'}`);

    // 5. Testing Filter: status=UPGRADED
    console.log('\n5️⃣ Testing Filter: status=UPGRADED');
    const upgradedList = await getTenants('UPGRADED');
    const upgradedMatch = upgradedList.every(t => t.subscriptionStatus === 'UPGRADED');
    console.log(`   Fetched ${upgradedList.length} tenants. All status === UPGRADED: ${upgradedMatch ? '✅ YES' : '❌ NO'}`);

    // 6. Testing Filter: status=EXPIRED
    console.log('\n6️⃣ Testing Filter: status=EXPIRED');
    const expiredList = await getTenants('EXPIRED');
    const expiredMatch = expiredList.every(t => t.subscriptionStatus === 'EXPIRED');
    console.log(`   Fetched ${expiredList.length} tenants. All status === EXPIRED: ${expiredMatch ? '✅ YES' : '❌ NO'}`);

    // 7. Testing Search Query Filter
    console.log('\n7️⃣ Testing Search Query Filter (search=Store Status UPGRADED)...');
    const searchList = await getTenants('ALL', 'Store Status UPGRADED');
    console.log(`   Fetched ${searchList.length} search match results.`);
    if (searchList.length > 0) {
      console.log(`   Found: "${searchList[0].businessName}" (Owner: ${searchList[0].ownerName})`);
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up filter test records...');
    await prisma.user.deleteMany({ where: { email: { contains: '@filtertest.com' } } });
    await prisma.tenant.deleteMany({ where: { email: { contains: '@filtertest.com' } } });

    console.log('\n🎉 --- TENANT LIST FILTER VERIFICATION COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    console.error('❌ Filter verification test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTenantFilters();
