import * as supportService from './support.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleCreateSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.createSupportTicket(req.tenantId, req.user.id, req.body);
  return ApiResponse.created(res, ticket, 'Support ticket created successfully.');
});

export const handleGetVendorSupportTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.getVendorSupportTickets(req.tenantId);
  return ApiResponse.success(res, tickets, 'Support tickets list fetched successfully.');
});

export const handleGetTicketDetailsVendor = asyncHandler(async (req, res) => {
  const ticket = await supportService.getTicketDetailsVendor(req.tenantId, req.params.id);
  return ApiResponse.success(res, ticket, 'Support ticket details fetched successfully.');
});

export const handleReplySupportTicketVendor = asyncHandler(async (req, res) => {
  const { message, attachmentUrl } = req.body;
  const reply = await supportService.replySupportTicketVendor(req.tenantId, req.user.id, req.params.id, message, attachmentUrl);
  return ApiResponse.success(res, reply, 'Ticket reply submitted successfully.');
});
