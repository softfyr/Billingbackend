/**
 * Centralized Document Sequence Number Generator
 * Handles tenant-scoped, collision-resistant sequential document numbers (INV-1001-XXXX, PUR-1001, RET-1001).
 */

export const generateNextDocumentNumber = async (tx, {
  tenantId,
  modelName,
  fieldName = 'invoiceNumber',
  prefix = 'INV',
  withMicroHash = false,
  startNumber = 1001
}) => {
  let attempts = 0;
  let candidateNumber;

  while (!candidateNumber && attempts < 5) {
    attempts++;

    // Find the latest document for this tenant to extract sequential number
    const lastDoc = await tx[modelName].findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { [fieldName]: true }
    });

    let nextSeq = startNumber;

    if (lastDoc && lastDoc[fieldName]) {
      const regex = new RegExp(`${prefix}-(\\d+)`, 'i');
      const match = lastDoc[fieldName].match(regex);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      } else {
        const count = await tx[modelName].count({ where: { tenantId } });
        nextSeq = count + startNumber;
      }
    }

    if (withMicroHash) {
      const microHash = Math.random().toString(36).substring(2, 6).toUpperCase();
      const candidate = `${prefix}-${nextSeq}-${microHash}`;

      const existing = await tx[modelName].findFirst({
        where: { tenantId, [fieldName]: candidate }
      });

      if (!existing) {
        candidateNumber = candidate;
      }
    } else {
      const candidate = `${prefix}-${nextSeq}`;

      const existing = await tx[modelName].findFirst({
        where: { tenantId, [fieldName]: candidate }
      });

      if (!existing) {
        candidateNumber = candidate;
      } else {
        // Fallback increment on collision
        nextSeq += attempts;
        candidateNumber = `${prefix}-${nextSeq}`;
      }
    }
  }

  if (!candidateNumber) {
    const count = await tx[modelName].count({ where: { tenantId } });
    const microHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    candidateNumber = `${prefix}-${count + Date.now().toString().slice(-4)}${withMicroHash ? `-${microHash}` : ''}`;
  }

  return candidateNumber;
};
