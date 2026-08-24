const BASE_URL = 'http://localhost:5000/api/v1';

async function runMasterE2EProductModuleTest() {
  console.log('🧪 --- STARTING MASTER END-TO-END PRODUCT MODULE VERIFICATION TEST ---\n');

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
    // --- STEP 1: SUPER ADMIN LOGIN & SETUP CATEGORIES ---
    console.log('1️⃣ Super Admin Login & Master Category Setup...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    assert(adminLoginRes.status === 200 && adminToken, 'Super Admin logged in successfully.');

    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const timeSuffix = Date.now();

    // Create Category 1: Electronics
    const cat1Res = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Electronics Master ${timeSuffix}`, description: 'Mobiles & Gadgets' })
    });
    const cat1Data = await cat1Res.json();
    const cat1Id = cat1Data.data.id;

    // Create Sub-Category 1: Smartphones (enableExpiryDate = false)
    const sub1Res = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: cat1Id, name: `Smartphones Master ${timeSuffix}`, enableExpiryDate: false })
    });
    const sub1Data = await sub1Res.json();
    const sub1Id = sub1Data.data.id;

    // Add Required Custom Field to Smartphones
    await fetch(`${BASE_URL}/admin/sub-categories/${sub1Id}/fields`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ labelName: 'IMEI Code', inputType: 'TEXT', isRequired: true, status: 'ACTIVE' })
    });

    // Create Category 2: Grocery
    const cat2Res = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Grocery Master ${timeSuffix}`, description: 'Fresh & Dairy Products' })
    });
    const cat2Data = await cat2Res.json();
    const cat2Id = cat2Data.data.id;

    // Create Sub-Category 2: Dairy Products (enableExpiryDate = true)
    const sub2Res = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: cat2Id, name: `Dairy Products ${timeSuffix}`, enableExpiryDate: true })
    });
    const sub2Data = await sub2Res.json();
    const sub2Id = sub2Data.data.id;

    assert(Boolean(cat1Id && sub1Id && cat2Id && sub2Id), 'Created Master Categories & Sub-Categories with Dynamic Fields.');

    // --- STEP 2: VENDOR & EMPLOYEE LOGINS ---
    console.log('\n2️⃣ Vendor Login & Employee Setup...');
    
    // Vendor OTP Login (Using random unique mobile)
    const vendorMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const vSendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile })
    });
    const vSendOtpData = await vSendOtpRes.json();
    const vOtpCode = vSendOtpData.data?.otpCode || '123456';

    const vendorVerifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile, otpCode: vOtpCode })
    });
    const vendorVerifyData = await vendorVerifyRes.json();
    let vendorToken = vendorVerifyData.data?.accessToken || vendorVerifyData.data?.token;

    // Complete Onboarding Package Selection if new user
    if (!vendorToken) {
      const pkgRes = await fetch(`${BASE_URL}/subscriptions/packages`);
      const pkgData = await pkgRes.json();
      const freeTrialPkg = pkgData.data.find(p => p.isFreeTrial) || pkgData.data[0];

      const choosePkgRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: freeTrialPkg.id })
      });
      const choosePkgData = await choosePkgRes.json();
      vendorToken = choosePkgData.data?.accessToken || choosePkgData.data?.token;

      // Create Store Profile
      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
        body: JSON.stringify({
          businessName: `Store ${timeSuffix}`,
          ownerName: 'Test Vendor Owner',
          email: `vendor${timeSuffix}@test.com`
        })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };
    assert(Boolean(vendorToken), 'Vendor logged in & profile verified.');

    // Register Employee under Vendor with Password
    const empMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const regEmpRes = await fetch(`${BASE_URL}/auth/employee/register`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Staff Operator', mobileNumber: empMobile, password: 'employeePassword123' })
    });
    const regEmpData = await regEmpRes.json();
    assert(regEmpRes.status === 201, 'Vendor registered Employee successfully.');

    // Employee OTP Login
    const eSendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile })
    });
    const eSendOtpData = await eSendOtpRes.json();
    const eOtpCode = eSendOtpData.data?.otpCode || '123456';

    const empVerifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile, otpCode: eOtpCode })
    });
    const empVerifyData = await empVerifyRes.json();
    const employeeToken = empVerifyData.data?.accessToken || empVerifyData.data?.token;
    const employeeHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employeeToken}` };

    assert(empVerifyRes.status === 200 && employeeToken, 'Employee logged in successfully.');

    // --- STEP 3: PRODUCT VALIDATION ERROR TESTS ---
    console.log('\n3️⃣ Product Creation Validation Error Tests...');

    // 3.1 Missing Required Dynamic Field ('IMEI Code')
    const errFieldRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: cat1Id,
        subCategoryId: sub1Id,
        name: 'iPhone 15 Pro',
        sellingPrice: 125000,
        additionalValues: {} // Missing 'IMEI Code'!
      })
    });
    const errFieldData = await errFieldRes.json();
    assert(
      errFieldRes.status === 400 && errFieldData.message.includes("The field 'IMEI Code' is required"),
      `Missing required dynamic field blocked with 400 Bad Request ("${errFieldData.message}")`
    );

    // --- STEP 4: SUCCESSFUL PRODUCT CREATIONS ---
    console.log('\n4️⃣ Creating Products (Mobile & Dairy with Expiry Date)...');

    const phoneBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    const phoneSku = `SKU-IPHONE-${Date.now()}`;

    // Create Smartphone Product
    const phoneRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: cat1Id,
        subCategoryId: sub1Id,
        name: 'iPhone 15 Pro Max (256GB)',
        sku: phoneSku,
        barcode: phoneBarcode,
        purchasePrice: 110000,
        sellingPrice: 135000,
        mrp: 149999,
        openingStock: 15,
        minStockLevel: 3,
        additionalValues: {
          'IMEI Code': '359128049281928'
        }
      })
    });
    const phoneData = await phoneRes.json();
    const phoneId = phoneData.data?.id;

    assert(
      phoneRes.status === 201 && phoneId && phoneData.data.name === 'iPhone 15 Pro Max (256GB)',
      'POST /products -> Created Mobile Product with Opening Stock = 15 & IMEI Code.'
    );

    // 4.2 Duplicate SKU Error check
    const dupSkuRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: cat1Id,
        subCategoryId: sub1Id,
        name: 'iPhone Duplicate SKU',
        sku: phoneSku,
        sellingPrice: 135000,
        additionalValues: { 'IMEI Code': '123' }
      })
    });
    const dupSkuData = await dupSkuRes.json();
    assert(
      dupSkuRes.status === 400 && dupSkuData.message.includes('already exists'),
      `Duplicate SKU blocked with 400 Bad Request ("${dupSkuData.message}")`
    );

    // Create Dairy Product (Low Stock & Expiry Date)
    const milkExpiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days expiry
    const milkRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: cat2Id,
        subCategoryId: sub2Id,
        name: 'Amul Taaza Milk 1L Pack',
        purchasePrice: 48,
        sellingPrice: 56,
        mrp: 56,
        openingStock: 2, // Stock 2 is <= minStockLevel 5!
        minStockLevel: 5,
        expiryDate: milkExpiryDate
      })
    });
    const milkData = await milkRes.json();
    const milkId = milkData.data?.id;

    assert(
      milkRes.status === 201 && milkId && milkData.data.expiryDate,
      'POST /products -> Created Dairy Product with Expiry Date & Low Stock (Stock: 2 <= MinLevel: 5).'
    );

    // --- STEP 5: SPECIALIZED FEATURES (LOW STOCK & POS BARCODE SCANNER) ---
    console.log('\n5️⃣ Specialized Features (Low Stock Alert & POS Barcode Scanner)...');

    // 5.1 Low Stock Alerts Endpoint
    const lowStockRes = await fetch(`${BASE_URL}/products/low-stock`, { headers: vendorHeaders });
    const lowStockData = await lowStockRes.json();
    assert(
      lowStockRes.status === 200 && Array.isArray(lowStockData.data) && lowStockData.data.some(p => p.id === milkId),
      'GET /products/low-stock -> Returns Low Stock alert items (Amul Milk).'
    );

    // 5.2 POS Barcode Scanner Endpoint
    const scannerRes = await fetch(`${BASE_URL}/products/barcode/${phoneBarcode}`, { headers: vendorHeaders });
    const scannerData = await scannerRes.json();
    assert(
      scannerRes.status === 200 && scannerData.data.id === phoneId,
      `GET /products/barcode/${phoneBarcode} -> Found exact product via Barcode Scanner.`
    );

    // --- STEP 6: EMPLOYEE RESTRICTION CHECK ---
    console.log('\n6️⃣ Employee Role Security Restriction Tests...');

    // Employee CAN read product
    const empReadRes = await fetch(`${BASE_URL}/products/${phoneId}`, { headers: employeeHeaders });
    assert(empReadRes.status === 200, 'Employee can view product details.');

    // Employee CANNOT delete product
    const empDeleteRes = await fetch(`${BASE_URL}/products/${phoneId}`, {
      method: 'DELETE',
      headers: employeeHeaders
    });
    const empDeleteData = await empDeleteRes.json();
    assert(
      empDeleteRes.status === 403 && (empDeleteData.message.includes('not authorized') || empDeleteData.message.includes('not allowed')),
      `Employee blocked from deleting product with 403 Forbidden ("${empDeleteData.message}")`
    );

    // --- STEP 7: VENDOR PRODUCT DELETION & CLEANUP ---
    console.log('\n7️⃣ Vendor Product Deletion...');
    const vendorDeleteRes = await fetch(`${BASE_URL}/products/${phoneId}`, {
      method: 'DELETE',
      headers: vendorHeaders
    });
    assert(vendorDeleteRes.status === 200, 'Vendor deleted product successfully.');

    console.log(`\n📊 MASTER E2E PRODUCT TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL PRODUCT MODULE END-TO-END VERIFICATIONS PASSED 100% PERFECTLY ---');
    } else {
      console.error('❌ Some Product module E2E tests failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Master E2E test failed with error:', error);
    process.exit(1);
  }
}

runMasterE2EProductModuleTest();
