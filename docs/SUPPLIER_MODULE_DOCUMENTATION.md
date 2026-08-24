# 🚚 Supplier Module Backend Documentation
**Multi-Tenant Billing SaaS Backend**  
*Version: 1.1.0*

---

## 📋 Table of Contents
1. [Overview & Core Architecture](#overview--core-architecture)
2. [Database Schema & Models](#database-schema--models)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Supplier Ledger & Financial Mechanics](#supplier-ledger--financial-mechanics)
5. [UI Alignment & Overview KPI Summaries](#ui-alignment--overview-kpi-summaries)
6. [Validation Schemas & Regex Rules](#validation-schemas--regex-rules)
7. [API Request & Response Specification](#api-request--response-specification)
8. [Integration with Purchase Module](#integration-with-purchase-module)

---

## 1. Overview & Core Architecture

The **Supplier Module** manages vendor profiles, wholesale supplier directories, payables ledgers, bulk supplier imports, data exports, and financial account statements for multi-tenant retail and wholesale businesses.

### Key Capabilities:
- **Vendor Directory Management**: Store complete contact information, company name, 10-digit mobile, email, GSTIN, PAN, full address, `supplierType` (Local / National / Wholesale), `creditLimit`, and `paymentTerms` (e.g. "30 Days").
- **Real-Time Financial Payables Banner**: Tracks total active suppliers, total purchases this month, total paid this month, and net `totalPayableOverall` across all suppliers.
- **Supplier Details Audit & Overview Summaries**:
  - `purchaseSummary`: Total Bills, Total Items (sum of quantities), Avg Bill Value, Last Purchase Date.
  - `paymentSummary`: Total Paid, Total Payments count, Last Payment Date, Current Balance (Payable).
  - `paymentHistory`: Live stream of recorded `SupplierPayment` transactions.
- **Double-Entry Account Ledger**: Generates chronological credit (bills) and debit (payments) ledger entries with running balance calculation.
- **Bulk Import & Export**:
  - `POST /api/v1/suppliers/import`: Bulk import suppliers from Excel / CSV array payload.
  - `GET /api/v1/suppliers/export`: Dataset export for reporting and analysis.

---

## 2. Database Schema & Models

Defines two primary models in `prisma/schema.prisma`:

```prisma
model Supplier {
  id               String            @id @default(uuid())
  tenantId         String
  tenant           Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name             String
  companyName      String?
  mobileNumber     String
  email            String?
  pan              String?
  gstin            String?
  address          String?
  city             String?
  state            String?
  pincode          String?
  status           AccountStatus     @default(ACTIVE)
  
  supplierType     String?           @default("Local")
  creditLimit      Float             @default(0)
  paymentTerms     String?           @default("30 Days")
  
  totalPurchases   Float             @default(0)
  totalPaid        Float             @default(0)
  outstandingDue   Float             @default(0)

  purchaseInvoices PurchaseInvoice[]
  supplierPayments SupplierPayment[]

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
}

model SupplierPayment {
  id              String        @id @default(uuid())
  tenantId        String
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  supplierId      String
  supplier        Supplier      @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  amount          Float
  paymentDate     DateTime      @default(now())
  paymentMethod   PaymentMethod @default(CASH)
  referenceNumber String?
  notes           String?
  
  createdById     String
  createdBy       User          @relation(fields: [createdById], references: [id])

  createdAt       DateTime      @default(now())
}
```

---

## 3. API Endpoints Reference

Mounted under `/api/v1/suppliers` requiring JWT Bearer Authentication (`authenticateToken`).

| Method | Endpoint Path | Access Role | Action / Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/suppliers` | `TENANT_ADMIN` | Register new Supplier profile |
| `GET` | `/api/v1/suppliers` | All Staff | List Suppliers with Top KPI Banner & Pagination |
| `GET` | `/api/v1/suppliers/export` | All Staff | Export Suppliers Dataset (Excel/PDF) |
| `POST` | `/api/v1/suppliers/import` | `TENANT_ADMIN` | Bulk Import Suppliers Array |
| `GET` | `/api/v1/suppliers/:id` | All Staff | Get Supplier Details, Overview Summaries & Payment History |
| `GET` | `/api/v1/suppliers/:id/ledger` | All Staff | Generate Double-Entry Account Statement |
| `POST` | `/api/v1/suppliers/:id/payments` | `TENANT_ADMIN` | Record Payment & Reduce Supplier Outstanding Due |
| `PUT` | `/api/v1/suppliers/:id` | `TENANT_ADMIN` | Update Supplier Profile Information |
| `DELETE` | `/api/v1/suppliers/:id` | `TENANT_ADMIN` | Delete Supplier Record |

---

## 4. Supplier Ledger & Financial Mechanics

1. **Credit Generation (Purchase Invoices)**:
   - When a purchase invoice is confirmed (`POST /purchases/:id/confirm`), `Supplier.totalPurchases` increases by `totalAmount` and `Supplier.outstandingDue` increases by `dueAmount`.
2. **Debit Settlement (Supplier Payments)**:
   - When a payment is recorded against a supplier (`POST /suppliers/:id/payments`), a `SupplierPayment` record is created, `Supplier.totalPaid` increases by `amount`, and `Supplier.outstandingDue` decreases by `amount`.
3. **Running Balance Calculation**:
   $$\text{Running Balance}_k = \sum_{i=1}^k (\text{Credit}_i - \text{Debit}_i)$$

---

## 5. UI Alignment & Overview KPI Summaries

### Listing Banner (`GET /suppliers`):
- `summary.totalSuppliers`: Count of active suppliers.
- `summary.totalPurchasesThisMonth`: Sum of purchase invoice amounts generated this month.
- `summary.totalPaidThisMonth`: Sum of paid amounts this month.
- `summary.totalPayableOverall`: Net sum of `outstandingDue` across all active suppliers.

### Details View (`GET /suppliers/:id`):
- `purchaseSummary`: `totalBills`, `totalItems` (sum of item quantities), `avgBillValue` ($\frac{\text{totalPurchases}}{\text{totalBills}}$), `lastPurchaseDate`.
- `paymentSummary`: `totalPaid`, `totalPayments`, `lastPaymentDate`, `currentBalance`.
- `paymentHistory`: Live list of payments from `SupplierPayment` model with date, amount, method, reference number, notes, and creator name.

---

## 6. Validation Schemas & Regex Rules

Defined in `src/modules/supplier/supplier.validator.js`:

- **Mobile Regex**: `/^[6-9]\d{9}$/` (10-digit Indian Mobile number).
- **GSTIN Regex**: `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/` (15-character GSTIN).
- **PAN Regex**: `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/` (10-character PAN).

---

## 7. API Request & Response Specification

### 7.1 Register Supplier
- **Endpoint:** `POST /api/v1/suppliers`
- **Request Body:**
```json
{
  "name": "Rajesh Supplies",
  "companyName": "Rajesh Supplies Co.",
  "mobileNumber": "9876543210",
  "email": "rajesh@supplies.com",
  "gstin": "07ABCDE1234F1Z5",
  "pan": "ABCDE1234F",
  "address": "Plot 10, Main Market",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "supplierType": "Local",
  "creditLimit": 500000,
  "paymentTerms": "30 Days"
}
```
- **Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "id": "sup-uuid-101",
    "name": "Rajesh Supplies",
    "companyName": "Rajesh Supplies Co.",
    "mobileNumber": "9876543210",
    "gstin": "07ABCDE1234F1Z5",
    "supplierType": "Local",
    "creditLimit": 500000,
    "paymentTerms": "30 Days",
    "totalPurchases": 0,
    "totalPaid": 0,
    "outstandingDue": 0
  },
  "message": "Supplier registered successfully."
}
```

---

### 7.2 Get Supplier Listing with Summary Banner & Pagination
- **Endpoint:** `GET /api/v1/suppliers?page=1&limit=10&status=ACTIVE&search=Rajesh`
- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": {
    "summary": {
      "totalSuppliers": 56,
      "totalPurchasesThisMonth": 2584750.00,
      "totalPaidThisMonth": 1865420.00,
      "totalPayableOverall": 719330.00
    },
    "suppliers": [
      {
        "id": "sup-uuid-101",
        "name": "Rajesh Supplies",
        "companyName": "Rajesh Supplies Co.",
        "mobileNumber": "9876543210",
        "gstin": "07ABCDE1234F1Z5",
        "supplierType": "Local",
        "creditLimit": 500000,
        "paymentTerms": "30 Days",
        "totalPurchases": 485600.00,
        "totalPaid": 325600.00,
        "totalPayable": 160000.00,
        "outstandingDue": 160000.00,
        "lastPurchaseDate": "2025-05-20T00:00:00.000Z",
        "status": "Active",
        "purchaseCount": 28
      }
    ],
    "pagination": {
      "totalCount": 56,
      "page": 1,
      "limit": 10,
      "totalPages": 6
    }
  },
  "message": "Suppliers list fetched successfully."
}
```

---

### 7.3 Get Supplier Details & Overview Summaries
- **Endpoint:** `GET /api/v1/suppliers/sup-uuid-101`
- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": {
    "supplierInformation": {
      "id": "sup-uuid-101",
      "name": "Rajesh Supplies",
      "companyName": "Rajesh Supplies Co.",
      "mobileNumber": "9876543210",
      "email": "rajesh@supplies.com",
      "gstin": "07ABCDE1234F1Z5",
      "pan": "ABCDE1234F",
      "supplierType": "Local",
      "creditLimit": 500000,
      "paymentTerms": "30 Days",
      "status": "Active",
      "createdAt": "2024-01-15T00:00:00.000Z"
    },
    "lifetimeStats": {
      "totalPurchases": 485600.00,
      "totalPaid": 325600.00,
      "totalPayable": 160000.00,
      "outstandingDue": 160000.00,
      "lastPurchaseDate": "2025-05-20T00:00:00.000Z"
    },
    "purchaseSummary": {
      "totalBills": 28,
      "totalItems": 156,
      "avgBillValue": 17342.86,
      "lastPurchaseDate": "2025-05-20T00:00:00.000Z"
    },
    "paymentSummary": {
      "totalPaid": 325600.00,
      "totalPayments": 15,
      "lastPaymentDate": "2025-05-19T00:00:00.000Z",
      "currentBalance": 160000.00
    },
    "purchaseHistory": [
      {
        "id": "pur-1",
        "purchaseNumber": "PUR-250520-001",
        "supplierInvoiceNumber": "INV-101",
        "invoiceDate": "2025-05-20T00:00:00.000Z",
        "itemsCount": 8,
        "totalAmount": 48500.00,
        "paidAmount": 20500.00,
        "dueAmount": 28000.00,
        "paymentStatus": "PARTIALLY_PAID"
      }
    ],
    "paymentHistory": [
      {
        "id": "pmt-1",
        "paymentDate": "2025-05-19T00:00:00.000Z",
        "amount": 75250.00,
        "paymentMethod": "BANK",
        "referenceNumber": "RTGS12345",
        "notes": "Bank transfer payment",
        "recordedBy": "Super Vendor"
      }
    ]
  },
  "message": "Supplier details fetched successfully."
}
```

---

### 7.4 Bulk Import Suppliers
- **Endpoint:** `POST /api/v1/suppliers/import`
- **Request Body:**
```json
{
  "suppliers": [
    {
      "name": "Goyal Traders",
      "companyName": "Goyal Traders Pvt Ltd",
      "mobileNumber": "9817654321",
      "email": "goyal@traders.com",
      "city": "Mumbai",
      "supplierType": "Wholesale"
    }
  ]
}
```
- **Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "importedCount": 1,
    "suppliers": [...]
  },
  "message": "Suppliers bulk imported successfully."
}
```

---

## 8. Integration with Purchase Module

When creating or confirming a purchase bill (`POST /purchases/:id/confirm`):
1. `Supplier.totalPurchases` increments by the total bill amount.
2. `Supplier.outstandingDue` increments by the unpaid due amount.
3. Supplier details endpoints display updated lifetime and monthly financial metrics automatically.
