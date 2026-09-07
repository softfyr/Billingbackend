import 'dotenv/config';
process.env.SMS_PROVIDER = 'CONSOLE';
import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';
import { generateAuthTokens } from '../src/utils/auth.util.js';

const PORT = 5095;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runGlobalDashboardTest() {
  console.log('🧪 =========================================================================');
  console.log('🚀 --- STARTING UNIFIED GLOBAL DASHBOARD API TEST ---');
  console.log('🧪 =========================================================================\n');

  let server;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, () => resolve(s));
    });
    console.log(`🌐 Test server listening on http://localhost:${PORT}\n`);

    // 1. Setup Admin Token
    console.log('1️⃣ Generating Super Admin Token...');
    let adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
    if (!adminUser) {
      const hash = await bcrypt.hash('admin123', 10);
      const adminMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
      adminUser = await prisma.user.create({
        data: {
          name: 'Master Admin',
          email: `admin_${adminMobile}@softfyr.com`,
          mobileNumber: adminMobile,
          passwordHash: hash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE'
        }
      });
    }
    const adminTokens = generateAuthTokens({ userId: adminUser.id, role: 'admin', userRoleEnum: 'SUPER_ADMIN' });
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminTokens.accessToken}` };
    assert(!!adminTokens.accessToken, 'Super Admin auth token created.');

    // 2. Setup Vendor Tenant & Token
    console.log('\n2️⃣ Creating Test Vendor Tenant...');
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const tenant = await prisma.tenant.create({
      data: {
        businessName: `Dashboard Store ${testMobile}`,
        ownerName: 'Test Owner',
        mobileNumber: testMobile,
        email: `vendor_${testMobile}@test.com`,
        subscriptionStatus: 'UPGRADED',
        accountStatus: 'ACTIVE',
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    const vendorUser = await prisma.user.create({
      data: {
        name: 'Test Owner',
        email: `vendor_${testMobile}@test.com`,
        mobileNumber: testMobile,
        passwordHash: 'dummy',
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        tenantId: tenant.id
      }
    });

    const vendorTokens = generateAuthTokens({
      userId: vendorUser.id,
      role: 'vendor',
      userRoleEnum: 'TENANT_ADMIN',
      tenantId: tenant.id
    });
    const vendorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendorTokens.accessToken}` };
    assert(!!vendorTokens.accessToken, 'Vendor tenant & token created.');

    // 3. Test GET /api/v1/dashboard with Super Admin Token
    console.log('\n3️⃣ Testing GET /api/v1/dashboard as Super Admin...');
    const adminDashRes = await fetch(`${BASE_URL}/dashboard`, { headers: adminHeaders });
    if (!adminDashRes.ok) {
      const errText = await adminDashRes.text();
      console.error('Admin Dash Error Status:', adminDashRes.status, errText);
    }
    const adminDashData = await adminDashRes.json();
    assert(adminDashRes.status === 200 && adminDashData.data.type === 'SUPER_ADMIN_DASHBOARD', 'Super Admin received SUPER_ADMIN_DASHBOARD payload.');
    assert(adminDashData.data.tenantOverview !== undefined, 'Platform tenant overview metrics present.');

    // 4. Test GET /api/v1/dashboard with Vendor Token
    console.log('\n4️⃣ Testing GET /api/v1/dashboard as Vendor TENANT_ADMIN...');
    const vendorDashRes = await fetch(`${BASE_URL}/dashboard`, { headers: vendorHeaders });
    const vendorDashData = await vendorDashRes.json();
    assert(vendorDashRes.status === 200 && vendorDashData.data.type === 'VENDOR_STORE_DASHBOARD', 'Vendor received VENDOR_STORE_DASHBOARD payload.');
    assert(vendorDashData.data.kpis !== undefined, 'Store-specific KPIs present.');

    // 5. Test Backward Compatibility Routes
    console.log('\n5️⃣ Testing Backward Compatibility Routes...');
    const bkgBizRes = await fetch(`${BASE_URL}/business/dashboard`, { headers: vendorHeaders });
    const bkgBizData = await bkgBizRes.json();
    assert(bkgBizRes.status === 200 && bkgBizData.data.kpis !== undefined, 'GET /api/v1/business/dashboard works as expected.');

    const bkgAdminRes = await fetch(`${BASE_URL}/admin/dashboard`, { headers: adminHeaders });
    const bkgAdminData = await bkgAdminRes.json();
    assert(bkgAdminRes.status === 200 && bkgAdminData.data.tenantOverview !== undefined, 'GET /api/v1/admin/dashboard works as expected.');

    // Cleanup
    console.log('\n🧹 [CLEANUP] Deleting test tenant & user...');
    await prisma.user.delete({ where: { id: vendorUser.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    assert(true, 'Test records cleaned up.');

  } catch (err) {
    console.error('❌ Test Execution Error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    console.log('\n🧪 =========================================================================');
    console.log(`📊 TEST SUMMARY: PASSED: ${passed} | FAILED: ${failed}`);
    console.log('🧪 =========================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runGlobalDashboardTest();
