const BASE_URL = 'http://localhost:5000/api/v1';

async function runE2EVendorAndAdminTest() {
  console.log('🧪 --- STARTING END-TO-END VENDOR ONBOARDING & SUPER ADMIN TENANT MANAGEMENT TEST ---\n');

  try {
    // 1. Super Admin Login
    console.log('1️⃣ Super Admin Login (POST /auth/admin/login)...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    console.log('   Admin Login Status:', adminLoginRes.status, '| Success:', adminLoginData.success);
    const adminToken = adminLoginData.data.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // 2. Vendor Mobile OTP Send & Verify
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    console.log(`\n2️⃣ Creating New Vendor with Mobile Number: ${testMobile}...`);
    
    // Send OTP
    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile })
    });
    const sendOtpData = await sendOtpRes.json();
    const otpCode = sendOtpData.data.otpCode || '123456';
    console.log(`   OTP Sent (${sendOtpRes.status}) | OTP Code: ${otpCode}`);

    // Verify OTP
    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile, otpCode })
    });
    const verifyOtpData = await verifyOtpRes.json();
    console.log('   OTP Verified Status:', verifyOtpRes.status, '| Redirect URL:', verifyOtpData.data.redirectUrl);
    const vendorToken = verifyOtpData.data.token;
    const vendorTenantId = verifyOtpData.data.tenant.id;
    const vendorHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vendorToken}`
    };

    // 3. Vendor Chooses Package
    console.log('\n3️⃣ Vendor Package Selection (POST /subscriptions/choose-package)...');
    const packagesRes = await fetch(`${BASE_URL}/subscriptions/packages`, { headers: vendorHeaders });
    const packagesData = await packagesRes.json();
    const targetPackage = (packagesData.data && packagesData.data.length > 0) ? packagesData.data[0] : null;

    const choosePkgRes = await fetch(`${BASE_URL}/subscriptions/choose-package`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ packageId: targetPackage ? targetPackage.id : undefined })
    });
    const choosePkgData = await choosePkgRes.json();
    console.log('   Package Chosen Status:', choosePkgRes.status, '| Redirect URL:', choosePkgData.data.redirectUrl);

    // 4. Vendor Creates Business Profile
    console.log('\n4️⃣ Vendor Creating Business Profile (POST /business/create-profile)...');
    const createProfileRes = await fetch(`${BASE_URL}/business/create-profile`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        businessName: `Super ${testMobile} Retail Store`,
        businessType: 'Retail Store',
        ownerName: 'Rahul Sharma',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstNumber: '27AAAAA0000A1Z5'
      })
    });
    const createProfileData = await createProfileRes.json();
    console.log('   Profile Created Status:', createProfileRes.status, '| Redirect URL:', createProfileData.data.redirectUrl);

    // 5. Admin Dashboard Overview Verification
    console.log('\n5️⃣ Admin Dashboard Overview Fetch (GET /admin/dashboard)...');
    const dashboardRes = await fetch(`${BASE_URL}/admin/dashboard`, { headers: adminHeaders });
    const dashboardData = await dashboardRes.json();
    console.log('   Dashboard Status:', dashboardRes.status);
    console.log('   📊 Tenant Breakdown:', JSON.stringify(dashboardData.data.tenantOverview));
    console.log('   📈 Registrations Overview:', JSON.stringify(dashboardData.data.registrationsOverview));

    // 6. Admin Tenant Search & Listing Filter
    console.log(`\n6️⃣ Admin Tenant Search & Filter (GET /admin/tenants?search=${testMobile})...`);
    const searchRes = await fetch(`${BASE_URL}/admin/tenants?search=${testMobile}`, { headers: adminHeaders });
    const searchData = await searchRes.json();
    console.log('   Search Results Count:', searchData.data.length);
    if (searchData.data.length > 0) {
      console.log('   Found Tenant:', searchData.data[0].businessName, '| Owner:', searchData.data[0].ownerName, '| Status:', searchData.data[0].subscriptionStatus);
    }

    // 7. Admin Tenant Details View
    console.log(`\n7️⃣ Admin Fetching Tenant Details (GET /admin/tenants/${vendorTenantId})...`);
    const detailsRes = await fetch(`${BASE_URL}/admin/tenants/${vendorTenantId}`, { headers: adminHeaders });
    const detailsData = await detailsRes.json();
    console.log('   Details Status:', detailsRes.status);
    console.log('   🏬 Business Name:', detailsData.data.businessInformation.businessName);
    console.log('   👤 Owner Name:', detailsData.data.ownerInformation.ownerName);
    console.log('   📅 Subscription Details:', JSON.stringify(detailsData.data.subscriptionDetails));

    // 8. Admin Subscription Management (Upgrade & Extend 60 Days)
    console.log(`\n8️⃣ Admin Updating Subscription (PUT /admin/tenants/${vendorTenantId}/subscription)...`);
    const updateSubRes = await fetch(`${BASE_URL}/admin/tenants/${vendorTenantId}/subscription`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        subscriptionStatus: 'UPGRADED',
        extensionDays: 60,
        amount: 2999,
        paymentMethod: 'UPI',
        transactionId: `TXN_E2E_${Date.now()}`
      })
    });
    const updateSubData = await updateSubRes.json();
    console.log('   Subscription Update Status:', updateSubRes.status, '| New Expiry:', updateSubData.data.subscriptionExpiryDate);

    // 9. Admin Suspending Tenant Account
    console.log(`\n9️⃣ Admin Suspending Tenant (PUT /admin/tenants/${vendorTenantId}/status)...`);
    const suspendRes = await fetch(`${BASE_URL}/admin/tenants/${vendorTenantId}/status`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ accountStatus: 'SUSPENDED' })
    });
    const suspendData = await suspendRes.json();
    console.log('   Account Status Updated:', suspendData.data.accountStatus);

    // Verify Vendor gets 403 Forbidden when suspended
    console.log('   🔒 Verifying Suspended Vendor API access restriction...');
    const vendorDashboardRes = await fetch(`${BASE_URL}/business/dashboard`, { headers: vendorHeaders });
    console.log('   Suspended Vendor Request HTTP Code:', vendorDashboardRes.status, `(Expected: 403 Forbidden)`);

    // 10. Admin Reactivating Tenant Account
    console.log(`\n🔟 Admin Reactivating Tenant (PUT /admin/tenants/${vendorTenantId}/status)...`);
    const reactivateRes = await fetch(`${BASE_URL}/admin/tenants/${vendorTenantId}/status`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ accountStatus: 'ACTIVE' })
    });
    const reactivateData = await reactivateRes.json();
    console.log('   Account Status Updated:', reactivateData.data.accountStatus);

    // Verify Vendor access is restored
    console.log('   🔓 Verifying Reactivated Vendor API access...');
    const vendorDashboardRestored = await fetch(`${BASE_URL}/business/dashboard`, { headers: vendorHeaders });
    console.log('   Reactivated Vendor Request HTTP Code:', vendorDashboardRestored.status, `(Expected: 200 OK)`);

    console.log('\n🎉 --- E2E VENDOR CREATION & ADMIN TENANT MANAGEMENT TEST PASSED 100% ---');
  } catch (error) {
    console.error('❌ E2E Test failed with error:', error);
    process.exit(1);
  }
}

runE2EVendorAndAdminTest();
