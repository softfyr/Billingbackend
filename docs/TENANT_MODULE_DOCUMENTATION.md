# 🏬 Tenant Store Workspace & Profile Module Backend Documentation
**Multi-Tenant Billing SaaS Backend**  
*Version: 1.0.0*

---

## 📋 Table of Contents
1. [Overview & Core Architecture](#overview--core-architecture)
2. [Database Schema & Models](#database-schema--models)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Vendor Dashboard KPIs & Analytics](#vendor-dashboard-kpis--analytics)
5. [Store Tax Slabs Configuration](#store-tax-slabs-configuration)
6. [Validation Schemas & Rules](#validation-schemas--rules)
7. [API Request & Response Specification](#api-request--response-specification)
8. [Subscription Status & Account Lock Rules](#subscription-status--account-lock-rules)

---

## 1. Overview & Core Architecture

The **Tenant Store Workspace & Profile Module** manages individual vendor store accounts, business profile setup, storefront identity (logo, GSTIN, address, invoice footers), dashboard KPIs, and store-specific tax slabs across the multi-tenant billing platform.

### Key Capabilities:
- **Tenant Workspace Isolation**: Every vendor operates inside an isolated `Tenant` environment. All products, bills, customers, employees, suppliers, and stock logs are scoped to `tenantId`.
- **Profile Setup & Onboarding**: Store owners set up store name, business type, GSTIN, PAN, address, city, state, pincode, and custom invoice footer notes.
- **Real-Time Vendor Dashboard**: Aggregates today's total sales, pending customer dues, low stock product alerts, active staff, total bills, and total products.
- **Configurable Store Taxes**: Vendor configures store tax slabs (e.g. *GST 5%*, *GST 12%*, *GST 18%*, *GST 28%*) applied during product catalog setup and POS billing.

---

## 2. Database Schema & Models

Extends two core tenant models in `prisma/schema.prisma`:

```prisma
enum SubscriptionStatus {
  FREE_TRIAL
  FREE_TRIAL_ENDED
  UPGRADED
  EXPIRED
}

enum AccountStatus {
  ACTIVE
  SUSPENDED
}

enum TaxType {
  PERCENTAGE
  FIXED
}

model Tenant {
  id                     String             @id @default(uuid())
  businessName           String?
  businessType           String?
  ownerName              String
  email                  String?            @unique
  mobileNumber           String             @unique
  businessLogo           String?
  businessAddress        String?
  city                   String?
  state                  String?
  country                String?            @default("India")
  pincode                String?
  gstNumber              String?
  panNumber              String?
  otherInvoiceInfo       String?
  isProfileComplete      Boolean            @default(false)
  
  subscriptionStatus     SubscriptionStatus @default(FREE_TRIAL)
  accountStatus          AccountStatus      @default(ACTIVE)
  
  currentPackageId       String?
  currentPackage         Package?           @relation(fields: [currentPackageId], references: [id])
  subscriptionStartDate  DateTime           @default(now())
  subscriptionExpiryDate DateTime
  
  users                  User[]
  products               Product[]
  customers              Customer[]
  bills                  Bill[]
  taxes                  Tax[]
  employees              EmployeeProfile[]
  suppliers              Supplier[]
  supplierPayments       SupplierPayment[]
  purchaseInvoices       PurchaseInvoice[]

  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt
}

model Tax {
  id          String        @id @default(uuid())
  tenantId    String
  tenant      Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name        String
  percentage  Float
  type        TaxType       @default(PERCENTAGE)
  status      AccountStatus @default(ACTIVE)

  products    Product[]

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}
```

---

## 3. API Endpoints Reference

Mounted under `/api/v1/business` requiring JWT Bearer Authentication (`authenticateToken`).

| Method | Endpoint Path | Access Role | Action / Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/business/dashboard` | All Staff | Get Real-Time Vendor Dashboard KPIs & Recent Bills |
| `GET` | `/api/v1/business/info` | All Staff | Get Business Store Info & Active Subscription |
| `GET` | `/api/v1/business/profile` | All Staff | Get Vendor Owner & Store Profile Summary |
| `POST` | `/api/v1/business/create-profile` | `TENANT_ADMIN` | Initial Business Profile Setup |
| `PUT` | `/api/v1/business/info` | `TENANT_ADMIN` | Update Store Profile Details & Invoice Info |
| `POST` | `/api/v1/business/taxes` | `TENANT_ADMIN` | Create Store Tax Slab (e.g. GST 18%) |
| `GET` | `/api/v1/business/taxes` | All Staff | List All Store Tax Slabs |
| `PUT` | `/api/v1/business/taxes/:taxId` | `TENANT_ADMIN` | Update Tax Slab Name or Percentage |
| `DELETE` | `/api/v1/business/taxes/:taxId` | `TENANT_ADMIN` | Delete Tax Slab (Enforces Staff Restrictions) |

---

## 4. Vendor Dashboard KPIs & Analytics

The backend aggregates live store statistics on calling `GET /api/v1/business/dashboard`:

1. **Today's Total Sales**: Sum of `grandTotal` for all non-cancelled bills generated since `00:00:00` today:
   $$\text{Today Sales} = \sum_{\text{created\_at} \ge \text{startOfToday}} \text{Bill.grandTotal}$$

2. **Pending Due Amount**: Total customer credit balances owed to the store across active bills:
   $$\text{Pending Due Amount} = \sum_{\text{dueAmount} > 0} \text{Bill.dueAmount}$$

3. **Low Stock Alert Counter**: Counts active products where `currentStock <= minStockLevel` (default threshold `5` units).

4. **Summary Counter Cards**: Total Customers, Total Bills, Active Products, and Total Employees.

---

## 5. Store Tax Slabs Configuration

Vendors can configure custom GST tax slabs in `/business/taxes`:
- `name`: Human-readable label (e.g. `GST 18%`, `CGST 9% + SGST 9%`, `Exempted 0%`).
- `percentage`: Tax numeric percentage (e.g. `18`, `12`, `5`, `0`).
- `type`: `PERCENTAGE` or `FIXED`.
- `status`: `ACTIVE` or `SUSPENDED`.

---

## 6. Validation Schemas & Rules

Defined in `src/modules/business/business.validator.js`:

- `createBusinessProfileSchema`: Requires non-empty `businessName` (or `storeName`). Formats GSTIN to uppercase 15-character string and PAN to uppercase 10-character string.
- `createTaxSchema`: Requires `name` and non-negative numeric `percentage`.

---

## 7. API Request & Response Specification

### 7.1 Setup Business Store Profile
- **Endpoint:** `POST /api/v1/business/create-profile`
- **Request Body:**
```json
{
  "businessName": "Gupta Hardware & Electronics",
  "businessType": "Retail Hardware Store",
  "ownerName": "Ramesh Gupta",
  "mobileNumber": "9876543210",
  "email": "ramesh@guptahardware.com",
  "gstNumber": "09AAAAA0000A1Z5",
  "panNumber": "ABCDE1234F",
  "businessAddress": "Shop 14, Main Market Road",
  "city": "Noida",
  "state": "Uttar Pradesh",
  "pincode": "201301",
  "otherInvoiceInfo": "Goods once sold cannot be returned without original invoice receipt."
}
```
- **Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "id": "t-uuid-201",
    "businessName": "Gupta Hardware & Electronics",
    "businessType": "Retail Hardware Store",
    "ownerName": "Ramesh Gupta",
    "gstNumber": "09AAAAA0000A1Z5",
    "isProfileComplete": true,
    "subscriptionStatus": "FREE_TRIAL",
    "accountStatus": "ACTIVE",
    "redirectUrl": "/vendor/dashboard"
  },
  "message": "Business store profile created successfully."
}
```

---

### 7.2 Get Vendor Dashboard KPIs
- **Endpoint:** `GET /api/v1/business/dashboard`
- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": {
    "kpis": {
      "totalCustomers": 128,
      "totalBills": 342,
      "todaySales": 18450.00,
      "totalProducts": 95,
      "lowStockProducts": 4,
      "totalEmployees": 3,
      "pendingDueAmount": 12500.00
    },
    "recentBills": [
      {
        "id": "bill-1",
        "invoiceNumber": "INV-1088",
        "grandTotal": 2450.00,
        "dueAmount": 0,
        "status": "PAID",
        "createdAt": "2026-08-22T15:30:00.000Z",
        "customer": {
          "name": "Sunil Sharma",
          "mobileNumber": "9998887770"
        }
      }
    ]
  },
  "message": "Vendor dashboard data fetched successfully."
}
```

---

### 7.3 Create Store Tax Slab
- **Endpoint:** `POST /api/v1/business/taxes`
- **Request Body:**
```json
{
  "name": "GST 18%",
  "percentage": 18,
  "type": "PERCENTAGE",
  "status": "ACTIVE"
}
```
- **Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "id": "tax-101",
    "tenantId": "t-uuid-201",
    "name": "GST 18%",
    "percentage": 18,
    "type": "PERCENTAGE",
    "status": "ACTIVE"
  },
  "message": "Tax created successfully."
}
```

---

## 8. Subscription Status & Account Lock Rules

1. **Free Trial**: New vendor accounts receive a 30-day Free Trial by default (`subscriptionStatus: FREE_TRIAL`).
2. **Subscription Expiry**: If `subscriptionExpiryDate` passes:
   - POS checkout, bill generation, and inventory edits trigger soft-lock read-only responses (`isSubscriptionExpired: true`, `isReadOnly: true`).
   - The UI redirects the vendor to `/choose-package` to upgrade their SaaS plan.
3. **Account Suspension**: If `accountStatus === 'SUSPENDED'` by Super Admin, all vendor and counter staff API requests are blocked with `403 Forbidden`.
