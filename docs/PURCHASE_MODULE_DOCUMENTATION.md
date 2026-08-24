# 🛒 Purchase Module Backend Documentation
**Multi-Tenant Billing SaaS Backend**  
*Version: 1.1.0*

---

## 📋 Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Database Schema & Models](#database-schema--models)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [UI Alignment & Overview KPI Banner](#ui-alignment--overview-kpi-banner)
5. [Structured Purchase Returns & Cancellations](#structured-purchase-returns--cancellations)
6. [API Request & Response Specification](#api-request--response-specification)
7. [Integration with Supplier & Inventory Modules](#integration-with-supplier--inventory-modules)

---

## 1. Overview & Architecture

The **Purchase Module** handles raw material and retail goods procurement, vendor inwarding invoices, inventory stock additions, purchase return/cancellation management, payment settlements, and payables audit logs.

### Key Capabilities:
- **Procurement & Inwarding**: Supports creating purchase bills in `DRAFT` or `CONFIRMED` state with custom `purchaseType` (Local / Interstate / Import), line item units, item discounts %, GST taxes, round-offs, and file attachments.
- **Top Summary KPI Banner & Status Tabs**:
  - Banner KPIs: `totalBills`, `totalAmount`, `paidAmount`, `dueAmount`, `overdueAmount`.
  - Status Tabs: `all`, `paid`, `partial`, `unpaid`, `overdue`, `cancelled`, `returned`.
- **Structured Purchase Returns**: Dedicated `PurchaseReturn` model supporting partial or full item returns, return reasons (`Damaged / Defective`, `Expired`, `Incorrect Order`, `Excess Stock`), refund types (`CASH_REFUND`, `ADJUST_IN_NEXT_PURCHASE`, `BANK_TRANSFER`), automatic inventory stock deductions (`StockHistory` reason `RETURN`), and supplier due adjustments.
- **Supplier & Payment Sync**: Automatically updates `Supplier.totalPurchases`, `Supplier.totalPaid`, `Supplier.outstandingDue`, and logs `SupplierPayment` entries.

---

## 2. Database Schema & Models

```prisma
model PurchaseInvoice {
  id                    String         @id @default(uuid())
  tenantId              String
  tenant                Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  supplierId            String
  supplier              Supplier       @relation(fields: [supplierId], references: [id])
  
  purchaseNumber        String
  supplierInvoiceNumber String?
  invoiceDate           DateTime       @default(now())
  dueDate               DateTime?
  paymentTerms          String?
  notes                 String?
  subtotal              Float
  taxAmount             Float          @default(0)
  discountAmount        Float          @default(0)
  cgstAmount            Float          @default(0)
  sgstAmount            Float          @default(0)
  igstAmount            Float          @default(0)
  otherCharges          Float          @default(0)
  roundOff              Float          @default(0)
  totalAmount           Float
  paidAmount            Float          @default(0)
  dueAmount             Float          @default(0)
  paymentStatus         BillStatus     @default(PAID)
  purchaseStatus        PurchaseStatus @default(CONFIRMED)

  purchaseType          String?        @default("Local Purchase")
  paymentMethod         PaymentMethod  @default(CASH)
  bankAccount           String?
  referenceNumber       String?
  attachments           Json?          // Array of file URLs
  
  items                 PurchaseItem[]
  returns               PurchaseReturn[]

  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  @@unique([tenantId, purchaseNumber])
}

model PurchaseItem {
  id                String          @id @default(uuid())
  purchaseInvoiceId String
  purchaseInvoice   PurchaseInvoice @relation(fields: [purchaseInvoiceId], references: [id], onDelete: Cascade)
  
  productId         String
  product           Product         @relation(fields: [productId], references: [id])
  
  sku               String?
  unit              String?         @default("Nos")
  quantity          Int
  unitPurchasePrice Float
  discountPercent   Float           @default(0)
  discountAmount    Float           @default(0)
  taxPercent        Float           @default(0)
  taxAmount         Float           @default(0)
  totalAmount       Float

  createdAt         DateTime        @default(now())
}

model PurchaseReturn {
  id                    String               @id @default(uuid())
  tenantId              String
  tenant                Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  returnNumber          String
  returnType            String               @default("PURCHASE_RETURN")
  supplierId            String
  supplier              Supplier             @relation(fields: [supplierId], references: [id])
  
  purchaseInvoiceId     String
  purchaseInvoice       PurchaseInvoice      @relation(fields: [purchaseInvoiceId], references: [id])
  
  returnDate            DateTime             @default(now())
  returnReason          String?
  referenceNotes        String?
  returnAgainst         String               @default("PARTIAL_ITEMS")
  warehouse             String?              @default("Main Warehouse")
  
  subtotal              Float
  discountAmount        Float                @default(0)
  taxableAmount         Float                @default(0)
  cgstAmount            Float                @default(0)
  sgstAmount            Float                @default(0)
  igstAmount            Float                @default(0)
  otherCharges          Float                @default(0)
  roundOff              Float                @default(0)
  totalReturnAmount     Float
  
  refundType            String               @default("CASH_REFUND")
  refundAmount          Float                @default(0)
  paymentMethod         PaymentMethod        @default(CASH)
  bankAccount           String?
  
  createdById           String
  createdBy             User                 @relation(fields: [createdById], references: [id])
  
  items                 PurchaseReturnItem[]

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt
  
  @@unique([tenantId, returnNumber])
}
```

---

## 3. API Endpoints Reference

Mounted under `/api/v1/purchases` requiring JWT Bearer Authentication (`authenticateToken`).

| Method | Endpoint Path | Access Role | Action / Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/purchases` | `TENANT_ADMIN` | Create Purchase Bill (`DRAFT` or `CONFIRMED`) |
| `GET` | `/api/v1/purchases` | All Staff | List Purchase Bills with Top Banner KPIs & Status Counts |
| `GET` | `/api/v1/purchases/export` | All Staff | Export Purchase Invoices Dataset |
| `POST` | `/api/v1/purchases/returns` | `TENANT_ADMIN` | Create Structured Purchase Return / Cancellation |
| `GET` | `/api/v1/purchases/returns` | All Staff | List Purchase Returns |
| `GET` | `/api/v1/purchases/:id` | All Staff | Get Bill Details, Payment Summary & Supplier Info |
| `POST` | `/api/v1/purchases/:id/confirm` | `TENANT_ADMIN` | Confirm DRAFT Bill & Update Inventory |
| `POST` | `/api/v1/purchases/:id/payments` | `TENANT_ADMIN` | Record Payment against Purchase Bill |
| `POST` | `/api/v1/purchases/:id/cancel` | `TENANT_ADMIN` | Cancel Purchase Bill & Reverse Inventory Stock |

---

## 4. UI Alignment & Overview KPI Banner

### Listing Banner (`GET /purchases`):
- `summary.totalBills`: Total count of purchase bills.
- `summary.totalAmount`: Sum of total purchase amounts.
- `summary.paidAmount`: Sum of paid amounts.
- `summary.dueAmount`: Sum of due amounts.
- `summary.overdueAmount`: Sum of due amounts for bills past `dueDate`.
- `statusCounts`: `all`, `paid`, `partial`, `unpaid`, `overdue`, `cancelled`, `returned`.

---

## 5. Structured Purchase Returns & Cancellations

When executing `POST /purchases/returns`:
1. Creates `PurchaseReturn` and `PurchaseReturnItem` records.
2. Deducts item quantities from `Product.currentStock` and logs `StockHistory` with reason `RETURN`.
3. Reduces `Supplier.outstandingDue` by `totalReturnAmount`.
4. Updates `PurchaseInvoice.purchaseStatus` to `PARTIALLY_RETURNED` or `FULLY_RETURNED`.

---

## 6. API Request & Response Specification

### Create Purchase Bill
- **Endpoint:** `POST /api/v1/purchases`
- **Request Body:**
```json
{
  "supplierId": "sup-uuid-101",
  "supplierInvoiceNumber": "INV-4587",
  "invoiceDate": "2025-08-21",
  "dueDate": "2025-08-31",
  "paymentTerms": "Net 10 Days",
  "purchaseType": "Local Purchase",
  "bankAccount": "HDFC Bank - 502000xxxx1234",
  "referenceNumber": "NEFT25698541",
  "notes": "Office supply purchase",
  "purchaseStatus": "CONFIRMED",
  "paidAmount": 48500,
  "paymentMethod": "BANK",
  "items": [
    {
      "productId": "prod-uuid-1",
      "unit": "Nos",
      "quantity": 2,
      "unitPurchasePrice": 12500,
      "discountPercent": 0,
      "taxPercent": 18
    }
  ]
}
```

### Create Purchase Return
- **Endpoint:** `POST /api/v1/purchases/returns`
- **Request Body:**
```json
{
  "purchaseInvoiceId": "pur-uuid-101",
  "returnType": "PURCHASE_RETURN",
  "returnReason": "Damaged / Defective",
  "referenceNotes": "Products damaged in transit",
  "returnAgainst": "PARTIAL_ITEMS",
  "warehouse": "Main Warehouse",
  "refundType": "CASH_REFUND",
  "refundAmount": 16148,
  "paymentMethod": "BANK",
  "bankAccount": "HDFC Bank - 502000xxxx1234",
  "returnItems": [
    {
      "productId": "prod-uuid-1",
      "unit": "Nos",
      "purchasedQty": 2,
      "returnQuantity": 1,
      "unitPrice": 12500,
      "discountPercent": 0,
      "taxPercent": 18
    }
  ]
}
```
