import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import taxRoutes from './modules/tax/tax.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';

import { setupSwagger } from './config/swagger.js';

dotenv.config();

const app = express();

// Secure HTTP Headers with Helmet
app.use(helmet());

// Global Rate Limiting Security Configuration (300 req / 15 min)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 300, // Limit each IP to 300 API requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    success: false,
    message: 'Rate limit exceeded. Too many requests sent to the server. Please slow down.'
  }
});

// Apply Global Rate Limiter
app.use('/api/', globalApiLimiter);

// CORS Configuration for Frontend Integration
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://softfyr-billing-frontend.vercel.app'
];

const processCorsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : [];

const allowedOrigins = [...defaultAllowedOrigins, ...processCorsOrigins];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      process.env.CORS_ORIGIN === '*' ||
      origin.endsWith('.vercel.app');

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS Warning] Origin blocked: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Tenant-ID',
    'x-tenant-id',
    'Accept',
    'Origin',
    'X-Requested-With'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Disposition']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight options across all routes

app.use(express.json({ limit: '10mb', type: ['application/json', 'text/plain', 'application/*+json'] }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup Swagger API Documentation UI
setupSwagger(app);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Multi-Tenant Billing SaaS Backend API is active.', swaggerDocs: 'http://localhost:5000/api-docs' });
});

// API v1 Routes
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/taxes', taxRoutes);
app.use('/api/v1/business/taxes', taxRoutes); // Backwards-compatible alias
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
app.use('/api/v1/subscription', subscriptionRoutes); // Backwards-compatible alias for singular 'subscription'
app.use('/api/v1/business/subscriptions', subscriptionRoutes);
app.use('/api/v1/business/subscription', subscriptionRoutes);

// Global Error Handler
app.use(errorHandler);


export default app;
