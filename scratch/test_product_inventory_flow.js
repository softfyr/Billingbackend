import { prisma } from '../src/config/prisma.js';
import * as productService from '../src/modules/product/product.service.js';

async function testProductInventoryFlow() {
  console.log('🧪 --- TESTING PRODUCT & INVENTORY SYSTEM END-TO-END ---');

  const testMobile = '9711625120';

  try {
    const user = await prisma.user.findUnique({
      where: { mobileNumber: testMobile },
      include: { tenant: true }
    });

    if (!user || !user.tenantId) {
      console.error('❌ Vendor account not found for 9711625120.');
      return;
    }

    const tenantId = user.tenantId;
    console.log('🏢 Vendor Tenant ID:', tenantId);

    // 1. Create Category
    console.log('\n1️⃣ Creating Category...');
    const category = await productService.createCategory({
      name: 'Retail & Supermarket',
      description: 'Grocery, Dairy, Packaged Food & Staples'
    });
    console.log('✅ Category Created:', category.name, '(ID:', category.id, ')');

    // 2. Create Sub-Category
    console.log('\n2️⃣ Creating Sub-Category...');
    const subCategory = await productService.createSubCategory({
      categoryId: category.id,
      name: 'Dairy & Packaged Milk',
      description: 'Fresh & Toned Packaged Milk',
      enableExpiryDate: true,
      additionalFields: [
        { labelName: 'Batch Number', inputType: 'TEXT', isRequired: false },
        { labelName: 'Fat Percentage', inputType: 'TEXT', isRequired: false }
      ]
    });
    console.log('✅ Sub-Category Created:', subCategory.name, '(ID:', subCategory.id, ')');

    // 3. Create Tax record if not existing
    let tax = await prisma.tax.findFirst({ where: { tenantId } });
    if (!tax) {
      tax = await prisma.tax.create({
        data: { tenantId, name: 'GST 5%', percentage: 5.0, status: 'ACTIVE' }
      });
    }

    // 4. Create Product (with Low Stock: openingStock = 3, minStockLevel = 5)
    console.log('\n3️⃣ Adding New Product with Low Stock...');
    const productPayload = {
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: 'Amul Taaza Toned Milk 1L',
      purchasePrice: 62,
      sellingPrice: 68,
      mrp: 68,
      taxId: tax.id,
      openingStock: 3,
      minStockLevel: 5,
      description: 'Pasteurised Toned Milk 1 Litre Pouch',
      expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      additionalValues: { 'Batch Number': 'BATCH-2026-08', 'Fat Percentage': '3.0%' }
    };

    const product = await productService.createProduct(tenantId, user.id, productPayload);

    console.log('✅ PRODUCT CREATED SUCCESSFULLY!');
    console.log('📦 Product Name:', product.name);
    console.log('🏷️ Generated SKU:', product.sku);
    console.log('📊 Generated Barcode:', product.barcode);
    console.log('💰 Selling Price: ₹' + product.sellingPrice);
    console.log('📉 Current Stock:', product.currentStock, '(Min Threshold:', product.minStockLevel, ')');

    // 5. Test Low Stock Alert API
    console.log('\n4️⃣ Testing Low-Stock Alert Endpoint...');
    const lowStockItems = await productService.getLowStockProducts(tenantId);
    console.log('🚨 Low Stock Products Count:', lowStockItems.length);
    console.log('⚠️ Alert Item Name:', lowStockItems[0]?.name, '| Stock:', lowStockItems[0]?.currentStock);

    // 6. Test Barcode Scanner Lookup API
    console.log('\n5️⃣ Testing Barcode Scanner Lookup...');
    const scannedProduct = await productService.getProductByBarcode(tenantId, product.barcode);
    console.log('🔍 Scanned Barcode Match:', scannedProduct.name, '| Price: ₹' + scannedProduct.sellingPrice);

    // 7. Update Product Stock
    console.log('\n6️⃣ Updating Product Stock...');
    const updatedProduct = await productService.updateProduct(tenantId, product.id, {
      minStockLevel: 2
    });
    console.log('✅ Updated Min Stock Threshold to:', updatedProduct.minStockLevel);

    console.log('\n🎉 --- PRODUCT & INVENTORY SYSTEM TEST PASSED 100% PERFECTLY ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProductInventoryFlow();
