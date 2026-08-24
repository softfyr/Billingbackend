import { prisma } from '../../../config/prisma.js';

export const updatePolicy = async (type, title, content) => {
  return await prisma.policy.upsert({
    where: { type },
    update: { title, content },
    create: { type, title, content }
  });
};

export const getPolicies = async () => {
  return await prisma.policy.findMany();
};

export const updateContactInfo = async (data) => {
  const { contactNumber, whatsappNumber, emailAddress, address, socialMedia } = data;

  const firstRecord = await prisma.contactInfo.findFirst();
  if (firstRecord) {
    return await prisma.contactInfo.update({
      where: { id: firstRecord.id },
      data: { contactNumber, whatsappNumber, emailAddress, address, socialMedia }
    });
  }

  return await prisma.contactInfo.create({
    data: { contactNumber, whatsappNumber, emailAddress, address, socialMedia }
  });
};

export const getContactInfo = async () => {
  return await prisma.contactInfo.findFirst();
};
