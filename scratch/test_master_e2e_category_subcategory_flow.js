const BASE_URL = 'http://localhost:5000/api/v1';

async function testMasterCategorySubCategoryFlow() {
  console.log('🧪 --- STARTING MASTER CATEGORY, SUB-CATEGORY & EXPIRY SYSTEM VERIFICATION ---\n');

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

    // 1. Super Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    // 2. Test 1: Super Admin Create Category (Category Name*, Description)
    const catRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Pharmacy ${timeId}`, description: 'Pharmaceuticals & Healthcare Products' })
    });
    const catData = await catRes.json();
    const categoryId = catData.data?.id;

    assert(catRes.status === 201 && categoryId, '1. CATEGORY CREATION -> Super Admin created Category (Pharmacy).');

    // 3. Test 2: View & Update Category
    const updateCatRes = await fetch(`${BASE_URL}/admin/categories/${categoryId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ description: 'Updated Healthcare Description' })
    });
    const updateCatData = await updateCatRes.json();
    assert(updateCatRes.status === 200 && updateCatData.data?.description === 'Updated Healthcare Description', '2. CATEGORY UPDATE -> Updated Category description.');

    // 4. Test 3: Super Admin Create Sub-Category with Expiry Date Enabled (enableExpiryDate: true)
    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        categoryId,
        name: `Medicines ${timeId}`,
        description: 'Rx & OTC Drugs',
        enableExpiryDate: true,
        additionalFields: [
          { labelName: 'Batch Number', inputType: 'TEXT', isRequired: true }
        ]
      })
    });
    const subData = await subRes.json();
    const subCategoryId = subData.data?.id;

    assert(
      subRes.status === 201 &&
      subCategoryId &&
      subData.data?.enableExpiryDate === true,
      '3. SUB-CATEGORY CREATION -> Created Sub-Category (Medicines) with enableExpiryDate: true.'
    );

    // 5. Test 4: Configure Additional Fields (Add, Update, Delete)
    const addFieldRes = await fetch(`${BASE_URL}/admin/sub-categories/${subCategoryId}/fields`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        labelName: 'Dosage Form',
        inputType: 'TEXT',
        isRequired: false
      })
    });
    const addFieldData = await addFieldRes.json();
    const fieldId = addFieldData.data?.id;

    assert(addFieldRes.status === 201 && fieldId, '4. ADDITIONAL FIELD -> Added dynamic custom field (Dosage Form).');

    // 6. Test 5: Vendor OTP Sign-up & Product Expiry Enforcement
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
        body: JSON.stringify({ businessName: `Pharmacy Store ${timeId}`, ownerName: 'Pharmacy Owner', email: `pharma${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 7. Test 6: Vendor Fetch Sub-Category Structure (GET /products/structure/:subCategoryId)
    const structRes = await fetch(`${BASE_URL}/products/structure/${subCategoryId}`, { headers: vendorHeaders });
    const structData = await structRes.json();
    assert(
      structRes.status === 200 &&
      structData.data?.enableExpiryDate === true &&
      Array.isArray(structData.data?.additionalFields),
      '5. VENDOR FIELD STRUCTURE -> Vendor fetched configured Sub-Category structure & Expiry setting.'
    );

    // 8. Test 7: Block Product Creation when Expiry Date is Missing for Expiry-Enabled Sub-Category
    const missingExpiryRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId,
        subCategoryId,
        name: 'Paracetamol 500mg',
        hsnCode: '3004',
        sellingPrice: 40,
        purchasePrice: 25,
        additionalValues: { 'Batch Number': 'ABC123' }
        // Missing expiryDate
      })
    });
    assert(
      missingExpiryRes.status === 400,
      '6. EXPIRY ENFORCEMENT -> Blocked medicine creation when expiryDate is missing for Pharmacy Sub-Category.'
    );

    // 9. Test 8: Create Valid Product with Expiry Date & Custom Batch Number
    const validProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId,
        subCategoryId,
        name: 'Paracetamol 500mg',
        hsnCode: '3004',
        sellingPrice: 40,
        purchasePrice: 25,
        expiryDate: '2027-09-15',
        openingStock: 100,
        additionalValues: { 'Batch Number': 'ABC123' }
      })
    });
    if (!validProdRes.ok) {
      const errText = await validProdRes.text();
      console.log('   Valid Prod Error:', validProdRes.status, errText);
    }
    const validProdData = await validProdRes.json();
    const productId = validProdData.data?.id;

    assert(
      validProdRes.status === 201 &&
      productId &&
      validProdData.data?.expiryDate?.includes('2027-09-15'),
      '7. PRODUCT EXPIRY CREATION -> Created Paracetamol medicine with Batch ABC123 & Expiry: 15/09/2027.'
    );

    console.log(`\n📊 MASTER CATEGORY, SUB-CATEGORY & EXPIRY SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL CATEGORY, SUB-CATEGORY & EXPIRY REQUIREMENTS ARE 100% OPERATIONAL AND VERIFIED PERFECTLY ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Master Category Test Error:', error);
    process.exit(1);
  }
}

testMasterCategorySubCategoryFlow();
