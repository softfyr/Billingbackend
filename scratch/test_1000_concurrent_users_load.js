import { prisma } from '../src/config/prisma.js';
import { generateBill } from '../src/modules/bill/bill.service.js';
import { getProducts } from '../src/modules/product/product.service.js';

async function run1000ConcurrentUsersLoadTest() {
  console.log('🚀 --- STARTING 1,000 CONCURRENT USERS LOAD & STRESS TEST ---');
  console.log('   Simulating 1,000 simultaneous billing, product scan & invoice transactions...\n');

  try {
    // 1. Setup Tenant, User & Products for Load Testing
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          ownerName: 'Load Tester',
          mobileNumber: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          businessName: 'Load Test Superstore',
          subscriptionExpiryDate: new Date(Date.now() + 30 * 86400000)
        }
      });
    }

    let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Load Staff',
          mobileNumber: tenant.mobileNumber,
          passwordHash: 'hashedpass',
          tenantId: tenant.id,
          role: 'TENANT_ADMIN'
        }
      });
    }

    let category = await prisma.category.findFirst() || await prisma.category.create({ data: { name: `Load Cat ${Date.now()}` } });
    let subCategory = await prisma.subCategory.findFirst({ where: { categoryId: category.id } }) ||
                      await prisma.subCategory.create({ data: { categoryId: category.id, name: `Load SubCat ${Date.now()}` } });
    let tax18 = await prisma.tax.findFirst({ where: { tenantId: tenant.id, percentage: 18 } }) ||
                await prisma.tax.create({ data: { tenantId: tenant.id, name: 'GST 18%', percentage: 18 } });

    // Seed 5 high-inventory products for 1,000 concurrent bills
    const products = [];
    for (let i = 1; i <= 5; i++) {
      const p = await prisma.product.create({
        data: {
          tenantId: tenant.id, categoryId: category.id, subCategoryId: subCategory.id,
          name: `Load Test Product ${i}`, sku: `SKU-LOAD-${i}-${Date.now()}`, hsnCode: '8471',
          sellingPrice: 100 * i, mrp: 100 * i, taxType: i % 2 === 0 ? 'INCLUSIVE' : 'EXCLUSIVE', taxId: tax18.id,
          currentStock: 10000 // Large stock to withstand 1,000 sales
        }
      });
      products.push(p);
    }

    console.log(`1️⃣ Seeded Load Testing Environment (Tenant ID: ${tenant.id}, Products: 5, Initial Stock: 10,000 each).\n`);

    // 2. Prepare 1,000 Concurrent User Tasks
    const TOTAL_CONCURRENT_USERS = 1000;
    console.log(`2️⃣ Firing ${TOTAL_CONCURRENT_USERS} Parallel Async Requests...`);

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    const latencies = [];

    // Create 1,000 parallel async operations combining Product Scans, Billing, and Catalog Queries
    const tasks = Array.from({ length: TOTAL_CONCURRENT_USERS }, async (_, index) => {
      const reqStart = Date.now();
      try {
        const prod = products[index % products.length];
        const taskType = index % 3;

        if (taskType === 0) {
          // Operation A: Generate Sales Invoice (POS Billing)
          await generateBill(tenant.id, user.id, {
            customerMobile: `9${String(100000000 + (index % 1000)).slice(-9)}`,
            customerName: `Customer ${index}`,
            items: [{ productId: prod.id, quantity: 1 }]
          });
        } else if (taskType === 1) {
          // Operation B: POS Scanner Lookup by SKU/HSN
          await getProducts(tenant.id, { search: prod.sku });
        } else {
          // Operation C: Fetch Product Catalog
          await getProducts(tenant.id, { page: 1, limit: 10 });
        }

        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);
        successCount++;
      } catch (err) {
        failureCount++;
        console.error(`Request ${index} failed:`, err.message);
      }
    });

    // Run all 1,000 tasks concurrently using Promise.allSettled
    await Promise.allSettled(tasks);

    const totalTimeMs = Date.now() - startTime;
    const totalTimeSec = totalTimeMs / 1000;
    const requestsPerSec = Math.round((TOTAL_CONCURRENT_USERS / totalTimeSec) * 100) / 100;
    const avgLatencyMs = latencies.length > 0 ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100 : 0;
    latencies.sort((a, b) => a - b);
    const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)] || 0;

    console.log('\n📊 --- 1,000 CONCURRENT USERS LOAD TEST RESULTS ---');
    console.log(`   - Total Requests Fired:    ${TOTAL_CONCURRENT_USERS}`);
    console.log(`   - Successful Operations:   ${successCount} ✅`);
    console.log(`   - Failed Operations:       ${failureCount} ❌`);
    console.log(`   - Total Execution Time:    ${totalTimeSec.toFixed(2)} seconds`);
    console.log(`   - Throughput (RPS):        ${requestsPerSec} requests/sec`);
    console.log(`   - Average Latency:         ${avgLatencyMs} ms`);
    console.log(`   - 95th Percentile (P95):   ${p95LatencyMs} ms`);
    console.log(`   - 99th Percentile (P99):   ${p99LatencyMs} ms`);

    const successRate = (successCount / TOTAL_CONCURRENT_USERS) * 100;
    console.log(`   - Success Rate:            ${successRate.toFixed(2)}%\n`);

    if (successRate >= 99) {
      console.log('🎉 --- SYSTEM PASSED 1,000 CONCURRENT USERS STRESS TEST WITH FLYING COLORS! ---');
    } else {
      console.warn('⚠️ Some requests failed under high concurrency. Database connection pool tuning recommended.');
    }
  } catch (err) {
    console.error('❌ Load test execution failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run1000ConcurrentUsersLoadTest();
