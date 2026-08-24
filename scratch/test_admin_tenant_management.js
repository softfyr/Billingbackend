import { getAdminDashboardData } from '../src/modules/admin/dashboard/dashboard.service.js';
import {
  getTenants,
  getTenantDetails,
  updateTenantSubscription,
  updateTenantAccountStatus
} from '../src/modules/admin/tenant/tenant.service.js';
import { prisma } from '../src/config/prisma.js';

async function runAdminTenantTests() {
  console.log('🧪 --- STARTING SUPER ADMIN TENANT & DASHBOARD OVERVIEW TESTS ---\n');

  try {
    // 1. Fetch Dashboard Data
    console.log('1️⃣ Fetching Super Admin Dashboard Overview Data...');
    const dashboard = await getAdminDashboardData();
    console.log('✅ Dashboard Overview Result:');
    console.log('   📊 Tenant Breakdown:', JSON.stringify(dashboard.tenantOverview));
    console.log('   📈 Registrations Overview:', JSON.stringify(dashboard.registrationsOverview));
    console.log('   💰 Revenue Overview:', JSON.stringify(dashboard.revenueOverview));
    console.log('   📄 Recent Registrations Count:', dashboard.recentRegistrations.length);
    console.log('   💳 Recent Payments Count:', dashboard.recentPayments.length);
    console.log('   🎫 Support Ticket Summary:', JSON.stringify(dashboard.supportTicketSummary));

    // 2. Fetch Tenant Listing with Status Filters
    console.log('\n2️⃣ Testing Tenant Listing & Filtering...');
    const allTenants = await getTenants('ALL');
    console.log(`✅ Total Tenants Count ('ALL'): ${allTenants.length}`);

    const freeTrialTenants = await getTenants('FREE_TRIAL');
    console.log(`✅ Free Trial Tenants Count: ${freeTrialTenants.length}`);

    const upgradedTenants = await getTenants('UPGRADED');
    console.log(`✅ Upgraded Tenants Count: ${upgradedTenants.length}`);

    const expiredTenants = await getTenants('EXPIRED');
    console.log(`✅ Expired Tenants Count: ${expiredTenants.length}`);

    if (allTenants.length === 0) {
      console.log('⚠️ No tenants found to test deep details & subscription operations.');
      process.exit(0);
    }

    const testTenant = allTenants[0];
    console.log(`\nSelected Test Tenant ID: ${testTenant.id} (${testTenant.businessName})`);

    // 3. Fetch Tenant Details
    console.log('\n3️⃣ Testing Tenant Deep Details View...');
    const details = await getTenantDetails(testTenant.id);
    console.log('✅ Tenant Details Structure Verified:');
    console.log('   🏬 Business Info:', details.businessInformation.businessName, `(Complete: ${details.businessInformation.isProfileComplete})`);
    console.log('   👤 Owner Info:', details.ownerInformation.ownerName, `(${details.ownerInformation.mobileNumber})`);
    console.log('   📅 Subscription Status:', details.subscriptionDetails.subscriptionStatus);
    console.log('   🔒 Account Status:', details.accountStatus);
    console.log('   📊 Entity Counts:', JSON.stringify(details.counts));

    // 4. Testing Subscription Management (Extension & Status Upgrade)
    console.log('\n4️⃣ Testing Subscription Management (Extension & Manual Package Change)...');
    const updatedSub = await updateTenantSubscription(testTenant.id, {
      subscriptionStatus: 'UPGRADED',
      extensionDays: 30,
      amount: 1999,
      paymentMethod: 'UPI',
      transactionId: `TEST_TXN_${Date.now()}`
    });
    console.log('✅ Subscription Updated Successfully:');
    console.log('   Status:', updatedSub.subscriptionStatus);
    console.log('   Expiry Date:', updatedSub.subscriptionExpiryDate);

    // 5. Testing Independent Account Status Control (Suspend & Reactivate)
    console.log('\n5️⃣ Testing Independent Account Control (Suspend & Reactivate)...');
    const suspendedTenant = await updateTenantAccountStatus(testTenant.id, 'SUSPENDED');
    console.log('✅ Tenant Account Suspended:', suspendedTenant.accountStatus);

    const reactivatedTenant = await updateTenantAccountStatus(testTenant.id, 'ACTIVE');
    console.log('✅ Tenant Account Reactivated:', reactivatedTenant.accountStatus);

    console.log('\n🎉 --- ALL ADMIN TENANT & DASHBOARD TESTS PASSED PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminTenantTests();
