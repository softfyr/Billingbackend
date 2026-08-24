/**
 * 📑 Global Pagination Utility
 * Standardizes page/limit query parsing and pagination metadata formatting across all backend modules.
 */

/**
 * Parses and sanitizes `page` and `limit` from request query params.
 * 
 * @param {Object} query - Express request query object (req.query)
 * @param {number} defaultLimit - Default items per page (default: 10)
 * @returns {Object} { page, limit, skip, take }
 */
export const getPaginationParams = (query = {}, defaultLimit = 10) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || defaultLimit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit
  };
};

/**
 * Constructs a standardized paginated response structure.
 * 
 * @param {Array} items - Array of retrieved data records
 * @param {number} totalCount - Total matching records count in database
 * @param {number} page - Current page number
 * @param {number} limit - Current limit / page size
 * @param {Object} extraSummary - Optional extra summaries (e.g. KPI metrics, status tab counts)
 * @returns {Object} Standardized paginated response object
 */
export const formatPaginatedResult = (items = [], totalCount = 0, page = 1, limit = 10, extraSummary = {}) => {
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    items,
    pagination: {
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    ...extraSummary
  };
};
