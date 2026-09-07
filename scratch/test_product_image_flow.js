import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { createProduct, updateProduct } from '../src/modules/product/product.service.js';

async function testFullProductImageFlow() {
  console.log('--- Testing Product Image Upload Flow ---');

  try {
    // Fetch a tenant and category/subcategory to use
    const tenant = await prisma.tenant.findFirst();
    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    const category = await prisma.category.findFirst({ include: { subCategories: true } });
    
    if (!tenant || !category || !category.subCategories[0]) {
      console.log('Skipping DB integration test: No tenant/category found in DB.');
      return;
    }

    const subCategory = category.subCategories[0];
    console.log(`Using Tenant: ${tenant.id}, Category: ${category.name}, SubCategory: ${subCategory.name}`);

    // Create product with mock Multer file
    const sampleBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const mockFile = {
      fieldname: 'productImage',
      originalname: 'product_test.png',
      mimetype: 'image/png',
      buffer: sampleBuffer,
      size: sampleBuffer.length
    };

    console.log('\n1. Creating Product with Image Upload (Multer buffer)...');
    const newProduct = await createProduct(tenant.id, user.id, {
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: `Test Image Product ${Date.now()}`,
      hsnCode: '8517',
      sellingPrice: 499,
      purchasePrice: 300,
      productImage: mockFile
    });

    console.log('✅ Product Created Successfully!');
    console.log('Product ID:', newProduct.id);
    console.log('Product Image URL:', newProduct.productImage);

    console.log('\n2. Updating Product Image with Base64 String...');
    const updatedProduct = await updateProduct(tenant.id, newProduct.id, {
      productImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });

    console.log('✅ Product Updated Successfully!');
    console.log('Updated Image URL:', updatedProduct.productImage);

    // Clean up created test product
    await prisma.product.delete({ where: { id: newProduct.id } });
    console.log('\nCleaned up test product.');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testFullProductImageFlow();
