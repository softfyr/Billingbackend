import app from './app.js';
import { prisma } from './config/prisma.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Verify Database Connection
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL Database via Prisma.');

    app.listen(PORT, () => {
      console.log(`🚀 Multi-Tenant Billing SaaS Backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

startServer();
