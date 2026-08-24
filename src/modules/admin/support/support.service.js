import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';

export const getAllSupportTickets = async (filters = {}) => {
  const { status } = filters;
  const where = {};
  if (status && status !== 'ALL') where.status = status;

  return await prisma.supportTicket.findMany({
    where,
    include: {
      tenant: { select: { id: true, businessName: true, ownerName: true, email: true, mobileNumber: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 }
    },
    orderBy: { updatedAt: 'desc' }
  });
};

export const getSupportTicketDetailsAdmin = async (ticketId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      tenant: { select: { id: true, businessName: true, ownerName: true, email: true, mobileNumber: true } },
      messages: {
        include: { senderUser: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!ticket) throw new ApiError(404, 'Support Ticket not found.');
  return ticket;
};

export const replySupportTicketAdmin = async (adminUserId, ticketId, message, status) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new ApiError(404, 'Support Ticket not found.');

  return await prisma.$transaction(async (tx) => {
    const ticketMessage = await tx.ticketMessage.create({
      data: {
        ticketId,
        senderUserId: adminUserId,
        message: message.trim(),
        isFromAdmin: true
      }
    });

    const updatedTicket = await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: status || 'PENDING',
        updatedAt: new Date()
      }
    });

    return { ticketMessage, ticketStatus: updatedTicket.status };
  });
};

export const updateTicketStatusAdmin = async (ticketId, status) => {
  const validStatuses = ['OPEN', 'PENDING', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid ticket status. Must be OPEN, PENDING, or CLOSED.');
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new ApiError(404, 'Support Ticket not found.');

  return await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status }
  });
};
