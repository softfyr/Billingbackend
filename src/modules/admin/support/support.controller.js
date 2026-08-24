import * as supportService from './support.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

export const handleGetAllSupportTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.getAllSupportTickets(req.query);
  return res.status(200).json(new ApiResponse(200, tickets, 'Support Tickets fetched successfully.'));
});

export const handleGetSupportTicketDetailsAdmin = asyncHandler(async (req, res) => {
  const ticket = await supportService.getSupportTicketDetailsAdmin(req.params.ticketId);
  return res.status(200).json(new ApiResponse(200, ticket, 'Support Ticket details fetched successfully.'));
});

export const handleReplySupportTicketAdmin = asyncHandler(async (req, res) => {
  const { message, status } = req.body;
  const result = await supportService.replySupportTicketAdmin(req.user.id, req.params.ticketId, message, status);
  return res.status(200).json(new ApiResponse(200, result, 'Reply submitted successfully.'));
});

export const handleUpdateTicketStatusAdmin = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ticket = await supportService.updateTicketStatusAdmin(req.params.ticketId, status);
  return res.status(200).json(new ApiResponse(200, ticket, `Ticket status updated to ${status}.`));
});
