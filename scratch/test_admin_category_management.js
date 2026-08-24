import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  createSubCategory,
  getSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
  addAdditionalField,
  updateAdditionalField,
  deleteAdditionalField
} from '../src/modules/admin/category/category.service.js';
import { prisma } from '../src/config/prisma.js';

async function runCategoryManagementTests() {
  console.log('🧪 --- STARTING MASTER CATEGORY, SUB-CATEGORY & DYNAMIC FIELDS TESTS ---\n');

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
    // Cleanup any existing test category
    await prisma.category.deleteMany({ where: { name: { contains: 'Test Category' } } });

    // 1. Create Category
    console.log('1️⃣ Testing Master Category Creation...');
    const cat = await createCategory('Test Category Electronics', 'Gadgets and hardware items');
    assert(cat.id && cat.name === 'Test Category Electronics', 'Created Master Category successfully.');

    // Duplicate Category Name check
    try {
      await createCategory('Test Category Electronics', 'Duplicate test');
      assert(false, 'Creating duplicate category should throw error');
    } catch (err) {
      assert(err.statusCode === 400, `Duplicate Category correctly blocked ("${err.message}")`);
    }

    // 2. Get & Search Categories
    console.log('\n2️⃣ Testing Categories Listing & Search...');
    const catList = await getCategories('Electronics');
    assert(catList.length >= 1 && catList.some(c => c.id === cat.id), 'Search returns matching Category.');

    // 3. Update Category
    console.log('\n3️⃣ Testing Category Update...');
    const updatedCat = await updateCategory(cat.id, { description: 'Updated description for gadgets' });
    assert(updatedCat.description === 'Updated description for gadgets', 'Category updated successfully.');

    // 4. Create Sub-Category with Expiry Date Toggle
    console.log('\n4️⃣ Testing Sub-Category Creation with Expiry Date Toggle...');
    const subCat = await createSubCategory(cat.id, 'Test Sub Smart Phones', 'Mobile devices', true);
    assert(
      subCat.id && subCat.enableExpiryDate === true,
      'Sub-Category created with enableExpiryDate = true.'
    );

    // 5. Get Sub-Categories by Parent Category
    console.log('\n5️⃣ Testing Sub-Categories Listing...');
    const subList = await getSubCategories(cat.id);
    assert(subList.length === 1 && subList[0].id === subCat.id, 'Sub-Categories list matches parent category.');

    // 6. Update Sub-Category
    console.log('\n6️⃣ Testing Sub-Category Update...');
    const updatedSubCat = await updateSubCategory(subCat.id, { enableExpiryDate: false });
    assert(updatedSubCat.enableExpiryDate === false, 'Sub-Category updated successfully (enableExpiryDate set to false).');

    // 7. Add Dynamic Custom Fields
    console.log('\n7️⃣ Testing Dynamic Custom Field Creation...');
    const field1 = await addAdditionalField(subCat.id, {
      labelName: 'RAM Capacity',
      inputType: 'TEXT',
      isRequired: true,
      status: 'ACTIVE'
    });
    assert(field1.id && field1.labelName === 'RAM Capacity' && field1.isRequired === true, 'Added RAM Capacity custom field.');

    const field2 = await addAdditionalField(subCat.id, {
      labelName: 'Storage (GB)',
      inputType: 'NUMBER',
      isRequired: false,
      status: 'ACTIVE'
    });
    assert(field2.id && field2.inputType === 'NUMBER', 'Added Storage (GB) custom field.');

    // 8. Update Custom Field
    console.log('\n8️⃣ Testing Custom Field Update...');
    const updatedField = await updateAdditionalField(field1.id, { labelName: 'RAM Memory (GB)' });
    assert(updatedField.labelName === 'RAM Memory (GB)', 'Updated custom field label successfully.');

    // 9. Fetch Deep Sub-Category Details
    console.log('\n9️⃣ Testing Deep Sub-Category Details Fetch...');
    const deepSub = await getSubCategoryById(subCat.id);
    assert(
      deepSub.additionalFields.length === 2,
      `Sub-Category includes all ${deepSub.additionalFields.length} dynamic custom fields.`
    );

    // 10. Delete Custom Field
    console.log('\n🔟 Testing Custom Field Deletion...');
    const deleteFieldRes = await deleteAdditionalField(field2.id);
    assert(deleteFieldRes.success === true, 'Deleted custom field successfully.');

    // 11. Delete Sub-Category
    console.log('\n1️⃣1️⃣ Testing Sub-Category Deletion...');
    const deleteSubRes = await deleteSubCategory(subCat.id);
    assert(deleteSubRes.success === true, 'Deleted sub-category successfully.');

    // 12. Delete Category
    console.log('\n1️⃣2️⃣ Testing Master Category Deletion...');
    const deleteCatRes = await deleteCategory(cat.id);
    assert(deleteCatRes.success === true, 'Deleted master category successfully.');

    console.log(`\n📊 SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL MASTER CATEGORY, SUB-CATEGORY & DYNAMIC FIELD TESTS PASSED PERFECTLY ---');
    } else {
      console.error('❌ Some category tests failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Category test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCategoryManagementTests();
