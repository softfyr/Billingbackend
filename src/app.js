import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/error.middleware.js';

// Route Imports
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import businessRoutes from './modules/business/business.routes.js';
import productRoutes from './modules/product/product.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import employeeRoutes from './modules/employee/employee.routes.js';
import billRoutes from './modules/bill/bill.routes.js';
import supplierRoutes from './modules/supplier/supplier.routes.js';
import purchaseRoutes from './modules/purchase/purchase.routes.js';
import reportRoutes from './modules/report/report.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import subscriptionRoutes from './modules/subscription/subscription.routes.js';

import { setupSwagger } from './config/swagger.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '16kb', type: ['application/json', 'text/plain', 'application/*+json'] }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Setup Swagger API Documentation UI
setupSwagger(app);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Multi-Tenant Billing SaaS Backend API is active.', swaggerDocs: 'http://localhost:5000/api-docs' });
});

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/bills', billRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
