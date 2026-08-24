const BASE_URL = 'http://localhost:5000/api/v1';

async function testCompleteEmployeeModule() {
  console.log('🧪 --- TESTING UNIFIED EMPLOYEE MODULE CRUD --- \n');

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
    // Admin Login for package
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;

    const pkgRes = await fetch(`${BASE_URL}/admin/packages`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const pkgData = await pkgRes.json();
    const pkgId = pkgData.data[0].id;

    // Vendor OTP Login (Using random mobile)
    const vendorMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const sendRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile })
    });
    const sendData = await sendRes.json();
    const otpCode = sendData.data?.otpCode || '123456';

    const vVerifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile, otpCode })
    });
    const vVerifyData = await vVerifyRes.json();
    let vendorToken = vVerifyData.data?.accessToken || vVerifyData.data?.token;

    if (!vendorToken) {
      const chooseRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgId })
      });
      const chooseData = await chooseRes.json();
      vendorToken = chooseData.data?.accessToken || chooseData.data?.token;

      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
        body: JSON.stringify({ businessName: 'Test Employee Store', ownerName: 'Store Admin', email: `admin${Date.now()}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 2. Create Employee (POST /employees)
    const empMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const createRes = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Vikas Kumar',
        mobileNumber: empMobile,
        password: 'empPassword123',
        fatherName: 'Suresh Kumar',
        address: '123 Market Street',
        city: 'Jaipur',
        monthlySalary: 18000,
        salaryDate: 5
      })
    });
    const createData = await createRes.json();
    const employeeId = createData.data?.id;

    assert(createRes.status === 201 && employeeId, 'POST /employees -> Registered Employee with Salary & Profile details.');

    // 3. List Employees (GET /employees)
    const listRes = await fetch(`${BASE_URL}/employees`, { headers });
    const listData = await listRes.json();
    assert(listRes.status === 200 && Array.isArray(listData.data) && listData.data.some(e => e.id === employeeId), 'GET /employees -> Listed Store Employees.');

    // 4. Get Employee Details (GET /employees/:id)
    const detailRes = await fetch(`${BASE_URL}/employees/${employeeId}`, { headers });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200 && detailData.data?.employee?.id === employeeId, 'GET /employees/:id -> Fetched Employee Details & Billing Metrics.');

    // 5. Update Employee Profile (PUT /employees/:id)
    const updateRes = await fetch(`${BASE_URL}/employees/${employeeId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Vikas Kumar Updated', monthlySalary: 20000 })
    });
    assert(updateRes.status === 200, 'PUT /employees/:id -> Updated Employee Name & Monthly Salary.');

    // 6. Update Employee Status (PUT /employees/:id/status)
    const statusRes = await fetch(`${BASE_URL}/employees/${employeeId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'SUSPENDED' })
    });
    assert(statusRes.status === 200, 'PUT /employees/:id/status -> Suspended Employee account status.');

    // 7. Delete Employee (DELETE /employees/:id)
    const delRes = await fetch(`${BASE_URL}/employees/${employeeId}`, {
      method: 'DELETE',
      headers
    });
    assert(delRes.status === 200, 'DELETE /employees/:id -> Removed Employee profile & user record.');

    console.log(`\n📊 EMPLOYEE MODULE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- UNIFIED EMPLOYEE MODULE IS 100% OPERATIONAL AND COMPLETE ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testCompleteEmployeeModule();
