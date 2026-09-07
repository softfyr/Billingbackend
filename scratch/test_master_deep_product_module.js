const BASE_URL = 'http://localhost:5000/api/v1';

async function testMasterDeepProductModule() {
  console.log('================================================================');
  console.log('🧪 STARTING COMPREHENSIVE PRODUCT MODULE & EDGE CASE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, failureDetail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (failureDetail) console.error(`   Details: ${failureDetail}`);
      failed++;
    }
  }

  try {
    const timeId = Date.now();

    // ------------------------------------------------------------------
    // STEP 1: SUPER ADMIN LOGIN & CATEGORY / SUB-CATEGORY SETUP
    // ------------------------------------------------------------------
    console.log('📦 Step 1: Setting up Master Categories and Sub-Categories...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginData.data?.accessToken, 'Admin Login successful');

    const adminToken = adminLoginData.data.accessToken;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    // Create Category A with SubCategory A1 (Required Dynamic Field: IMEI Number)
    const catARes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Electronics Deep ${timeId}` })
    });
    const catAData = await catARes.json();
    const categoryIdA = catAData.data.id;

    const subcatARes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        categoryId: categoryIdA,
        name: `Smartphones Deep ${timeId}`,
        enableExpiryDate: true,
        additionalFields: [
          { labelName: 'IMEI Number', inputType: 'TEXT', isRequired: true },
          { labelName: 'Storage RAM', inputType: 'TEXT', isRequired: false }
        ]
      })
    });
    const subcatAData = await subcatARes.json();
    const subCategoryIdA = subcatAData.data.id;

    // Create Category B with SubCategory B1 (No required dynamic fields)
    const catBRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Groceries Deep ${timeId}` })
    });
    const catBData = await catBRes.json();
    const categoryIdB = catBData.data.id;

    const subcatBRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        categoryId: categoryIdB,
        name: `Snacks Deep ${timeId}`,
        enableExpiryDate: false,
        additionalFields: []
      })
    });
    const subcatBData = await subcatBRes.json();
    const subCategoryIdB = subcatBData.data.id;

    // ------------------------------------------------------------------
    // STEP 2: VENDOR 1 & VENDOR 2 & EMPLOYEE SETUP FOR TENANT & RBAC TEST
    // ------------------------------------------------------------------
    console.log('\n👤 Step 2: Setting up Vendors and Employee Accounts...');
    
    // Vendor 1
    const v1Mobile = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const v1OtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: v1Mobile })
    });
    const v1OtpData = await v1OtpRes.json();

    const v1VerifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: v1Mobile, otpCode: v1OtpData.data?.otpCode || '123456' })
    });
    const v1VerifyData = await v1VerifyRes.json();
    let vendor1Token = v1VerifyData.data?.accessToken;

    if (!vendor1Token) {
      const pkgRes = await fetch(`${BASE_URL}/subscriptions/packages`);
      const pkgData = await pkgRes.json();

      const chooseRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgData.data[0].id })
      });
      const chooseData = await chooseRes.json();
      vendor1Token = chooseData.data?.accessToken;

      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendor1Token}` },
        body: JSON.stringify({ businessName: `Vendor 1 Store ${timeId}`, ownerName: 'Vendor One', email: `v1_${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendor1Token = profData.data?.accessToken || vendor1Token;
    }
    const v1Headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendor1Token}` };

    // Vendor 2 (For Tenant Isolation Testing)
    const v2Mobile = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
    const v2OtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: v2Mobile })
    });
    const v2OtpData = await v2OtpRes.json();

    const v2VerifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: v2Mobile, otpCode: v2OtpData.data?.otpCode || '123456' })
    });
    const v2VerifyData = await v2VerifyRes.json();
    let vendor2Token = v2VerifyData.data?.accessToken;

    if (!vendor2Token) {
      const pkgRes = await fetch(`${BASE_URL}/subscriptions/packages`);
      const pkgData = await pkgRes.json();

      const chooseRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgData.data[0].id })
      });
      const chooseData = await chooseRes.json();
      vendor2Token = chooseData.data?.accessToken;

      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendor2Token}` },
        body: JSON.stringify({ businessName: `Vendor 2 Store ${timeId}`, ownerName: 'Vendor Two', email: `v2_${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendor2Token = profData.data?.accessToken || vendor2Token;
    }
    const v2Headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendor2Token}` };

    // Register Employee under Vendor 1
    const empMobile = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
    await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ name: 'Vendor 1 Cashier', mobileNumber: empMobile, password: 'employeePass123' })
    });

    const empOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile })
    });
    const empOtpData = await empOtpRes.json();

    const empVerifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile, otpCode: empOtpData.data?.otpCode || '123456' })
    });
    const empVerifyData = await empVerifyRes.json();
    const empToken = empVerifyData.data?.accessToken;
    const empHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empToken}` };

    assert(vendor1Token && vendor2Token && empToken, 'Vendor 1, Vendor 2, and Employee accounts initialized successfully');

    // ------------------------------------------------------------------
    // STEP 3: CATEGORY & STRUCTURE ENDPOINTS
    // ------------------------------------------------------------------
    console.log('\n🔍 Step 3: Testing Category Metadata Endpoints...');

    // GET /products/categories
    const getCatsRes = await fetch(`${BASE_URL}/products/categories`, { headers: v1Headers });
    const getCatsData = await getCatsRes.json();
    assert(getCatsRes.status === 200 && Array.isArray(getCatsData.data), 'GET /products/categories returns categories list');

    // GET /products/structure/:subCategoryId
    const getStructRes = await fetch(`${BASE_URL}/products/structure/${subCategoryIdA}`, { headers: v1Headers });
    const getStructData = await getStructRes.json();
    assert(
      getStructRes.status === 200 && getStructData.data?.additionalFields?.some(f => f.labelName === 'IMEI Number'),
      'GET /products/structure/:subCategoryId returns dynamic custom fields'
    );

    // GET /products/structure/:nonExistentId (404 edge case)
    const invalidSubCatId = '00000000-0000-0000-0000-000000000000';
    const struct404Res = await fetch(`${BASE_URL}/products/structure/${invalidSubCatId}`, { headers: v1Headers });
    assert(struct404Res.status === 404, 'GET /products/structure/:subCategoryId with non-existent UUID returns 404');

    // ------------------------------------------------------------------
    // STEP 4: PRODUCT CREATION VALIDATION & EDGE CASES
    // ------------------------------------------------------------------
    console.log('\n🛡️ Step 4: Testing Product Creation Validation & Edge Cases...');

    // Edge Case 4.1: Missing Name
    const errNameRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ categoryId: categoryIdA, subCategoryId: subCategoryIdA, sellingPrice: 500 })
    });
    assert(errNameRes.status === 400, 'POST /products -> Blocks product creation without name (400)');

    // Edge Case 4.2: Missing CategoryId / SubCategoryId
    const errCatRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ name: 'Test Product', sellingPrice: 500 })
    });
    assert(errCatRes.status === 400, 'POST /products -> Blocks product creation without categoryId (400)');

    // Edge Case 4.3: Invalid Selling Price (0 or negative)
    const errPriceRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ categoryId: categoryIdA, subCategoryId: subCategoryIdA, name: 'Free Phone', sellingPrice: 0 })
    });
    assert(errPriceRes.status === 400, 'POST /products -> Blocks product creation with zero/negative selling price (400)');

    // Edge Case 4.4: Negative Purchase Price
    const errPurchaseRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ categoryId: categoryIdA, subCategoryId: subCategoryIdA, name: 'Phone', hsnCode: '8471', sellingPrice: 1000, purchasePrice: -500 })
    });
    assert(errPurchaseRes.status === 400, 'POST /products -> Blocks product creation with negative purchase price (400)');

    // Edge Case 4.5: Missing HSN Code
    const errHsnRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ categoryId: categoryIdA, subCategoryId: subCategoryIdA, name: 'No HSN Product', sellingPrice: 500 })
    });
    assert(errHsnRes.status === 400, 'POST /products -> Blocks product creation without HSN Code (400)');

    // Edge Case 4.6: SubCategory does not belong to Category
    const errMismatchRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ categoryId: categoryIdA, subCategoryId: subCategoryIdB, name: 'Mismatch Product', hsnCode: '8471', sellingPrice: 1000 })
    });
    assert(errMismatchRes.status === 404 || errMismatchRes.status === 400, 'POST /products -> Blocks creation when subCategory does not belong to Category');

    // Edge Case 4.7: Missing required dynamic field 'IMEI Number'
    const errDynamicRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        categoryId: categoryIdA,
        subCategoryId: subCategoryIdA,
        name: 'iPhone 15 Pro',
        hsnCode: '8471',
        sellingPrice: 130000,
        additionalValues: { 'Storage RAM': '8GB' } // Omitted 'IMEI Number'
      })
    });
    assert(errDynamicRes.status === 400, 'POST /products -> Blocks creation when required dynamic custom field is missing');

    // ------------------------------------------------------------------
    // STEP 5: VALID CREATIONS, SKU UNIQUE CHECKS & TENANT ISOLATION
    // ------------------------------------------------------------------
    console.log('\n✨ Step 5: Testing Valid Product Creation, Unique SKU & Tenant Isolation...');

    const sharedSku = `SKU-SHARED-${timeId}`;

    // Create Product 1 (Vendor 1) with specific SKU & HSN Code & Opening Stock = 15
    const p1Res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        categoryId: categoryIdA,
        subCategoryId: subCategoryIdA,
        name: 'Samsung Galaxy Ultra',
        brand: 'Samsung',
        unit: 'Pcs',
        sku: sharedSku,
        hsnCode: '84713010',
        purchasePrice: 90000,
        sellingPrice: 110000,
        openingStock: 15,
        minStockLevel: 5,
        maxStockLevel: 50,
        expiryDate: '2027-12-31',
        additionalValues: { 'IMEI Number': '358911122233344', 'Storage RAM': '12GB' }
      })
    });
    const p1Data = await p1Res.json();
    if (!p1Res.ok) console.log('   [DEBUG p1Res Error]:', p1Res.status, JSON.stringify(p1Data));
    const product1Id = p1Data.data?.id;
    assert(p1Res.status === 201 && product1Id && p1Data.data?.hsnCode === '84713010', 'POST /products -> Successfully created Product 1 with HSN Code for Vendor 1');

    // Duplicate SKU in same Vendor 1 tenant -> Expect 400
    const dupSkuRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        categoryId: categoryIdA,
        subCategoryId: subCategoryIdA,
        name: 'Samsung Galaxy Duplicate SKU',
        sku: sharedSku,
        hsnCode: '84713010',
        sellingPrice: 110000,
        expiryDate: '2027-12-31',
        additionalValues: { 'IMEI Number': '358911122233345' }
      })
    });
    assert(dupSkuRes.status === 400, 'POST /products -> Blocked duplicate SKU within same store (400)');

    // Multiple products CAN share same HSN Code in same store
    const sameHsnRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        categoryId: categoryIdA,
        subCategoryId: subCategoryIdA,
        name: 'Samsung Galaxy Diff SKU Same HSN',
        sku: `SKU-DIFF-${timeId}`,
        hsnCode: '84713010', // Same HSN as Product 1
        sellingPrice: 115000,
        expiryDate: '2027-12-31',
        additionalValues: { 'IMEI Number': '358911122233346' }
      })
    });
    assert(sameHsnRes.status === 201, 'POST /products -> Allowed non-unique HSN Code across multiple products');

    // Auto-generation of SKU when omitted
    const p2Res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        categoryId: categoryIdB,
        subCategoryId: subCategoryIdB,
        name: 'Potato Chips Pack',
        brand: 'Lays',
        unit: 'Pkt',
        hsnCode: '19059040',
        purchasePrice: 15,
        sellingPrice: 20,
        openingStock: 50,
        minStockLevel: 10
      })
    });
    const p2Data = await p2Res.json();
    const product2Id = p2Data.data?.id;
    assert(
      p2Res.status === 201 && p2Data.data?.sku?.startsWith('SKU-'),
      'POST /products -> Saved auto-generated SKU when omitted'
    );

    // Tenant Isolation Test: Vendor 2 creates a product with SAME SKU as Vendor 1!
    const v2ProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v2Headers,
      body: JSON.stringify({
        categoryId: categoryIdA,
        subCategoryId: subCategoryIdA,
        name: 'Vendor 2 Galaxy Phone',
        sku: sharedSku, // Same SKU as Vendor 1
        hsnCode: '84713010',
        sellingPrice: 105000,
        expiryDate: '2027-12-31',
        additionalValues: { 'IMEI Number': '999911122233344' }
      })
    });
    assert(
      v2ProdRes.status === 201,
      'TENANT ISOLATION -> Vendor 2 can use same SKU as Vendor 1 without conflict'
    );

    // ------------------------------------------------------------------
    // STEP 6: SKU LOOKUP API
    // ------------------------------------------------------------------
    console.log('\n📷 Step 6: Testing SKU Lookup API...');

    // Lookup by SKU
    const scanSkuRes = await fetch(`${BASE_URL}/products/barcode/${sharedSku}`, { headers: v1Headers });
    const scanSkuData = await scanSkuRes.json();
    assert(
      scanSkuRes.status === 200 && scanSkuData.data?.id === product1Id,
      'GET /products/barcode/:sku -> Successfully found product by SKU code'
    );

    // Non-existent SKU -> Expect 404
    const scan404Res = await fetch(`${BASE_URL}/products/barcode/SKU-NONEXISTENT`, { headers: v1Headers });
    assert(scan404Res.status === 404, 'GET /products/barcode/:invalid -> Returns 404 when SKU not found');

    // ------------------------------------------------------------------
    // STEP 7: LOW STOCK ALERTS API
    // ------------------------------------------------------------------
    console.log('\n⚠️ Step 7: Testing Low Stock Detection & Alerts...');

    // Create a product with currentStock (2) <= minStockLevel (5)
    const lowStockProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        categoryId: categoryIdB,
        subCategoryId: subCategoryIdB,
        name: 'Limited Edition Candy',
        hsnCode: '21069099',
        sellingPrice: 50,
        openingStock: 2,
        minStockLevel: 5
      })
    });
    const lowStockProdData = await lowStockProdRes.json();
    const lowStockProductId = lowStockProdData.data?.id;

    const getLowStockRes = await fetch(`${BASE_URL}/products/low-stock`, { headers: v1Headers });
    const getLowStockData = await getLowStockRes.json();
    assert(
      getLowStockRes.status === 200 &&
      Array.isArray(getLowStockData.data) &&
      getLowStockData.data.some(p => p.id === lowStockProductId),
      'GET /products/low-stock -> Correctly identifies product with stock below minStockLevel'
    );

    // ------------------------------------------------------------------
    // STEP 8: PRODUCT DETAILS & STOCK AUDIT TRAIL
    // ------------------------------------------------------------------
    console.log('\n📖 Step 8: Testing Product Details & Stock Audit Trail...');

    // Valid Product 1 Details (Vendor 1)
    const detailsRes = await fetch(`${BASE_URL}/products/${product1Id}`, { headers: v1Headers });
    const detailsData = await detailsRes.json();
    assert(
      detailsRes.status === 200 &&
      detailsData.data?.id === product1Id &&
      detailsData.data?.stockHistory?.length >= 1 &&
      detailsData.data?.stockHistory[0].addedRemovedQty === 15,
      'GET /products/:id -> Returns full details with StockHistory initial record'
    );

    // Cross-Tenant Details Access: Vendor 2 attempts to fetch Vendor 1 Product 1 -> Expect 404
    const crossTenantDetailsRes = await fetch(`${BASE_URL}/products/${product1Id}`, { headers: v2Headers });
    assert(
      crossTenantDetailsRes.status === 404,
      'TENANT SECURITY -> Vendor 2 blocked from accessing Vendor 1 product details (404)'
    );

    // ------------------------------------------------------------------
    // STEP 9: UPDATE PRODUCT & EDGE CASES
    // ------------------------------------------------------------------
    console.log('\n✏️ Step 9: Testing Update Product & Validation Edge Cases...');

    // Valid Update: Prices & Description
    const updateRes = await fetch(`${BASE_URL}/products/${product1Id}`, {
      method: 'PUT',
      headers: v1Headers,
      body: JSON.stringify({
        sellingPrice: 108000,
        description: 'Updated Galaxy Ultra description'
      })
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 && updateData.data?.sellingPrice === 108000 && updateData.data?.description.includes('Updated'),
      'PUT /products/:id -> Successfully updated product selling price and description'
    );

    // Update SKU of Product 2 to Product 1's SKU -> Expect 400 (Duplicate SKU conflict)
    const dupUpdateSkuRes = await fetch(`${BASE_URL}/products/${product2Id}`, {
      method: 'PUT',
      headers: v1Headers,
      body: JSON.stringify({ sku: sharedSku })
    });
    assert(dupUpdateSkuRes.status === 400, 'PUT /products/:id -> Blocked updating SKU to an existing SKU of another product (400)');

    // Update Product 1 SKU to its own SKU -> Expect 200 (Allowed)
    const ownUpdateSkuRes = await fetch(`${BASE_URL}/products/${product1Id}`, {
      method: 'PUT',
      headers: v1Headers,
      body: JSON.stringify({ sku: sharedSku })
    });
    assert(ownUpdateSkuRes.status === 200, 'PUT /products/:id -> Allowed updating product retaining its own existing SKU');

    // ------------------------------------------------------------------
    // STEP 10: PRODUCT LISTING, SEARCH, KPI SUMMARY & STATUS FILTERS
    // ------------------------------------------------------------------
    console.log('\n📊 Step 10: Testing Product Listing, Pagination, KPI Aggregation & Search...');

    const listRes = await fetch(`${BASE_URL}/products?page=1&limit=10&search=Galaxy`, { headers: v1Headers });
    const listData = await listRes.json();
    const itemsList = listData.data?.items || listData.data?.products || [];
    const summaryData = listData.data?.summary || {};
    assert(
      listRes.status === 200 &&
      Array.isArray(itemsList) && itemsList.length >= 1 &&
      summaryData.totalProducts >= 1 &&
      summaryData.totalStockValue > 0,
      'GET /products -> Listed products with search filter & calculated KPI summary metrics (totalStockValue)'
    );

    const listLowStockFilterRes = await fetch(`${BASE_URL}/products?status=LOW_STOCK`, { headers: v1Headers });
    const listLowStockFilterData = await listLowStockFilterRes.json();
    const lowStockItemsList = listLowStockFilterData.data?.items || listLowStockFilterData.data?.products || [];
    assert(
      listLowStockFilterRes.status === 200 &&
      Array.isArray(lowStockItemsList) &&
      lowStockItemsList.some(p => p.id === lowStockProductId),
      'GET /products?status=LOW_STOCK -> Successfully filters low stock products'
    );

    // ------------------------------------------------------------------
    // STEP 11: ROLE-BASED ACCESS CONTROL & SOFT DELETION
    // ------------------------------------------------------------------
    console.log('\n🔒 Step 11: Testing Role-Based Deletion & Reusing Barcodes...');

    // Employee role attempts deletion -> Expect 403 Forbidden
    const empDeleteRes = await fetch(`${BASE_URL}/products/${lowStockProductId}`, {
      method: 'DELETE',
      headers: empHeaders
    });
    assert(empDeleteRes.status === 403, 'RBAC SECURITY -> Employee token blocked from deleting product (403)');

    // Vendor Admin role deletes product -> Expect 200 OK
    const adminDeleteRes = await fetch(`${BASE_URL}/products/${lowStockProductId}`, {
      method: 'DELETE',
      headers: v1Headers
    });
    assert(adminDeleteRes.status === 200, 'DELETE /products/:id -> Vendor Store Admin successfully soft deletes product');

    // Verify barcode search no longer finds soft-deleted product
    const postDeleteScanRes = await fetch(`${BASE_URL}/products/barcode/${lowStockProductId}`, { headers: v1Headers });
    assert(postDeleteScanRes.status === 404, 'SOFT DELETE VERIFICATION -> Soft-deleted product hidden from barcode scanner');

    // ------------------------------------------------------------------
    // STEP 12: BULK IMPORT OPERATIONS
    // ------------------------------------------------------------------
    console.log('\n📥 Step 12: Testing Bulk Products Import...');

    // Empty bulk import -> Expect 400
    const emptyImportRes = await fetch(`${BASE_URL}/products/import`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({ products: [] })
    });
    assert(emptyImportRes.status === 400, 'POST /products/import -> Blocks bulk import with empty products array (400)');

    // Valid bulk import
    const validImportRes = await fetch(`${BASE_URL}/products/import`, {
      method: 'POST',
      headers: v1Headers,
      body: JSON.stringify({
        products: [
          { name: `Bulk Product A ${timeId}`, sellingPrice: 100, openingStock: 20 },
          { name: `Bulk Product B ${timeId}`, sellingPrice: 200, openingStock: 10 },
          { name: `Bulk Product C ${timeId}`, sellingPrice: 300, openingStock: 5 }
        ]
      })
    });
    const validImportData = await validImportRes.json();
    assert(
      validImportRes.status === 201 && validImportData.data?.importedCount === 3,
      'POST /products/import -> Successfully imported 3 bulk product records'
    );

    // ------------------------------------------------------------------
    // STEP 13: EXPORT DATASET FORMATS (JSON, CSV, EXCEL)
    // ------------------------------------------------------------------
    console.log('\n📤 Step 13: Testing Product Export (JSON, CSV, EXCEL)...');

    // JSON Export
    const exportJsonRes = await fetch(`${BASE_URL}/products/export?format=json`, { headers: v1Headers });
    const exportJsonData = await exportJsonRes.json();
    assert(
      exportJsonRes.status === 200 && Array.isArray(exportJsonData.data),
      'GET /products/export?format=json -> Returns JSON export dataset'
    );

    // CSV Export
    const exportCsvRes = await fetch(`${BASE_URL}/products/export?format=csv`, { headers: v1Headers });
    const csvContentType = exportCsvRes.headers.get('content-type');
    assert(
      exportCsvRes.status === 200 && csvContentType?.includes('text/csv'),
      'GET /products/export?format=csv -> Streams CSV file with text/csv header'
    );

    // Excel Export
    const exportExcelRes = await fetch(`${BASE_URL}/products/export?format=excel`, { headers: v1Headers });
    const excelContentType = exportExcelRes.headers.get('content-type');
    assert(
      exportExcelRes.status === 200 && (excelContentType?.includes('spreadsheetml') || excelContentType?.includes('excel')),
      'GET /products/export?format=excel -> Streams Excel file with spreadsheet header'
    );

    // ------------------------------------------------------------------
    // FINAL TEST RESULTS SUMMARY
    // ------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 MASTER DEEP PRODUCT MODULE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('🎉 ALL PRODUCT MODULE CRUD & EDGE CASE TESTS PASSED PERFECTLY! 100% SUCCESS!');
    } else {
      console.error(`💥 ${failed} TEST(S) FAILED. PLEASE INSPECT LOGS ABOVE.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ FATAL EXCEPTION DURING TEST RUN:', error);
    process.exit(1);
  }
}

testMasterDeepProductModule();
