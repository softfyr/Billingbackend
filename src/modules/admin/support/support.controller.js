import * as supportService from './support.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleGetAllSupportTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.getAllSupportTickets(req.query);
  return ApiResponse.success(res, tickets, 'Support Tickets fetched successfully.');
});

export const handleGetSupportTicketDetailsAdmin = asyncHandler(async (req, res) => {
  const ticket = await supportService.getSupportTicketDetailsAdmin(req.params.ticketId);
  return ApiResponse.success(res, ticket, 'Support Ticket details fetched successfully.');
});

export const handleReplySupportTicketAdmin = asyncHandler(async (req, res) => {
  const { message, status } = req.body;
  const result = await supportService.replySupportTicketAdmin(req.user.id, req.params.ticketId, message, status);
  return ApiResponse.success(res, result, 'Reply submitted successfully.');
});

export const handleUpdateTicketStatusAdmin = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ticket = await supportService.updateTicketStatusAdmin(req.params.ticketId, status);
  return ApiResponse.success(res, ticket, `Ticket status updated to ${status}.`);
});
