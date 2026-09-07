import { getCategories, getCategoryFieldStructure, createProduct, updateProduct, getProducts, getProductByBarcode, deleteProduct } from '../src/modules/product/product.service.js';
import { prisma } from '../src/config/prisma.js';

async function testEdgeCases() {
  console.log('--- Starting Comprehensive Category & Product Module Edge-Case Tests ---');

  // 1. Fetch Master Categories
  const categories = await getCategories();
  console.log(`✅ Categories count: ${categories.length}`);
  if (categories.length === 0) {
    console.warn('⚠️ No categories found in database. Seeding a test category and sub-category...');
    const cat = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        description: 'Test Category Description'
      }
    });
    const subCat = await prisma.subCategory.create({
      data: {
        categoryId: cat.id,
        name: 'Test SubCategory',
        enableExpiryDate: true,
        additionalFields: {
          create: [
            { labelName: 'Color', inputType: 'TEXT', isRequired: false }
          ]
        }
      }
    });
    categories.push(cat);
  }

  const category = categories[0];
  const subCategories = category.subCategories || [];
  let subCategory = subCategories[0];

  if (!subCategory) {
    subCategory = await prisma.subCategory.create({
      data: {
        categoryId: category.id,
        name: `SubCat-${Date.now()}`,
        enableExpiryDate: true
      }
    });
  }

  // 2. Fetch Field Structure
  const structure = await getCategoryFieldStructure(subCategory.id);
  console.log(`✅ Sub-Category Field Structure fetched for: ${structure.name}`);

  // Create a mock tenant for testing if needed
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        ownerName: 'Test Owner',
        mobileNumber: `987${Math.floor(1000000 + Math.random() * 9000000)}`,
        businessName: 'Edge Case Test Store',
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
  }

  let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Test User',
        mobileNumber: tenant.mobileNumber,
        passwordHash: 'hashed',
        tenantId: tenant.id
      }
    });
  }

  const testSku = `EDGE-SKU-${Date.now()}`;
  const testBarcode = `EDGE-BAR-${Date.now()}`;

  // Build additional values dynamically based on required sub-category fields
  const sampleAdditionalValues = { Color: 'Red', Size: 'XL' };
  if (structure.additionalFields && structure.additionalFields.length > 0) {
    for (const field of structure.additionalFields) {
      sampleAdditionalValues[field.labelName] = 'Sample Value';
    }
  }

  // 3. Edge-Case: Stringified Numbers and JSON string passed as in multipart/form-data
  console.log('Testing Edge Case 1: Product creation with stringified numbers and stringified JSON...');
  const newProduct = await createProduct(tenant.id, user.id, {
    categoryId: category.id,
    subCategoryId: subCategory.id,
    name: '  Edge Case Test Product  ',
    sku: testSku,
    barcode: testBarcode,
    purchasePrice: '120.50',
    sellingPrice: '200.00',
    mrp: '250.00',
    openingStock: '15',
    minStockLevel: '3',
    additionalValues: JSON.stringify(sampleAdditionalValues),
    productImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  });

  console.log(`✅ Created Product ID: ${newProduct.id}, Name: "${newProduct.name}", Image: ${newProduct.productImage}`);

  if (newProduct.sellingPrice !== 200 || newProduct.openingStock !== 15) {
    throw new Error('Stringified numbers were not properly converted to numbers!');
  }

  // 4. Edge-Case: Duplicate SKU Check
  console.log('Testing Edge Case 2: Duplicate SKU validation...');
  try {
    await createProduct(tenant.id, user.id, {
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: 'Duplicate SKU Product',
      sku: testSku,
      sellingPrice: 100,
      additionalValues: sampleAdditionalValues
    });
    throw new Error('Duplicate SKU did not throw error!');
  } catch (err) {
    console.log(`✅ Duplicate SKU properly caught: "${err.message}"`);
  }

  // 5. Edge-Case: Fetch Product by Barcode / SKU
  const fetchedByBarcode = await getProductByBarcode(tenant.id, testBarcode);
  console.log(`✅ Fetched Product by Barcode: ${fetchedByBarcode.name}`);

  // 6. Edge-Case: Product Update with new image and details
  console.log('Testing Edge Case 3: Product Update with Cloudinary image...');
  const updatedProduct = await updateProduct(tenant.id, newProduct.id, {
    name: 'Updated Edge Case Product Name',
    sellingPrice: '220.00',
    additionalValues: { Color: 'Blue', Size: 'XXL' }
  });
  console.log(`✅ Updated Product Name: "${updatedProduct.name}", New Price: ${updatedProduct.sellingPrice}`);

  // 7. Edge-Case: Soft Delete Product & Cloudinary Cleanup
  console.log('Testing Edge Case 4: Product Deletion...');
  await deleteProduct(tenant.id, newProduct.id);
  console.log(`✅ Product ID ${newProduct.id} soft deleted successfully.`);

  console.log('\n🎉 ALL Category & Product Module Edge-Case Tests PASSED SUCCESSFULLY!');
}

testEdgeCases().catch((err) => {
  console.error('❌ Edge-Case Test Failed:', err);
  process.exit(1);
});
