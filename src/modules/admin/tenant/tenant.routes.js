import { Router } from 'express';
import * as tenantController from './tenant.controller.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import {
  updateTenantSubscriptionSchema,
  updateTenantStatusSchema,
  updateBusinessInfoSchema,
  updateOwnerInfoSchema,
  createNoteSchema,
  updateNoteSchema,
  subscriptionActionSchema
} from './tenant.validator.js';

const router = Router();

// Static routes (placed before parameter routes)
router.get('/export', tenantController.handleExportTenants);

// Tenant List
router.get('/', tenantController.handleGetTenants);

// Tenant Details & Updates
router.get('/:id', tenantController.handleGetTenantDetails);
router.put('/:id/business-info', validate(updateBusinessInfoSchema), tenantController.handleUpdateBusinessInfo);
router.put('/:id/owner-info', validate(updateOwnerInfoSchema), tenantController.handleUpdateOwnerInfo);
router.put('/:id/status', validate(updateTenantStatusSchema), tenantController.handleUpdateTenantAccountStatus);

// Tenant Notes CRUD
router.get('/:id/notes', tenantController.handleGetTenantNotes);
router.post('/:id/notes', validate(createNoteSchema), tenantController.handleAddTenantNote);
router.put('/:id/notes/:noteId', validate(updateNoteSchema), tenantController.handleUpdateTenantNote);
router.delete('/:id/notes/:noteId', tenantController.handleDeleteTenantNote);

// Tenant Activity Logs & Employees Summary
router.get('/:id/activity-logs', tenantController.handleGetTenantActivityLogs);
router.get('/:id/employees', tenantController.handleGetTenantEmployees);

// Tenant Payments & Receipt/Export
router.get('/:id/payments/export', tenantController.handleExportTenantPayments);
router.get('/:id/payments', tenantController.handleGetTenantPayments);

// Subscription Summary, History & Quick Actions
router.get('/:id/subscription/history', tenantController.handleGetSubscriptionHistory);
router.put('/:id/subscription', validate(updateTenantSubscriptionSchema), tenantController.handleUpdateTenantSubscription);

// Unified Subscription Action Route (All-in-One)
router.post('/:id/subscription/action', validate(subscriptionActionSchema), tenantController.handleSubscriptionAction);

export default router;
