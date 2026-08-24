const BASE_URL = 'http://localhost:5000/api/v1';

async function runE2ECategoryModuleTest() {
  console.log('🧪 --- STARTING COMPREHENSIVE CATEGORY MODULE E2E HTTP INTEGRATION TEST ---\n');

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
    // 0. Super Admin Login to get Token
    console.log('0️⃣ Logging in Super Admin (POST /auth/admin/login)...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    assert(adminResSuccess(adminLoginRes, adminToken), 'Super Admin logged in successfully.');

    function adminResSuccess(res, token) {
      return res.status === 200 && Boolean(token);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // --- CATEGORY HTTP TESTS ---
    console.log('\n📌 SECTION 1: Master Category Endpoints');

    // 1.1 Create Master Category
    const createCatRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'E2E Electronics Category',
        description: 'Laptops, Smartphones, and Appliances'
      })
    });
    const createCatData = await createCatRes.json();
    const categoryId = createCatData.data?.id;

    assert(
      createCatRes.status === 201 && categoryId && createCatData.data.name === 'E2E Electronics Category',
      'POST /admin/categories -> Created Master Category successfully.'
    );

    // 1.2 Duplicate Category Error check
    const dupCatRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'E2E Electronics Category' })
    });
    const dupCatData = await dupCatRes.json();
    assert(
      dupCatRes.status === 400 && dupCatData.message.includes('already exists'),
      `POST /admin/categories -> Duplicate Category blocked with 400 Bad Request ("${dupCatData.message}")`
    );

    // 1.3 List All Categories with Search Query
    const listCatRes = await fetch(`${BASE_URL}/admin/categories?search=Electronics`, { headers });
    const listCatData = await listCatRes.json();
    assert(
      listCatRes.status === 200 && Array.isArray(listCatData.data) && listCatData.data.some(c => c.id === categoryId),
      'GET /admin/categories?search=Electronics -> Returns matching Category list.'
    );

    // 1.4 Get Category Details by ID
    const getCatRes = await fetch(`${BASE_URL}/admin/categories/${categoryId}`, { headers });
    const getCatData = await getCatRes.json();
    assert(
      getCatRes.status === 200 && getCatData.data.id === categoryId,
      'GET /admin/categories/:id -> Returns exact Category details.'
    );

    // 1.5 Update Category
    const updateCatRes = await fetch(`${BASE_URL}/admin/categories/${categoryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ description: 'Updated description for E2E Electronics' })
    });
    const updateCatData = await updateCatRes.json();
    assert(
      updateCatRes.status === 200 && updateCatData.data.description === 'Updated description for E2E Electronics',
      'PUT /admin/categories/:id -> Updated Category description successfully.'
    );

    // --- SUB-CATEGORY HTTP TESTS ---
    console.log('\n📌 SECTION 2: Sub-Category Endpoints (with Expiry Date Toggle)');

    // 2.1 Create Sub-Category
    const createSubRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        categoryId,
        name: 'E2E Smartphones Sub-Category',
        description: '5G Mobile Handsets',
        enableExpiryDate: true
      })
    });
    const createSubData = await createSubRes.json();
    const subCategoryId = createSubData.data?.id;

    assert(
      createSubRes.status === 201 && subCategoryId && createSubData.data.enableExpiryDate === true,
      'POST /admin/sub-categories -> Created Sub-Category with enableExpiryDate = true.'
    );

    // 2.2 Get Sub-Categories by Parent Category
    const listSubRes = await fetch(`${BASE_URL}/admin/sub-categories?categoryId=${categoryId}`, { headers });
    const listSubData = await listSubRes.json();
    assert(
      listSubRes.status === 200 && Array.isArray(listSubData.data) && listSubData.data.some(s => s.id === subCategoryId),
      'GET /admin/sub-categories?categoryId=... -> Returns parent Sub-Categories.'
    );

    // 2.3 Get Sub-Category Details by ID
    const getSubRes = await fetch(`${BASE_URL}/admin/sub-categories/${subCategoryId}`, { headers });
    const getSubData = await getSubRes.json();
    assert(
      getSubRes.status === 200 && getSubData.data.id === subCategoryId,
      'GET /admin/sub-categories/:id -> Returns Sub-Category details.'
    );

    // 2.4 Update Sub-Category Toggle
    const updateSubRes = await fetch(`${BASE_URL}/admin/sub-categories/${subCategoryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ enableExpiryDate: false })
    });
    const updateSubData = await updateSubRes.json();
    assert(
      updateSubRes.status === 200 && updateSubData.data.enableExpiryDate === false,
      'PUT /admin/sub-categories/:id -> Updated enableExpiryDate toggle to false.'
    );

    // --- DYNAMIC CUSTOM FIELDS HTTP TESTS ---
    console.log('\n📌 SECTION 3: Dynamic Additional Fields Endpoints');

    // 3.1 Add Custom Field
    const addFieldRes = await fetch(`${BASE_URL}/admin/sub-categories/${subCategoryId}/fields`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        labelName: 'RAM Capacity (GB)',
        inputType: 'TEXT',
        isRequired: true,
        status: 'ACTIVE'
      })
    });
    const addFieldData = await addFieldRes.json();
    const fieldId = addFieldData.data?.id;

    assert(
      addFieldRes.status === 201 && fieldId && addFieldData.data.labelName === 'RAM Capacity (GB)',
      'POST /admin/sub-categories/:subCategoryId/fields -> Added dynamic custom field.'
    );

    // 3.2 Update Custom Field
    const updateFieldRes = await fetch(`${BASE_URL}/admin/sub-categories/fields/${fieldId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ labelName: 'RAM Memory (GB)' })
    });
    const updateFieldData = await updateFieldRes.json();
    assert(
      updateFieldRes.status === 200 && updateFieldData.data.labelName === 'RAM Memory (GB)',
      'PUT /admin/sub-categories/fields/:fieldId -> Updated custom field label successfully.'
    );

    // 3.3 Delete Custom Field
    const deleteFieldRes = await fetch(`${BASE_URL}/admin/sub-categories/fields/${fieldId}`, {
      method: 'DELETE',
      headers
    });
    const deleteFieldData = await deleteFieldRes.json();
    assert(
      deleteFieldRes.status === 200 && deleteFieldData.data.success === true,
      'DELETE /admin/sub-categories/fields/:fieldId -> Deleted custom field successfully.'
    );

    // --- CLEANUP ---
    console.log('\n📌 SECTION 4: Sub-Category & Category Cleanup');

    // Delete Sub-Category
    const deleteSubRes = await fetch(`${BASE_URL}/admin/sub-categories/${subCategoryId}`, {
      method: 'DELETE',
      headers
    });
    assert(deleteSubRes.status === 200, 'DELETE /admin/sub-categories/:id -> Sub-Category deleted.');

    // Delete Category
    const deleteCatRes = await fetch(`${BASE_URL}/admin/categories/${categoryId}`, {
      method: 'DELETE',
      headers
    });
    assert(deleteCatRes.status === 200, 'DELETE /admin/categories/:id -> Master Category deleted.');

    console.log(`\n📊 E2E TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- CATEGORY MODULE E2E HTTP INTEGRATION TESTS PASSED 100% PERFECTLY ---');
    } else {
      console.error('❌ Some E2E tests failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ E2E test failed with error:', error);
    process.exit(1);
  }
}

runE2ECategoryModuleTest();
