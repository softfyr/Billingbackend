import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function showPackages() {
  const pkgs = await prisma.package.findMany({ orderBy: { amount: 'asc' } });
  console.log('📦 AVAILABLE PACKAGES & UUIDs:\n');
  pkgs.forEach(pkg => {
    console.log(`- Name: ${pkg.packageName}`);
    console.log(`  UUID: ${pkg.id}`);
    console.log(`  Amount: ₹${pkg.amount}`);
    console.log(`  Duration: ${pkg.durationMonths} Months\n`);
  });
  await prisma.$disconnect();
}

showPackages();
