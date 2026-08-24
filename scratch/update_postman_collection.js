import fs from 'fs';

const postmanPath = 'd:/Softfyr/Multi-Tenant Billing/Multi-Tenant Billing backend/postman_collection.json';

const collection = {
  info: {
    _postman_id: "multi-tenant-billing-saas-api-v1",
    name: "Multi-Tenant Billing SaaS Platform Backend API",
    description: "Complete Postman API Collection covering Super Admin Category Management, Vendor Workspace, Employee Billing Interface, Dynamic Inventory, Supplier Dues, Purchase Bills, Double-Entry Account Ledger, PDF/Excel Exports, and Subscriptions.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5000/api/v1", type: "string" },
    { key: "accessToken", value: "", type: "string" },
    { key: "refreshToken", value: "", type: "string" },
    { key: "adminToken", value: "", type: "string" },
    { key: "vendorToken", value: "", type: "string" },
    { key: "employeeToken", value: "", type: "string" },
    { key: "tenantId", value: "", type: "string" },
    { key: "categoryId", value: "", type: "string" },
    { key: "subCategoryId", value: "", type: "string" },
    { key: "fieldId", value: "", type: "string" },
    { key: "productId", value: "", type: "string" },
    { key: "customerId", value: "", type: "string" },
    { key: "billId", value: "", type: "string" },
    { key: "supplierId", value: "", type: "string" },
    { key: "purchaseId", value: "", type: "string" }
  ],
  item: [
    {
      name: "1. Authentication & Onboarding",
      item: [
        {
          name: "1. Super Admin Email Login",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && (jsonData.data.accessToken || jsonData.data.token)) {",
                  "    var t = jsonData.data.accessToken || jsonData.data.token;",
                  "    pm.collectionVariables.set('adminToken', t);",
                  "    pm.collectionVariables.set('accessToken', t);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: JSON.stringify({ email: "admin@softfyr.com", password: "admin123" }, null, 2) },
            url: { raw: "{{baseUrl}}/auth/admin/login", host: ["{{baseUrl}}"], path: ["auth", "admin", "login"] }
          }
        },
        {
          name: "2. Vendor / User OTP Login - Step 1: Send OTP",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: JSON.stringify({ mobileNumber: "9876543210" }, null, 2) },
            url: { raw: "{{baseUrl}}/auth/send-otp", host: ["{{baseUrl}}"], path: ["auth", "send-otp"] }
          }
        },
        {
          name: "3. Vendor / User OTP Login - Step 2: Verify OTP",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && (jsonData.data.accessToken || jsonData.data.token)) {",
                  "    var t = jsonData.data.accessToken || jsonData.data.token;",
                  "    pm.collectionVariables.set('vendorToken', t);",
                  "    pm.collectionVariables.set('accessToken', t);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: JSON.stringify({ mobileNumber: "9876543210", otpCode: "123456" }, null, 2) },
            url: { raw: "{{baseUrl}}/auth/verify-otp", host: ["{{baseUrl}}"], path: ["auth", "verify-otp"] }
          }
        }
      ]
    },
    {
      name: "2. Category & Sub-Category Management (Super Admin)",
      item: [
        {
          name: "1. Create Master Category",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && jsonData.data.id) {",
                  "    pm.collectionVariables.set('categoryId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Pharmacy & Healthcare",
                description: "Rx Medicines, Healthcare Supplements & Medical Devices"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/admin/categories", host: ["{{baseUrl}}"], path: ["admin", "categories"] }
          }
        },
        {
          name: "2. Get All Master Categories",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/admin/categories?search=Pharmacy", host: ["{{baseUrl}}"], path: ["admin", "categories"] }
          }
        },
        {
          name: "3. Get Category Details By ID",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/admin/categories/{{categoryId}}", host: ["{{baseUrl}}"], path: ["admin", "categories", "{{categoryId}}"] }
          }
        },
        {
          name: "4. Update Master Category",
          request: {
            method: "PUT",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                description: "Updated Master Pharmacy Description"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/admin/categories/{{categoryId}}", host: ["{{baseUrl}}"], path: ["admin", "categories", "{{categoryId}}"] }
          }
        },
        {
          name: "5. Create Sub-Category (With Expiry Toggle & Custom Fields)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && jsonData.data.id) {",
                  "    pm.collectionVariables.set('subCategoryId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                categoryId: "{{categoryId}}",
                name: "Rx Prescription Medicines",
                description: "Prescription Tablets, Syrups & Capsules",
                enableExpiryDate: true,
                additionalFields: [
                  { labelName: "Batch Number", inputType: "TEXT", isRequired: true },
                  { labelName: "Dosage Form", inputType: "TEXT", isRequired: false }
                ]
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/admin/sub-categories", host: ["{{baseUrl}}"], path: ["admin", "sub-categories"] }
          }
        },
        {
          name: "6. Get Sub-Categories By Category ID",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/admin/sub-categories?categoryId={{categoryId}}", host: ["{{baseUrl}}"], path: ["admin", "sub-categories"] }
          }
        },
        {
          name: "7. Add Standalone Additional Field to Sub-Category",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && jsonData.data.id) {",
                  "    pm.collectionVariables.set('fieldId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                labelName: "Manufacturer Name",
                inputType: "TEXT",
                isRequired: false,
                status: "ACTIVE"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/admin/sub-categories/{{subCategoryId}}/fields", host: ["{{baseUrl}}"], path: ["admin", "sub-categories", "{{subCategoryId}}", "fields"] }
          }
        },
        {
          name: "8. Update Additional Field Configuration",
          request: {
            method: "PUT",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                isRequired: true
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/admin/sub-categories/fields/{{fieldId}}", host: ["{{baseUrl}}"], path: ["admin", "sub-categories", "fields", "{{fieldId}}"] }
          }
        },
        {
          name: "9. Vendor Fetch Sub-Category Structure & Expiry Settings",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{vendorToken}}" }],
            url: { raw: "{{baseUrl}}/products/structure/{{subCategoryId}}", host: ["{{baseUrl}}"], path: ["products", "structure", "{{subCategoryId}}"] }
          }
        }
      ]
    },
    {
      name: "3. Supplier Management & Account Ledger",
      item: [
        {
          name: "1. Register Supplier (With GSTIN & PAN)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && jsonData.data.id) {",
                  "    pm.collectionVariables.set('supplierId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{vendorToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Mahaveer Electronics",
                companyName: "Mahaveer Distribution Pvt Ltd",
                mobileNumber: "9812345678",
                email: "sales@mahaveer.com",
                gstin: "08AAAAA1111A1Z1",
                pan: "AAAAA1111A",
                address: "Plot 45, Transport Nagar",
                city: "Jaipur",
                state: "Rajasthan",
                pincode: "302003"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/suppliers", host: ["{{baseUrl}}"], path: ["suppliers"] }
          }
        },
        {
          name: "2. Get All Suppliers (Filters & Search)",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{vendorToken}}" }],
            url: { raw: "{{baseUrl}}/suppliers?search=Mahaveer&status=ACTIVE", host: ["{{baseUrl}}"], path: ["suppliers"] }
          }
        },
        {
          name: "3. Get Supplier Deep Details & Financial Summary",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{vendorToken}}" }],
            url: { raw: "{{baseUrl}}/suppliers/{{supplierId}}", host: ["{{baseUrl}}"], path: ["suppliers", "{{supplierId}}"] }
          }
        },
        {
          name: "4. Get Supplier Double-Entry Account Ledger Statement",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{vendorToken}}" }],
            url: { raw: "{{baseUrl}}/suppliers/{{supplierId}}/ledger", host: ["{{baseUrl}}"], path: ["suppliers", "{{supplierId}}", "ledger"] }
          }
        },
        {
          name: "5. Record Standalone Supplier Payment",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{vendorToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                amount: 15000,
                paymentMethod: "UPI",
                referenceNumber: "UPI-TXN-998877",
                notes: "Partial payment towards outstanding dues"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/suppliers/{{supplierId}}/payments", host: ["{{baseUrl}}"], path: ["suppliers", "{{supplierId}}", "payments"] }
          }
        }
      ]
    },
    {
      name: "4. Purchase Bills & Stock Inwarding",
      item: [
        {
          name: "1. Create Purchase Bill (Supports Inline Supplier/Product Creation)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && jsonData.data.id) {",
                  "    pm.collectionVariables.set('purchaseId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{vendorToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                supplierId: "{{supplierId}}",
                supplierInvoiceNumber: "INV-APEX-9001",
                items: [
                  { productId: "{{productId}}", quantity: 5, unitPurchasePrice: 8000, taxPercent: 18 }
                ],
                paidAmount: 20000,
                paymentMethod: "UPI"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/purchases", host: ["{{baseUrl}}"], path: ["purchases"] }
          }
        },
        {
          name: "2. Record Payment Modal Action on Purchase Bill",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{vendorToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                amount: 27200,
                paymentMethod: "BANK",
                notes: "Cleared remaining dues via Record Payment Modal"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/purchases/{{purchaseId}}/payments", host: ["{{baseUrl}}"], path: ["purchases", "{{purchaseId}}", "payments"] }
          }
        }
      ]
    },
    {
      name: "5. Product & Inventory Management",
      item: [
        {
          name: "1. Add Product (With Expiry & Custom Fields)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.success && jsonData.data.id) {",
                  "    pm.collectionVariables.set('productId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{vendorToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                categoryId: "{{categoryId}}",
                subCategoryId: "{{subCategoryId}}",
                name: "Paracetamol 500mg Tablets",
                brand: "Cipla",
                unit: "STRIP",
                sellingPrice: 40,
                purchasePrice: 25,
                expiryDate: "2027-09-15",
                openingStock: 100,
                minStockLevel: 10,
                additionalValues: {
                  "Batch Number": "BATCH-ABC123"
                }
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/products", host: ["{{baseUrl}}"], path: ["products"] }
          }
        },
        {
          name: "2. Get Products (Filters: Category, Brand, StockStatus)",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{vendorToken}}" }],
            url: { raw: "{{baseUrl}}/products?stockStatus=IN_STOCK", host: ["{{baseUrl}}"], path: ["products"] }
          }
        }
      ]
    }
  ]
};

fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2), 'utf-8');
console.log('✅ [POSTMAN COLLECTION UPDATED] -> Successfully generated postman_collection.json');
