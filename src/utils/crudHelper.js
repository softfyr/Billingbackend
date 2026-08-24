import { prisma } from '../config/prisma.js';
import { ApiError } from './apiError.js';

/**
 * Reusable CRUD Helper for Prisma Models
 */
export const crudHelper = (modelName) => {
  const model = prisma[modelName];

  if (!model) {
    throw new Error(`Prisma model '${modelName}' does not exist.`);
  }

  return {
    /**
     * Find all records with optional filtering, pagination, and inclusion
     */
    findAll: async ({ where = {}, select = null, include = null, orderBy = { createdAt: 'desc' }, page = 1, limit = 50 } = {}) => {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const [data, total] = await Promise.all([
        model.findMany({
          where,
          ...(select ? { select } : include ? { include } : {}),
          orderBy,
          skip,
          take
        }),
        model.count({ where })
      ]);

      return {
        data,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      };
    },

    /**
     * Find single record by ID or unique filter
     */
    findById: async (id, { select = null, include = null } = {}) => {
      const record = await model.findUnique({
        where: { id },
        ...(select ? { select } : include ? { include } : {})
      });

      if (!record) {
        throw new ApiError(404, `${modelName} record not found.`);
      }

      return record;
    },

    /**
     * Create a new record
     */
    createOne: async (data, { select = null, include = null } = {}) => {
      return await model.create({
        data,
        ...(select ? { select } : include ? { include } : {})
      });
    },

    /**
     * Update record by ID
     */
    updateOne: async (id, data, { select = null, include = null } = {}) => {
      const existing = await model.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, `${modelName} record not found.`);
      }

      return await model.update({
        where: { id },
        data,
        ...(select ? { select } : include ? { include } : {})
      });
    },

    /**
     * Delete record by ID
     */
    deleteOne: async (id) => {
      const existing = await model.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, `${modelName} record not found.`);
      }

      return await model.delete({ where: { id } });
    }
  };
};
