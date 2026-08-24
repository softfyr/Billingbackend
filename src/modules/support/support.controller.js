import * as supportService from './support.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleCreateSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.createSupportTicket(req.tenantId, req.user.id, req.body);
  return res.status(201).json(new ApiResponse(201, ticket, 'Support ticket created successfully.'));
});

export const handleGetVendorSupportTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.getVendorSupportTickets(req.tenantId);
  return res.status(200).json(new ApiResponse(200, tickets, 'Support tickets list fetched successfully.'));
});

export const handleGetTicketDetailsVendor = asyncHandler(async (req, res) => {
  const ticket = await supportService.getTicketDetailsVendor(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, ticket, 'Support ticket details fetched successfully.'));
});

export const handleReplySupportTicketVendor = asyncHandler(async (req, res) => {
  const { message, attachmentUrl } = req.body;
  const reply = await supportService.replySupportTicketVendor(req.tenantId, req.user.id, req.params.id, message, attachmentUrl);
  return res.status(200).json(new ApiResponse(200, reply, 'Ticket reply submitted successfully.'));
});
