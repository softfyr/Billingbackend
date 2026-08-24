const BASE_URL = 'http://localhost:5000/api/v1';

async function testMasterE2ESupplierModule() {
  console.log('🧪 --- STARTING MASTER END-TO-END SUPPLIER MODULE VERIFICATION ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const timeId = Date.now();

    // 1. Super Admin Setup Category & Sub-Category
    const adminLoginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@softfyr.com', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken || adminLoginData.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const catRes = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: `Supp Cat ${timeId}` })
    });
    const catData = await catRes.json();

    const subRes = await fetch(`${BASE_URL}/admin/sub-categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ categoryId: catData.data.id, name: `Supp SubCat ${timeId}` })
    });
    const subData = await subRes.json();

    // 2. Vendor OTP Sign-up
    const vendorMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile })
    });
    const sendOtpData = await sendOtpRes.json();

    const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: vendorMobile, otpCode: sendOtpData.data?.otpCode || '123456' })
    });
    const verifyOtpData = await verifyOtpRes.json();
    let vendorToken = verifyOtpData.data?.accessToken || verifyOtpData.data?.token;

    if (!vendorToken) {
      const pkgRes = await fetch(`${BASE_URL}/subscriptions/packages`);
      const pkgData = await pkgRes.json();

      const chooseRes = await fetch(`${BASE_URL}/auth/choose-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgData.data[0].id })
      });
      const chooseData = await chooseRes.json();
      vendorToken = chooseData.data?.accessToken || chooseData.data?.token;

      const profRes = await fetch(`${BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` },
        body: JSON.stringify({ businessName: `Supplier E2E Store ${timeId}`, ownerName: 'Store Owner', email: `owner${timeId}@store.com` })
      });
      const profData = await profRes.json();
      vendorToken = profData.data?.accessToken || profData.data?.token || vendorToken;
    }

    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorToken}` };

    // 3. Register Employee for Security Testing
    const empMobile = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({ name: 'Store Staff', mobileNumber: empMobile, password: 'staffpassword123' })
    });

    const empSendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile })
    });
    const empSendOtpData = await empSendOtpRes.json();

    const empVerifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: empMobile, otpCode: empSendOtpData.data?.otpCode || '123456' })
    });
    const empVerifyOtpData = await empVerifyOtpRes.json();
    const employeeToken = empVerifyOtpData.data?.accessToken || empVerifyOtpData.data?.token;
    const employeeHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employeeToken}` };

    // 4. Test 1: Register Suppliers (POST /suppliers)
    const suppMobile1 = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const supp1Res = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Mahaveer Electronics',
        companyName: 'Mahaveer Distribution Pvt Ltd',
        mobileNumber: suppMobile1,
        email: 'sales@mahaveer.com',
        gstin: '08AAAAA1111A1Z1',
        pan: 'AAAAA1111A',
        address: 'Sector 5, Industrial Area',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302012'
      })
    });
    const supp1Data = await supp1Res.json();
    const supplier1Id = supp1Data.data?.id;

    assert(supp1Res.status === 201 && supplier1Id, '1. POST /suppliers -> Created Supplier 1 (Mahaveer Electronics with GSTIN & PAN).');

    const suppMobile2 = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
    const supp2Res = await fetch(`${BASE_URL}/suppliers`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        name: 'Shree Ram Traders',
        companyName: 'Shree Ram Logistics',
        mobileNumber: suppMobile2,
        email: 'info@shreeram.com',
        gstin: '08BBBBB2222B1Z2'
      })
    });
    const supp2Data = await supp2Res.json();
    const supplier2Id = supp2Data.data?.id;

    assert(supp2Res.status === 201 && supplier2Id, '2. POST /suppliers -> Created Supplier 2 (Shree Ram Traders).');

    // 5. Test 2: List & Filter Suppliers (GET /suppliers)
    const listRes = await fetch(`${BASE_URL}/suppliers`, { headers: vendorHeaders });
    const listData = await listRes.json();
    assert(listRes.status === 200 && Array.isArray(listData.data) && listData.data.length >= 2, '3. GET /suppliers -> Listed all store suppliers.');

    // 6. Test 3: Search Suppliers by Name & GSTIN
    const searchRes = await fetch(`${BASE_URL}/suppliers?search=Mahaveer`, { headers: vendorHeaders });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.data?.length === 1 && searchData.data[0].id === supplier1Id, '4. GET /suppliers?search=Mahaveer -> Filtered supplier search correctly.');

    // 7. Test 4: Create Product & Issue Purchase Invoice (POST /purchases)
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        categoryId: catData.data.id,
        subCategoryId: subData.data.id,
        name: `Smart TV ${timeId}`,
        sellingPrice: 25000,
        purchasePrice: 20000,
        openingStock: 0
      })
    });
    const prodData = await prodRes.json();
    const productId = prodData.data?.id;

    const purRes = await fetch(`${BASE_URL}/purchases`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        supplierId: supplier1Id,
        supplierInvoiceNumber: `INV-MAH-${timeId}`,
        items: [{ productId, quantity: 2, unitPurchasePrice: 20000 }],
        paidAmount: 15000, // Bill = ₹40,000, Initial Paid = ₹15,000, Due = ₹25,000
        paymentMethod: 'CASH'
      })
    });
    const purData = await purRes.json();
    const purchaseId = purData.data?.id;

    assert(purRes.status === 201 && purchaseId && purData.data?.dueAmount === 25000, '5. POST /purchases -> Created Purchase Invoice (Bill: ₹40,000, Paid: ₹15,000, Due: ₹25,000).');

    // 8. Test 5: Standalone Supplier Payment Recording (POST /suppliers/:id/payments)
    const pmt1Res = await fetch(`${BASE_URL}/suppliers/${supplier1Id}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        amount: 15000,
        paymentMethod: 'UPI',
        referenceNumber: `UPI-SUPP-${timeId}`,
        notes: 'Partial payment to clear supplier dues'
      })
    });
    const pmt1Data = await pmt1Res.json();
    assert(pmt1Res.status === 201 && pmt1Data.data?.amount === 15000, '6. POST /suppliers/:id/payments -> Recorded standalone Supplier Payment of ₹15,000.');

    // 9. Test 6: Record Payment Modal Action on Purchase Invoice (POST /purchases/:id/payments)
    const pmtModalRes = await fetch(`${BASE_URL}/purchases/${purchaseId}/payments`, {
      method: 'POST',
      headers: vendorHeaders,
      body: JSON.stringify({
        amount: 25000,
        paymentMethod: 'BANK',
        notes: 'Cleared remaining dues via Invoice Modal'
      })
    });
    const pmtModalData = await pmtModalRes.json();
    assert(
      pmtModalRes.status === 200 && pmtModalData.data?.paymentStatus === 'PAID' && pmtModalData.data?.dueAmount === 0,
      '7. POST /purchases/:id/payments -> Invoice Record Payment Modal cleared remaining ₹25,000. Status updated to PAID.'
    );

    // 10. Test 7: Get Supplier Details (GET /suppliers/:id)
    const detailsRes = await fetch(`${BASE_URL}/suppliers/${supplier1Id}`, { headers: vendorHeaders });
    const detailsData = await detailsRes.json();
    const info = detailsData.data?.supplierInformation;
    const summary = detailsData.data?.financialSummary;

    assert(
      detailsRes.status === 200 &&
      info?.name === 'Mahaveer Electronics' &&
      summary?.totalPurchases === 40000 &&
      summary?.totalPaid === 40000 &&
      summary?.totalOutstanding === 0,
      '8. GET /suppliers/:id -> Fetched Deep Details & Financial Summary (Total Purchases: ₹40,000, Paid: ₹40,000, Outstanding: ₹0).'
    );

    // 11. Test 8: Get Supplier Double-Entry Account Ledger Statement (GET /suppliers/:id/ledger)
    const ledgerRes = await fetch(`${BASE_URL}/suppliers/${supplier1Id}/ledger`, { headers: vendorHeaders });
    const ledgerData = await ledgerRes.json();
    const statementSummary = ledgerData.data?.statementSummary;
    const ledgerEntries = ledgerData.data?.ledgerEntries;

    assert(
      ledgerRes.status === 200 &&
      statementSummary?.totalCredit === 40000 &&
      statementSummary?.totalDebit === 40000 &&
      statementSummary?.closingBalance === 0 &&
      Array.isArray(ledgerEntries) &&
      ledgerEntries.length >= 1,
      '9. GET /suppliers/:id/ledger -> Generated complete Double-Entry Account Ledger Statement with exact Running Balance (₹0).'
    );

    // 12. Test 9: Update Supplier Profile (PUT /suppliers/:id)
    const updateRes = await fetch(`${BASE_URL}/suppliers/${supplier1Id}`, {
      method: 'PUT',
      headers: vendorHeaders,
      body: JSON.stringify({
        email: 'updated.sales@mahaveer.com',
        companyName: 'Mahaveer Enterprises Pvt Ltd'
      })
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.data?.email === 'updated.sales@mahaveer.com', '10. PUT /suppliers/:id -> Updated Supplier profile information.');

    // 13. Test 10: Role-Based Security Enforcement (DELETE /suppliers/:id)
    const empDeleteRes = await fetch(`${BASE_URL}/suppliers/${supplier2Id}`, {
      method: 'DELETE',
      headers: employeeHeaders
    });
    assert(empDeleteRes.status === 403, '11. SECURITY ENFORCEMENT -> Employee token blocked from deleting supplier record with 403 Forbidden.');

    const adminDeleteRes = await fetch(`${BASE_URL}/suppliers/${supplier2Id}`, {
      method: 'DELETE',
      headers: vendorHeaders
    });
    assert(adminDeleteRes.status === 200, '12. DELETE /suppliers/:id -> Vendor Store Admin successfully deleted supplier record.');

    console.log(`\n📊 MASTER E2E SUPPLIER MODULE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    if (failed === 0) {
      console.log('🎉 --- ALL SUPPLIER MODULE FEATURES & LEDGER CAPABILITIES ARE 100% VERIFIED AND PASSED PERFECTLY ---');
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Master Supplier E2E Test Error:', error);
    process.exit(1);
  }
}

testMasterE2ESupplierModule();
