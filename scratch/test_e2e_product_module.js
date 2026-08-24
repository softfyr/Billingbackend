const BASE_URL = 'http://localhost:5000/api/v1';

async function runE2EProductModuleTest() {
  console.log('🧪 --- STARTING COMPREHENSIVE VENDOR PRODUCT MODULE E2E HTTP TEST ---\n');

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
    // 0. Login Admin to create a clean Category & Sub-Category for Product Test
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const timeId = Date.now();
    const catSeedRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Electronics Test ${timeId}`, description: 'Smartphones & Gadgets' })
    });
    const catSeedData = await catSeedRes.json();
    const targetCatId = catSeedData.data.id;

    const subSeedRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: targetCatId, name: `Smartphones Test ${timeId}`, description: '5G Handsets', enableExpiryDate: false })
    });
    const subSeedData = await subSeedRes.json();
    const targetSubCatId = subSeedData.data.id;

    // Add 1 required custom field
    await fetch(`${BASE_URL}/admin/sub-categories/${targetSubCatId}/fields`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ labelName: 'RAM Memory', inputType: 'TEXT', isRequired: true, status: 'ACTIVE' })
    });

    // 1. Login Vendor
    console.log('1️⃣ Logging in Vendor...');
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile })
    });
    const sendOtpData = await sendOtpRes.json();
    const otpCode = sendOtpData.data.otpCode || '123456';

    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: testMobile, otpCode })
    });
    const verifyOtpData = await verifyOtpRes.json();
    const vendorToken = verifyOtpData.data.accessToken || verifyOtpData.data.token;
    assert(verifyOtpRes.status === 200 && vendorToken, 'Vendor logged in successfully.');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vendorToken}`
    };

    // 2. Fetch Master Categories
    console.log('\n2️⃣ Fetching Master Categories & Sub-Categories (GET /products/categories)...');
    const catRes = await fetch(`${BASE_URL}/products/categories`, { headers });
    const catData = await catRes.json();
    assert(catRes.status === 200 && Array.isArray(catData.data), 'Fetched Master Categories list.');

    // 3. Get Sub-Category Field Structure
    console.log('\n3️⃣ Fetching Sub-Category Dynamic Field Structure...');
    const structRes = await fetch(`${BASE_URL}/products/structure/${targetSubCatId}`, { headers });
    const structData = await structRes.json();
    assert(structRes.status === 200 && structData.data.id === targetSubCatId, 'Fetched Sub-Category dynamic field structure.');

    // 4. Create New Product
    console.log('\n4️⃣ Creating New Product (POST /products)...');
    const testSku = `SKU-E2E-${Date.now()}`;
    const testBarcode = `BAR-E2E-${Date.now()}`;

    const createProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        categoryId: targetCatId,
        subCategoryId: targetSubCatId,
        name: 'Samsung Galaxy S24 Ultra',
        sku: testSku,
        barcode: testBarcode,
        purchasePrice: 95000,
        sellingPrice: 115000,
        mrp: 129999,
        openingStock: 10,
        minStockLevel: 3,
        description: 'Flagship Samsung Smartphone with AI S-Pen',
        additionalValues: {
          'RAM Memory': '12GB'
        }
      })
    });
    const createProdData = await createProdRes.json();
    const productId = createProdData.data?.id;

    assert(
      createProdRes.status === 201 && productId && createProdData.data.name === 'Samsung Galaxy S24 Ultra',
      'POST /products -> Created Product with Opening Stock = 10.'
    );

    // 5. Get Product List & Filter by Search Query
    console.log('\n5️⃣ Fetching Product List with Search Filter (GET /products?search=Galaxy)...');
    const listRes = await fetch(`${BASE_URL}/products?search=Galaxy`, { headers });
    const listData = await listRes.json();
    assert(
      listRes.status === 200 && Array.isArray(listData.data) && listData.data.some(p => p.id === productId),
      'GET /products?search=Galaxy -> Returns matching Product list.'
    );

    // 6. Search Product by Barcode Scanner (GET /products/barcode/:barcode)
    console.log('\n6️⃣ POS Barcode Scanner Search (GET /products/barcode/:barcode)...');
    const barcodeRes = await fetch(`${BASE_URL}/products/barcode/${testBarcode}`, { headers });
    const barcodeData = await barcodeRes.json();
    assert(
      barcodeRes.status === 200 && barcodeData.data.id === productId,
      `GET /products/barcode/${testBarcode} -> Found exact product via Barcode Scanner.`
    );

    // 7. Get Product Details & Stock History
    console.log('\n7️⃣ Fetching Product Details (GET /products/:id)...');
    const detailRes = await fetch(`${BASE_URL}/products/${productId}`, { headers });
    const detailData = await detailRes.json();
    assert(
      detailRes.status === 200 && detailData.data.id === productId && Array.isArray(detailData.data.stockHistory),
      'GET /products/:id -> Returns Product details with Stock History log.'
    );

    // 8. Update Product Details
    console.log('\n8️⃣ Updating Product Details (PUT /products/:id)...');
    const updateRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        sellingPrice: 112000,
        minStockLevel: 5
      })
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 && updateData.data.sellingPrice === 112000 && updateData.data.minStockLevel === 5,
      'PUT /products/:id -> Updated Product selling price and min stock level.'
    );

    // 9. Delete Product (Soft Delete / Suspend)
    console.log('\n9️⃣ Deleting Product (DELETE /products/:id)...');
    const deleteRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'DELETE',
      headers
    });
    assert(deleteRes.status === 200, 'DELETE /products/:id -> Product deleted/suspended successfully.');

    console.log(`\n📊 PRODUCT MODULE E2E TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- VENDOR PRODUCT MODULE E2E HTTP TESTS PASSED 100% PERFECTLY ---');
    } else {
      console.error('❌ Some Product module E2E tests failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ E2E test failed with error:', error);
    process.exit(1);
  }
}

runE2EProductModuleTest();
