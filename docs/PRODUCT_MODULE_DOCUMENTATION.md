# 📦 Product & Inventory Catalog Module Documentation
**Multi-Tenant Billing SaaS Backend**  
*Version: 1.1.0*

---

## 📋 Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Database Schema & Models](#database-schema--models)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [UI Alignment & Overview KPI Banner](#ui-alignment--overview-kpi-banner)
5. [Bulk Products Import & Export](#bulk-products-import--export)
6. [API Request & Response Specification](#api-request--response-specification)

---

## 1. Overview & Architecture

The **Product Module** handles catalog inventory management, master categories, sub-categories with dynamic custom fields, pricing (Purchase Price, Selling Price, MRP, Tax %, Default Discounts), brand categorization, stock alert thresholds, low/out-of-stock monitoring, bulk excel/csv imports, and dataset exports.

---

## 2. Database Schema & Models

```prisma
model Product {
  id                 String        @id @default(uuid())
  tenantId           String
  tenant             Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  categoryId         String
  category           Category      @relation(fields: [categoryId], references: [id])
  
  subCategoryId      String
  subCategory        SubCategory   @relation(fields: [subCategoryId], references: [id])
  
  name               String
  sku                String?
  barcode            String?
  hsnCode            String?       // HSN / SAC Code
  brand              String?
  unit               String?       @default("Pcs")
  purchasePrice      Float         @default(0)
  sellingPrice       Float
  mrp                Float?
  taxType            String?       @default("GST")
  discountPercent    Float         @default(0)
  taxId              String?
  tax                Tax?          @relation(fields: [taxId], references: [id])
  
  openingStock       Int           @default(0)
  currentStock       Int           @default(0)
  maxStockLevel      Int           @default(0)
  minStockLevel      Int           @default(5)
  stockAlertQuantity Int           @default(5)
  enableStockAlert   Boolean       @default(true)
  
  productImage       String?
  description        String?
  expiryDate         DateTime?
  additionalValues   Json?         // Key-Value map for sub-category dynamic fields
  
  status             AccountStatus @default(ACTIVE)

  billItems           BillItem[]
  stockHistory        StockHistory[]
  purchaseItems       PurchaseItem[]
  purchaseReturnItems PurchaseReturnItem[]

  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@unique([tenantId, sku])
  @@unique([tenantId, barcode])
}
```

---

## 3. API Endpoints Reference

Mounted under `/api/v1/products` requiring JWT Bearer Authentication (`authenticateToken`).

| Method | Endpoint Path | Access Role | Action / Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/products` | Staff / Admin | Add New Product |
| `GET` | `/api/v1/products` | All Staff | List Products with Top KPI Banner & Global Pagination |
| `GET` | `/api/v1/products/export` | All Staff | Export Products Catalog (Excel, CSV, JSON) |
| `POST` | `/api/v1/products/import` | Admin | Bulk Import Products Dataset |
| `GET` | `/api/v1/products/categories` | All Staff | Get Master Categories & Sub-Categories |
| `GET` | `/api/v1/products/low-stock` | All Staff | Get Low Stock Alert Products |
| `GET` | `/api/v1/products/barcode/:barcode` | POS Staff | Search Product by Barcode or SKU Code |
| `GET` | `/api/v1/products/:id` | All Staff | Get Product Details & Stock History Audit Log |
| `PUT` | `/api/v1/products/:id` | Staff / Admin | Update Product Details |
| `DELETE` | `/api/v1/products/:id` | Admin Only | Suspend/Delete Product |

---

## 4. UI Alignment & Overview KPI Banner

### Listing Banner (`GET /api/v1/products`):
- `summary.totalProducts`: Count of active products.
- `summary.lowStockItems`: Count of products where `currentStock > 0` and `currentStock <= minStockLevel`.
- `summary.outOfStockItems`: Count of products where `currentStock <= 0`.
- `summary.totalStockValue`: Sum of $(\text{currentStock} \times \text{purchasePrice})$ across active items.

### Filter Options:
- `search`: Searches product name, SKU, barcode, HSN code, and brand.
- `categoryId`: Filter by category ID.
- `subCategoryId`: Filter by subcategory ID.
- `brand`: Filter by brand string.
- `status`: `ALL`, `ACTIVE`, `LOW_STOCK`, `OUT_OF_STOCK`, `EXPIRED`, `INACTIVE`, `DRAFT`.

---

## 5. API Request & Response Specification

### Add New Product
- **Endpoint:** `POST /api/v1/products`
- **Request Body:**
```json
{
  "categoryId": "cat-uuid-101",
  "subCategoryId": "subcat-uuid-202",
  "name": "Dell Inspiron 15 Laptop",
  "sku": "DL-IN15-001",
  "barcode": "8906123450012",
  "hsnCode": "84713010",
  "brand": "Dell",
  "unit": "Nos",
  "purchasePrice": 40000,
  "sellingPrice": 49990,
  "mrp": 54990,
  "taxType": "GST",
  "discountPercent": 5,
  "openingStock": 15,
  "maxStockLevel": 50,
  "minStockLevel": 5,
  "stockAlertQuantity": 3,
  "enableStockAlert": true,
  "description": "Laptop 15.6 inch, 8GB RAM, 512GB SSD"
}
```

### Products List Response
- **Endpoint:** `GET /api/v1/products?page=1&limit=10`
- **Response:**
```json
{
  "statusCode": 200,
  "data": {
    "summary": {
      "totalProducts": 248,
      "lowStockItems": 18,
      "outOfStockItems": 5,
      "totalStockValue": 1845230
    },
    "pagination": {
      "totalCount": 248,
      "page": 1,
      "limit": 10,
      "totalPages": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "products": [...]
  },
  "message": "Products list fetched successfully."
}
```
