import fs from 'fs';

const filePath = 'postman_collection.json';
const rawData = fs.readFileSync(filePath, 'utf8');
const collection = JSON.parse(rawData);

const productFolder = {
  name: '4. Products & Inventory Management',
  item: [
    {
      name: 'Create Category',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' },
          { key: 'Content-Type', value: 'application/json' }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            name: 'Retail & Supermarket',
            description: 'Grocery, Dairy, Packaged Food & Staples'
          }, null, 2)
        },
        url: {
          raw: '{{baseUrl}}/products/categories',
          host: ['{{baseUrl}}'],
          path: ['products', 'categories']
        }
      }
    },
    {
      name: 'Get All Categories with Sub-Categories',
      request: {
        method: 'GET',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' }
        ],
        url: {
          raw: '{{baseUrl}}/products/categories',
          host: ['{{baseUrl}}'],
          path: ['products', 'categories']
        }
      }
    },
    {
      name: 'Create Sub-Category with Dynamic Fields',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' },
          { key: 'Content-Type', value: 'application/json' }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            categoryId: '{{categoryId}}',
            name: 'Dairy & Packaged Milk',
            description: 'Fresh & Toned Packaged Milk',
            enableExpiryDate: true,
            additionalFields: [
              { labelName: 'Batch Number', inputType: 'TEXT', isRequired: false },
              { labelName: 'Fat Percentage', inputType: 'TEXT', isRequired: false }
            ]
          }, null, 2)
        },
        url: {
          raw: '{{baseUrl}}/products/subcategories',
          host: ['{{baseUrl}}'],
          path: ['products', 'subcategories']
        }
      }
    },
    {
      name: 'Add New Product',
      event: [
        {
          listen: 'test',
          script: {
            exec: [
              'var jsonData = pm.response.json();',
              'if (jsonData.data && jsonData.data.id) {',
              '    pm.environment.set("productId", jsonData.data.id);',
              '    pm.environment.set("productBarcode", jsonData.data.barcode);',
              '}'
            ],
            type: 'text/javascript'
          }
        }
      ],
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' },
          { key: 'Content-Type', value: 'application/json' }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            categoryId: '{{categoryId}}',
            subCategoryId: '{{subCategoryId}}',
            name: 'Amul Taaza Toned Milk 1L',
            purchasePrice: 62,
            sellingPrice: 68,
            mrp: 68,
            openingStock: 3,
            minStockLevel: 5,
            description: 'Pasteurised Toned Milk 1 Litre Pouch',
            additionalValues: {
              'Batch Number': 'BATCH-2026-08',
              'Fat Percentage': '3.0%'
            }
          }, null, 2)
        },
        url: {
          raw: '{{baseUrl}}/products',
          host: ['{{baseUrl}}'],
          path: ['products']
        }
      }
    },
    {
      name: 'Get Products List (With Search & Filters)',
      request: {
        method: 'GET',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' }
        ],
        url: {
          raw: '{{baseUrl}}/products?search=Amul',
          host: ['{{baseUrl}}'],
          path: ['products'],
          query: [{ key: 'search', value: 'Amul' }]
        }
      }
    },
    {
      name: 'Get Low Stock Products Alert',
      request: {
        method: 'GET',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' }
        ],
        url: {
          raw: '{{baseUrl}}/products/low-stock',
          host: ['{{baseUrl}}'],
          path: ['products', 'low-stock']
        }
      }
    },
    {
      name: 'Lookup Product by Barcode / SKU Scanner',
      request: {
        method: 'GET',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' }
        ],
        url: {
          raw: '{{baseUrl}}/products/barcode/{{productBarcode}}',
          host: ['{{baseUrl}}'],
          path: ['products', 'barcode', '{{productBarcode}}']
        }
      }
    },
    {
      name: 'Get Product Details',
      request: {
        method: 'GET',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' }
        ],
        url: {
          raw: '{{baseUrl}}/products/{{productId}}',
          host: ['{{baseUrl}}'],
          path: ['products', '{{productId}}']
        }
      }
    },
    {
      name: 'Update Product Details & Min Stock Threshold',
      request: {
        method: 'PUT',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' },
          { key: 'Content-Type', value: 'application/json' }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            sellingPrice: 69,
            minStockLevel: 2
          }, null, 2)
        },
        url: {
          raw: '{{baseUrl}}/products/{{productId}}',
          host: ['{{baseUrl}}'],
          path: ['products', '{{productId}}']
        }
      }
    },
    {
      name: 'Delete Product (Vendor Only)',
      request: {
        method: 'DELETE',
        header: [
          { key: 'Authorization', value: 'Bearer {{vendorToken}}' }
        ],
        url: {
          raw: '{{baseUrl}}/products/{{productId}}',
          host: ['{{baseUrl}}'],
          path: ['products', '{{productId}}']
        }
      }
    }
  ]
};

// Check if folder 4 exists
const existingIndex = collection.item.findIndex(i => i.name.startsWith('4. Product') || i.name.startsWith('4. Inventory'));
if (existingIndex !== -1) {
  collection.item[existingIndex] = productFolder;
} else {
  collection.item.push(productFolder);
}

fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');
console.log('✅ Postman Collection updated with Products & Inventory Management folder!');
