import { prisma } from '../src/config/prisma.js';
import {
  getTenants,
  getTenantDetails,
  updateTenantSubscription,
  updateTenantAccountStatus
} from '../src/modules/admin/tenant/tenant.service.js';

async function runFullTenantModuleCheck() {
  console.log('🧪 --- STARTING COMPREHENSIVE ADMIN TENANT MODULE EXHAUSTIVE CHECK ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 0. Setup clean test environment & create packages if missing
    console.log('0️⃣ Setup & Data Preparation...');
    await prisma.user.deleteMany({ where: { email: { contains: '@exhaustivecheck.com' } } });
    await prisma.tenant.deleteMany({ where: { email: { contains: '@exhaustivecheck.com' } } });

    let testPackage = await prisma.package.findFirst({ where: { isFreeTrial: false } });
    if (!testPackage) {
      testPackage = await prisma.package.create({
        data: {
          packageName: 'Check Package Pro',
          description: 'Package for Exhaustive Testing',
          durationMonths: 1,
          amount: 999,
          isFreeTrial: false,
          status: 'ACTIVE'
        }
      });
    }

    // Create 4 distinct tenants with different statuses
    const tenantFreeTrial = await prisma.tenant.create({
      data: {
        businessName: 'Alpha Grocery Store',
        ownerName: 'Alpha Owner',
        email: 'alpha@exhaustivecheck.com',
        mobileNumber: '9111111111',
        subscriptionStatus: 'FREE_TRIAL',
        accountStatus: 'ACTIVE',
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isProfileComplete: true
      }
    });

    const tenantEnded = await prisma.tenant.create({
      data: {
        businessName: 'Beta Electronics Hub',
        ownerName: 'Beta Owner',
        email: 'beta@exhaustivecheck.com',
        mobileNumber: '9222222222',
        subscriptionStatus: 'FREE_TRIAL_ENDED',
        accountStatus: 'ACTIVE',
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        isProfileComplete: true
      }
    });

    const tenantUpgraded = await prisma.tenant.create({
      data: {
        businessName: 'Gamma Supermarket',
        ownerName: 'Gamma Owner',
        email: 'gamma@exhaustivecheck.com',
        mobileNumber: '9333333333',
        subscriptionStatus: 'UPGRADED',
        accountStatus: 'ACTIVE',
        currentPackageId: testPackage.id,
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isProfileComplete: true
      }
    });

    const tenantExpired = await prisma.tenant.create({
      data: {
        businessName: 'Delta Pharmacy',
        ownerName: 'Delta Owner',
        email: 'delta@exhaustivecheck.com',
        mobileNumber: '9444444444',
        subscriptionStatus: 'EXPIRED',
        accountStatus: 'SUSPENDED',
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isProfileComplete: true
      }
    });

    console.log('   ✅ 4 distinct test tenants created successfully.\n');

    // --- CATEGORY 1: TENANT LISTING & FILTERS ---
    console.log('📌 CATEGORY 1: Tenant Listing & Status Filters');

    // Test 1.1: Default / status=ALL
    const listAll = await getTenants('ALL');
    assert(listAll.length >= 4, `Listing status=ALL returns all tenants (Count: ${listAll.length})`);

    // Test 1.2: status=FREE_TRIAL
    const listFreeTrial = await getTenants('FREE_TRIAL');
    assert(
      listFreeTrial.length >= 1 && listFreeTrial.every(t => t.subscriptionStatus === 'FREE_TRIAL'),
      'Listing status=FREE_TRIAL returns only FREE_TRIAL tenants'
    );

    // Test 1.3: status=FREE_TRIAL_ENDED
    const listEnded = await getTenants('FREE_TRIAL_ENDED');
    assert(
      listEnded.length >= 1 && listEnded.every(t => t.subscriptionStatus === 'FREE_TRIAL_ENDED'),
      'Listing status=FREE_TRIAL_ENDED returns only FREE_TRIAL_ENDED tenants'
    );

    // Test 1.4: status=UPGRADED
    const listUpgraded = await getTenants('UPGRADED');
    assert(
      listUpgraded.length >= 1 && listUpgraded.every(t => t.subscriptionStatus === 'UPGRADED'),
      'Listing status=UPGRADED returns only UPGRADED tenants'
    );

    // Test 1.5: status=EXPIRED
    const listExpired = await getTenants('EXPIRED');
    assert(
      listExpired.length >= 1 && listExpired.every(t => t.subscriptionStatus === 'EXPIRED'),
      'Listing status=EXPIRED returns only EXPIRED tenants'
    );

    // Test 1.6: Search by Business Name
    const searchBusiness = await getTenants('ALL', 'Alpha Grocery');
    assert(
      searchBusiness.length === 1 && searchBusiness[0].id === tenantFreeTrial.id,
      'Search by Business Name matches exact tenant ("Alpha Grocery Store")'
    );

    // Test 1.7: Search by Owner Name
    const searchOwner = await getTenants('ALL', 'Gamma Owner');
    assert(
      searchOwner.length === 1 && searchOwner[0].id === tenantUpgraded.id,
      'Search by Owner Name matches exact tenant ("Gamma Owner")'
    );

    // Test 1.8: Search by Email
    const searchEmail = await getTenants('ALL', 'beta@exhaustivecheck.com');
    assert(
      searchEmail.length === 1 && searchEmail[0].id === tenantEnded.id,
      'Search by Email matches exact tenant ("beta@exhaustivecheck.com")'
    );

    // Test 1.9: Search by Mobile Number
    const searchMobile = await getTenants('ALL', '9444444444');
    assert(
      searchMobile.length === 1 && searchMobile[0].id === tenantExpired.id,
      'Search by Mobile Number matches exact tenant ("9444444444")'
    );

    // Test 1.10: Search with non-existent query
    const searchEmpty = await getTenants('ALL', 'NON_EXISTENT_BUSINESS_NAME_12345');
    assert(searchEmpty.length === 0, 'Search with non-existent query returns empty array');

    // --- CATEGORY 2: TENANT DETAILS VIEW ---
    console.log('\n📌 CATEGORY 2: Tenant Deep Details View & Error Handling');

    // Test 2.1: Valid Tenant Details
    const details = await getTenantDetails(tenantUpgraded.id);
    assert(
      details.id === tenantUpgraded.id &&
      details.businessInformation.businessName === 'Gamma Supermarket' &&
      details.ownerInformation.ownerName === 'Gamma Owner' &&
      details.currentPackage.id === testPackage.id &&
      details.subscriptionDetails.subscriptionStatus === 'UPGRADED' &&
      details.counts !== undefined,
      'Valid tenant details returns structured Business Info, Owner Info, Package & Counts'
    );

    // Test 2.2: Invalid Tenant ID
    try {
      await getTenantDetails('00000000-0000-0000-0000-000000000000');
      assert(false, 'Fetching invalid tenant ID should throw 404 error');
    } catch (err) {
      assert(err.statusCode === 404, `Invalid tenant ID throws 404 error ("${err.message}")`);
    }

    // --- CATEGORY 3: SUBSCRIPTION MANAGEMENT ---
    console.log('\n📌 CATEGORY 3: Subscription Management & Payment History');

    // Test 3.1: Package Change & History Entry Creation
    const updatedSubPkg = await updateTenantSubscription(tenantFreeTrial.id, {
      packageId: testPackage.id,
      amount: 999,
      paymentMethod: 'UPI',
      transactionId: 'TXN_TEST_PACKAGE_CHANGE'
    });
    assert(
      updatedSubPkg.currentPackageId === testPackage.id,
      'Assigning Package updates currentPackageId'
    );

    // Verify SubscriptionHistory record was logged
    const subHistory = await prisma.subscriptionHistory.findFirst({
      where: { tenantId: tenantFreeTrial.id, transactionId: 'TXN_TEST_PACKAGE_CHANGE' }
    });
    assert(
      subHistory !== null && subHistory.amount === 999,
      'Subscription update logs entry in SubscriptionHistory table with correct amount'
    );

    // Test 3.2: Extend Free Trial / Subscription by Days
    const initialExpiry = new Date(tenantFreeTrial.subscriptionExpiryDate);
    const updatedSubExtend = await updateTenantSubscription(tenantFreeTrial.id, {
      extensionDays: 15
    });
    const newExpiry = new Date(updatedSubExtend.subscriptionExpiryDate);
    const daysDiff = Math.round((newExpiry - initialExpiry) / (1000 * 60 * 60 * 24));
    assert(
      daysDiff === 15,
      `Extending subscription by 15 days increases expiry date by exactly 15 days (Diff: ${daysDiff} days)`
    );

    // Test 3.3: Set Explicit Expiry Date
    const explicitDate = new Date('2028-12-31T00:00:00.000Z');
    const updatedSubExplicit = await updateTenantSubscription(tenantFreeTrial.id, {
      newExpiryDate: explicitDate.toISOString()
    });
    assert(
      new Date(updatedSubExplicit.subscriptionExpiryDate).getTime() === explicitDate.getTime(),
      'Setting explicit newExpiryDate updates subscriptionExpiryDate accurately'
    );

    // Test 3.4: Upgrade Subscription Status
    const updatedStatus = await updateTenantSubscription(tenantEnded.id, {
      subscriptionStatus: 'UPGRADED'
    });
    assert(
      updatedStatus.subscriptionStatus === 'UPGRADED',
      'Updating subscriptionStatus to UPGRADED updates status field'
    );

    // Test 3.5: Invalid Package ID
    try {
      await updateTenantSubscription(tenantFreeTrial.id, { packageId: '00000000-0000-0000-0000-000000000000' });
      assert(false, 'Updating with invalid package ID should throw 404 error');
    } catch (err) {
      assert(err.statusCode === 404, `Invalid package ID throws 404 error ("${err.message}")`);
    }

    // --- CATEGORY 4: TENANT ACCOUNT CONTROL (INDEPENDENT CONTROL) ---
    console.log('\n📌 CATEGORY 4: Independent Account Control (Suspend & Reactivate)');

    // Test 4.1: Suspend Account
    const suspended = await updateTenantAccountStatus(tenantUpgraded.id, 'SUSPENDED');
    assert(
      suspended.accountStatus === 'SUSPENDED' && suspended.subscriptionStatus === 'UPGRADED',
      'Suspending account changes accountStatus to SUSPENDED without modifying subscriptionStatus'
    );

    // Test 4.2: Reactivate Account
    const reactivated = await updateTenantAccountStatus(tenantUpgraded.id, 'ACTIVE');
    assert(
      reactivated.accountStatus === 'ACTIVE',
      'Reactivating account changes accountStatus to ACTIVE'
    );

    // Test 4.3: Invalid Account Status
    try {
      await updateTenantAccountStatus(tenantUpgraded.id, 'INVALID_STATUS');
      assert(false, 'Updating with invalid accountStatus should throw 400 error');
    } catch (err) {
      assert(err.statusCode === 400, `Invalid accountStatus throws 400 error ("${err.message}")`);
    }

    // Cleanup test records
    console.log('\n🧹 Cleaning up exhaustive test records...');
    await prisma.user.deleteMany({ where: { email: { contains: '@exhaustivecheck.com' } } });
    await prisma.tenant.deleteMany({ where: { email: { contains: '@exhaustivecheck.com' } } });

    console.log(`\n📊 EXHAUSTIVE CHECK SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL ADMIN TENANT MODULE CONDITIONS PASSED 100% PERFECTLY ---');
    } else {
      console.error('❌ Some tests failed. Please review errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Exhaustive test encountered unexpected error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFullTenantModuleCheck();
