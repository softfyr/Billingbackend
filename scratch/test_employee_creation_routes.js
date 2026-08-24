const BASE_URL = 'http://localhost:5000/api/v1';

async function testEmployeeCreationRoutes() {
  console.log('🧪 Testing Employee Creation Endpoints...\n');

  // Admin login to get package
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

  // Test 1: POST /api/v1/employees
  const emp1Mobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const res1 = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Rahul Employee', mobileNumber: emp1Mobile, password: 'empPassword123' })
  });
  const data1 = await res1.json();
  console.log('1️⃣ POST /api/v1/employees -> Status:', res1.status, data1.message);

  // Test 2: POST /api/v1/auth/employee/register
  const emp2Mobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const res2 = await fetch(`${BASE_URL}/auth/employee/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Sanjay Employee', mobileNumber: emp2Mobile, password: 'empPassword123' })
  });
  const data2 = await res2.json();
  console.log('2️⃣ POST /api/v1/auth/employee/register -> Status:', res2.status, data2.message);

  if (res1.status === 201 && res2.status === 201) {
    console.log('\n🎉 ALL EMPLOYEE CREATION ENDPOINTS WORKING 100% PERFECTLY!');
  } else {
    console.error('❌ Employee creation test failed.');
    process.exit(1);
  }
}

testEmployeeCreationRoutes();
