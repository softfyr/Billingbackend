import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export const createSupportTicket = async (tenantId, userId, data) => {
  const { subject, message, priority, attachmentUrl } = data;

  if (!subject || !message) {
    throw new ApiError(400, 'Subject and Message are required.');
  }

  const ticketCount = await prisma.supportTicket.count();
  const ticketNumber = `TCK-${Date.now().toString().slice(-6)}-${ticketCount + 1001}`;

  return await prisma.supportTicket.create({
    data: {
      ticketNumber,
      tenantId,
      subject,
      priority: priority || 'MEDIUM',
      status: 'OPEN',
      messages: {
        create: {
          senderUserId: userId,
          message,
          attachmentUrl,
          isFromAdmin: false
        }
      }
    },
    include: { messages: true }
  });
};

export const getVendorSupportTickets = async (tenantId) => {
  return await prisma.supportTicket.findMany({
    where: { tenantId },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 }
    },
    orderBy: { updatedAt: 'desc' }
  });
};

export const getTicketDetailsVendor = async (tenantId, ticketId) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenantId },
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!ticket) throw new ApiError(404, 'Support ticket not found.');
  return ticket;
};

export const replySupportTicketVendor = async (tenantId, userId, ticketId, message, attachmentUrl) => {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, tenantId } });
  if (!ticket) throw new ApiError(404, 'Support ticket not found.');
  if (ticket.status === 'CLOSED') throw new ApiError(400, 'Cannot reply to a closed ticket.');

  return await prisma.$transaction(async (tx) => {
    const msg = await tx.ticketMessage.create({
      data: {
        ticketId,
        senderUserId: userId,
        message,
        attachmentUrl,
        isFromAdmin: false
      }
    });

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'PENDING', updatedAt: new Date() }
    });

    return msg;
  });
};
