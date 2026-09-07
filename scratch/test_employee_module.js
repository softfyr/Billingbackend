import 'dotenv/config';
process.env.SMS_PROVIDER = 'CONSOLE';
import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { generateAuthTokens } from '../src/utils/auth.util.js';

const PORT = 5096;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function testEmployeeModule() {
  console.log('🧪 --- TESTING EMPLOYEE MODULE CREATION ---');
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

    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const tenant = await prisma.tenant.create({
      data: {
        businessName: `Store ${testMobile}`,
        ownerName: 'Vendor Owner',
        mobileNumber: testMobile,
        subscriptionStatus: 'UPGRADED',
        accountStatus: 'ACTIVE',
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    const vendorUser = await prisma.user.create({
      data: {
        name: 'Vendor Owner',
        mobileNumber: testMobile,
        passwordHash: 'dummy',
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        tenantId: tenant.id
      }
    });

    const tokens = generateAuthTokens({
      userId: vendorUser.id,
      role: 'vendor',
      userRoleEnum: 'TENANT_ADMIN',
      tenantId: tenant.id
    });

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.accessToken}` };

    // Create Employee via POST /api/v1/employees
    const empMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const createRes = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Ramesh Employee',
        mobileNumber: empMobile,
        password: 'empPassword123'
      })
    });

    const createData = await createRes.json();
    assert(createRes.status === 201, 'Employee registered via POST /api/v1/employees.');
    assert(createData.data.user.role === 'EMPLOYEE', 'Created user has role EMPLOYEE.');

    // List Employees
    const listRes = await fetch(`${BASE_URL}/employees`, { headers });
    const listData = await listRes.json();
    assert(listRes.status === 200 && listData.data.length > 0, 'Employees listed successfully.');

    // Cleanup
    await prisma.employeeProfile.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    assert(true, 'Test records cleaned up.');

  } catch (err) {
    console.error('❌ Error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    console.log(`📊 RESULT: PASSED: ${passed} | FAILED: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

testEmployeeModule();
