const BASE_URL = 'http://localhost:5000/api/v1';

async function testMasterE2EProductModuleV2() {
  console.log('🧪 --- STARTING MASTER END-TO-END PRODUCT MODULE VERIFICATION ---\n');

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
    const timeId = Date.now();

    // 1. Super Admin Setup Category & Sub-Category with Dynamic Additional Field
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const catRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Mobiles Cat ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        name: `Smartphones SubCat ${timeId}`,
        additionalFields: [
          { labelName: 'IMEI Number', inputType: 'TEXT', isRequired: true }
        ]
      })
    });
    const subData = await subRes.json();

    // 2. Vendor OTP Sign-up
    const vendorMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile })
    });
    const sendOtpData = await sendOtpRes.json();

    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile, otpCode: sendOtpData.data?.otpCode || '123456' })
    });
    const verifyOtpData = await verifyOtpRes.json();
    let vendorToken = verifyOtpData.data?.accessToken || verifyOtpData.data?.token;

    if (!vendorToken) {
      const pkgRes = await fetch(`${BASE_URL}/subscriptions/packages`);
      const pkgData = await pkgRes.json();

      const chooseRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgData.data[0].id })
      });
      const chooseData = await chooseRes.json();
      vendorToken = chooseData.data?.accessToken || chooseData.data?.token;

      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
        body: JSON.stringify({ businessName: `Product E2E Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 3. Register Employee for Security Testing
    const empMobile = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Store Cashier', mobileNumber: empMobile, password: 'staffpassword123' })
    });

    const empSendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile })
    });
    const empSendOtpData = await empSendOtpRes.json();

    const empVerifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile, otpCode: empSendOtpData.data?.otpCode || '123456' })
    });
    const empVerifyOtpData = await empVerifyOtpRes.json();
    const employeeToken = empVerifyOtpData.data?.accessToken || empVerifyOtpData.data?.token;
    const employeeHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employeeToken}` };

    // 4. Test 1: Block Product Creation without Required Additional Field
    const missingFieldRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: 'Samsung Galaxy S24 Ultra',
        sellingPrice: 119999,
        purchasePrice: 95000,
        additionalValues: {} // Missing 'IMEI Number'
      })
    });
    assert(missingFieldRes.status === 400, '1. DYNAMIC FIELD VALIDATION -> Blocked product creation when required sub-category field is missing.');

    // 5. Test 2: Valid Product Creation (POST /products)
    const barcode1 = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    const sku1 = `SKU-SAM-${timeId}`;

    const createProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: 'Samsung Galaxy S24 Ultra',
        brand: 'Samsung',
        unit: 'PCS',
        sku: sku1,
        barcode: barcode1,
        sellingPrice: 119999,
        purchasePrice: 95000,
        openingStock: 10,
        minStockLevel: 3,
        maxStockLevel: 50,
        additionalValues: { 'IMEI Number': '358901123456789' }
      })
    });
    const createProdData = await createProdRes.json();
    const productId1 = createProdData.data?.id;

    assert(
      createProdRes.status === 201 && productId1,
      '2. POST /products -> Created Product with Brand, Unit, MaxStock, and Dynamic Custom Fields.'
    );

    // 6. Test 3: Block Duplicate SKU / Barcode Creation
    const dupSkuRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: 'Samsung Galaxy S24 Duplicate',
        sku: sku1, // Duplicate SKU
        sellingPrice: 119999,
        additionalValues: { 'IMEI Number': '358901123456790' }
      })
    });
    assert(dupSkuRes.status === 400, '3. DUPLICATE ENFORCEMENT -> Blocked duplicate SKU creation within same store.');

    // 7. Test 4: Barcode Scanner Lookup (`GET /products/barcode/:barcode`)
    const barcodeScanRes = await fetch(`${BASE_URL}/products/barcode/${barcode1}`, { headers: vendorHeaders });
    const barcodeScanData = await barcodeScanRes.json();
    assert(
      barcodeScanRes.status === 200 && barcodeScanData.data?.id === productId1,
      '4. GET /products/barcode/:barcode -> POS Barcode Scanner fetched exact product record.'
    );

    // 8. Test 5: List & Filter Products (`GET /products`)
    const listRes = await fetch(`${BASE_URL}/products?brand=Samsung&search=Galaxy`, { headers: vendorHeaders });
    const listData = await listRes.json();
    assert(
      listRes.status === 200 && Array.isArray(listData.data) && listData.data.length >= 1,
      '5. GET /products -> Listed products with Brand and Search filters.'
    );

    // 9. Test 6: Create Low Stock Product & Fetch Low Stock Alerts (`GET /products/low-stock`)
    const lowProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: 'Samsung Galaxy Charger',
        sellingPrice: 1500,
        openingStock: 1,
        minStockLevel: 5,
        additionalValues: { 'IMEI Number': 'N/A' }
      })
    });
    const lowProdData = await lowProdRes.json();
    const lowProductId = lowProdData.data?.id;

    const lowStockAlertRes = await fetch(`${BASE_URL}/products/low-stock`, { headers: vendorHeaders });
    const lowStockAlertData = await lowStockAlertRes.json();
    assert(
      lowStockAlertRes.status === 200 &&
      Array.isArray(lowStockAlertData.data) &&
      lowStockAlertData.data.some(p => p.id === lowProductId),
      '6. GET /products/low-stock -> Low Stock Alert System detected low stock product (Stock: 1, Min: 5).'
    );

    // 10. Test 7: Get Product Details & Stock Audit Trail (`GET /products/:id`)
    const detailsRes = await fetch(`${BASE_URL}/products/${productId1}`, { headers: vendorHeaders });
    const detailsData = await detailsRes.json();
    assert(
      detailsRes.status === 200 &&
      detailsData.data?.id === productId1 &&
      Array.isArray(detailsData.data?.stockHistory),
      '7. GET /products/:id -> Fetched complete product profile and StockHistory audit trail.'
    );

    // 11. Test 8: Update Product (`PUT /products/:id`)
    const updateRes = await fetch(`${BASE_URL}/products/${productId1}`, {
      method: 'PUT',
      headers: vendorHeaders,
      body: JSON.stringify({
        sellingPrice: 114999,
        purchasePrice: 92000
      })
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 && updateData.data?.sellingPrice === 114999,
      '8. PUT /products/:id -> Updated Product selling price and purchase price.'
    );

    // 12. Test 9: Role-Based Security Enforcement (`DELETE /products/:id`)
    const empDeleteRes = await fetch(`${BASE_URL}/products/${lowProductId}`, {
      method: 'DELETE',
      headers: employeeHeaders
    });
    assert(
      empDeleteRes.status === 403,
      '9. SECURITY ENFORCEMENT -> Employee token blocked from deleting product with 403 Forbidden.'
    );

    const adminDeleteRes = await fetch(`${BASE_URL}/products/${lowProductId}`, {
      method: 'DELETE',
      headers: vendorHeaders
    });
    assert(
      adminDeleteRes.status === 200,
      '10. DELETE /products/:id -> Vendor Store Admin successfully deleted product record.'
    );

    console.log(`\n📊 MASTER E2E PRODUCT MODULE SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL PRODUCT MODULE FEATURES ARE 100% OPERATIONAL & VERIFIED PERFECTLY ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Master Product E2E Test Error:', error);
    process.exit(1);
  }
}

testMasterE2EProductModuleV2();
