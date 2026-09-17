import { parseSafeDate } from './validation.utility.js';

/**
 * 🎯 Global Query Filter Builder
 * Centralizes common Prisma `where` clause construction for tenant isolation, date range filtering,
 * status filtering, and multi-field text search.
 *
 * @param {Object} options
 * @param {string} options.tenantId - Tenant ID for isolation
 * @param {string|Date} [options.startDate] - Start date for filtering
 * @param {string|Date} [options.endDate] - End date for filtering
 * @param {string} [options.status] - Status enum value
 * @param {string} [options.search] - Search text
 * @param {Array<string>} [options.searchFields] - Field names to search within
 * @param {Array<string>} [options.excludeStatuses] - Statuses to exclude (e.g. ['CANCELLED'])
 * @returns {Object} Prisma `where` clause object
 */
export const buildQueryFilters = ({
  tenantId,
  startDate,
  endDate,
  status,
  search,
  searchFields = [],
  excludeStatuses = []
}) => {
  const where = { tenantId };

  // Date Range Filtering
  const parsedStart = parseSafeDate(startDate);
  const parsedEnd = parseSafeDate(endDate);

  if (parsedStart || parsedEnd) {
    where.createdAt = {};
    if (parsedStart) where.createdAt.gte = parsedStart;
    if (parsedEnd) {
      // Set end date to end of day if time part is not specified
      const endOfDay = new Date(parsedEnd);
      if (typeof endDate === 'string' && !endDate.includes('T')) {
        endOfDay.setHours(23, 59, 59, 999);
      }
      where.createdAt.lte = endOfDay;
    }
  }

  // Exact Status Filter
  if (status) {
    where.purchaseStatus = status;
  } else if (excludeStatuses && excludeStatuses.length > 0) {
    where.purchaseStatus = { notIn: excludeStatuses };
  }

  // Text Search Filter
  if (search && search.trim() && searchFields.length > 0) {
    const searchTerm = search.trim();
    where.OR = searchFields.map(field => {
      // Support nested fields (e.g., 'supplier.name')
      if (field.includes('.')) {
        const parts = field.split('.');
        return {
          [parts[0]]: {
            [parts[1]]: { contains: searchTerm, mode: 'insensitive' }
          }
        };
      }
      return {
        [field]: { contains: searchTerm, mode: 'insensitive' }
      };
    });
  }

  return where;
};
