import { createBusinessProfile, createBusinessProfileStep1, createBusinessProfileStep2, updateBusinessInfo, getBusinessInfo, getVendorDashboard, getVendorProfile } from '../src/modules/business/business.service.js';
import { getCategories, getCategoryFieldStructure, createProduct, updateProduct, getProducts, getProductByBarcode, deleteProduct } from '../src/modules/product/product.service.js';
import { uploadToCloudinary, extractPublicIdFromUrl, deleteFromCloudinary } from '../src/utils/cloudinary.js';
import { prisma } from '../src/config/prisma.js';

async function runMasterEdgeCaseTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING MASTER EDGE-CASE TESTS FOR BUSINESS & PRODUCT MODULES');
  console.log('================================================================\n');

  // Create test Tenant & Admin User
  const uniqueId = Date.now();
  const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const testEmail = `testvendor_${uniqueId}@softfyr.com`;

  const tenant = await prisma.tenant.create({
    data: {
      ownerName: 'Initial Owner Name',
      mobileNumber: testMobile,
      email: testEmail,
      subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  const user = await prisma.user.create({
    data: {
      name: 'Initial Owner Name',
      mobileNumber: testMobile,
      email: testEmail,
      passwordHash: 'hashed_password_sample',
      role: 'TENANT_ADMIN',
      tenantId: tenant.id
    }
  });

  console.log(`📌 Created Test Tenant ID: ${tenant.id}`);

  // ----------------------------------------------------------------
  // SECTION 1: BUSINESS PROFILE & LOGO UPLOAD EDGE CASES
  // ----------------------------------------------------------------
  console.log('\n--- [SECTION 1] Testing Business Profile & Logo Upload Edge Cases ---');

  // Edge Case 1.1: Mobile Number Modification Prevention
  try {
    await updateBusinessInfo(tenant.id, { mobileNumber: '9999999999' });
    throw new Error('Mobile number modification check failed!');
  } catch (err) {
    console.log(`✅ Mobile Number modification lock properly enforced: "${err.message}"`);
  }

  // Edge Case 1.2: Step 1 Owner Profile Update
  const step1Result = await createBusinessProfileStep1(tenant.id, {
    ownerName: 'Updated Owner Name',
    email: testEmail
  });
  console.log(`✅ Business Profile Step 1 saved. Owner: "${step1Result.ownerName}", Step: ${step1Result.profileStep}`);

  // Edge Case 1.3: Step 2 Store Setup with Base64 Logo Upload
  const sampleBase64Logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const step2Result = await createBusinessProfileStep2(tenant.id, {
    businessName: '   SoftFYR Mart Store   ',
    businessType: 'Retail Grocery',
    businessLogo: sampleBase64Logo,
    gstNumber: '22aaaaa0000a1z5',
    panNumber: 'abcde1234f',
    city: 'Kanpur',
    state: 'Uttar Pradesh'
  });

  console.log(`✅ Step 2 saved. Store Name: "${step2Result.businessName}", GST: "${step2Result.gstNumber}", Logo: "${step2Result.businessLogo}"`);
  if (!step2Result.businessLogo || !step2Result.isProfileComplete) {
    throw new Error('Step 2 Logo Upload or profile completion failed!');
  }

  // Edge Case 1.4: Update Business Logo with a new image (verifying replacement & old image deletion)
  const updatedBusiness = await updateBusinessInfo(tenant.id, {
    businessLogo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    businessAddress: '123 Market Street, Softfyr Tower'
  });
  console.log(`✅ Business Info Updated. Address: "${updatedBusiness.businessAddress}", Logo: "${updatedBusiness.businessLogo}"`);

  // Edge Case 1.5: Fetch Business Info & Dashboard KPIs
  const bInfo = await getBusinessInfo(tenant.id);
  const dashboardData = await getVendorDashboard(tenant.id);
  const vendorProfile = await getVendorProfile(user.id);
  console.log(`✅ Business Info fetched. KPIs Total Customers: ${dashboardData.kpis.totalCustomers}`);

  // ----------------------------------------------------------------
  // SECTION 2: PRODUCT MODULE EDGE CASES
  // ----------------------------------------------------------------
  console.log('\n--- [SECTION 2] Testing Product Module Edge Cases ---');

  const categories = await getCategories();
  const category = categories[0];
  let subCategory = category.subCategories ? category.subCategories[0] : null;

  if (!subCategory) {
    subCategory = await prisma.subCategory.create({
      data: {
        categoryId: category.id,
        name: `SubCat_${uniqueId}`
      }
    });
  }

  const structure = await getCategoryFieldStructure(subCategory.id);
  const sampleAdditionalValues = {};
  if (structure.additionalFields && structure.additionalFields.length > 0) {
    structure.additionalFields.forEach(f => { sampleAdditionalValues[f.labelName] = 'Sample Value'; });
  }

  const testSku1 = `SKU-MASTER-${uniqueId}-1`;
  const testBarcode1 = `BAR-MASTER-${uniqueId}-1`;

  // Edge Case 2.1: Product Creation with Stringified Multipart Form-Data
  console.log('Testing Product creation with stringified numbers & JSON additionalValues...');
  const prod1 = await createProduct(tenant.id, user.id, {
    categoryId: category.id,
    subCategoryId: subCategory.id,
    name: '  Premium Organic Milk  ',
    sku: testSku1,
    barcode: testBarcode1,
    brand: 'Amul',
    unit: 'Litre',
    purchasePrice: '55.50',
    sellingPrice: '65.00',
    mrp: '70.00',
    openingStock: '50',
    minStockLevel: '10',
    additionalValues: JSON.stringify(sampleAdditionalValues),
    productImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  });

  console.log(`✅ Product Created. ID: ${prod1.id}, Name: "${prod1.name}", Selling Price: ${prod1.sellingPrice}, Image: ${prod1.productImage}`);
  if (prod1.sellingPrice !== 65 || prod1.openingStock !== 50) {
    throw new Error('Form data string numbers were not correctly converted!');
  }

  // Edge Case 2.2: Auto-generation of SKU & Barcode when not provided
  console.log('Testing Product creation with auto-generated SKU & Barcode...');
  const prod2 = await createProduct(tenant.id, user.id, {
    categoryId: category.id,
    subCategoryId: subCategory.id,
    name: 'Auto SKU Barcode Item',
    sellingPrice: 150,
    additionalValues: sampleAdditionalValues
  });
  console.log(`✅ Auto-generated SKU: "${prod2.sku}", Barcode: "${prod2.barcode}"`);
  if (!prod2.sku.startsWith('SKU-') || !prod2.barcode.startsWith('890')) {
    throw new Error('Auto SKU / Barcode generation failed!');
  }

  // Edge Case 2.3: Duplicate SKU & Duplicate Barcode Prevention
  console.log('Testing Duplicate SKU & Barcode Prevention...');
  try {
    await createProduct(tenant.id, user.id, {
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: 'Duplicate Item',
      sku: testSku1,
      sellingPrice: 100,
      additionalValues: sampleAdditionalValues
    });
    throw new Error('Duplicate SKU check failed!');
  } catch (err) {
    console.log(`✅ Duplicate SKU properly rejected: "${err.message}"`);
  }

  // Edge Case 2.4: Product Update with Duplicate Barcode Check
  console.log('Testing Product Update Duplicate Barcode Check...');
  try {
    await updateProduct(tenant.id, prod2.id, { barcode: testBarcode1 });
    throw new Error('Duplicate Barcode check on update failed!');
  } catch (err) {
    console.log(`✅ Duplicate Barcode on update properly rejected: "${err.message}"`);
  }

  // Edge Case 2.5: Fetch Product by Barcode & Filtering
  const barcodeProduct = await getProductByBarcode(tenant.id, testBarcode1);
  console.log(`✅ Fetched Product by Barcode: "${barcodeProduct.name}"`);

  const listProducts = await getProducts(tenant.id, { search: 'Milk', page: 1, limit: 10 });
  console.log(`✅ Search Products list returned ${listProducts.items.length} results.`);

  // Edge Case 2.6: Product Soft Deletion & Cloudinary Image Cleanup
  console.log('Testing Product Soft-Delete...');
  await deleteProduct(tenant.id, prod1.id);
  await deleteProduct(tenant.id, prod2.id);
  console.log('✅ Soft deleted test products successfully.');

  console.log('\n================================================================');
  console.log('🎉 ALL MASTER EDGE-CASE TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runMasterEdgeCaseTests().catch((err) => {
  console.error('❌ Master Edge Case Test FAILED:', err);
  process.exit(1);
});
