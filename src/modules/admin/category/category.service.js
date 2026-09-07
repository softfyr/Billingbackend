import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';

// --- CATEGORY CRUD ---

export const createCategory = async (name, description) => {
  const cleanName = name.trim();
  const existing = await prisma.category.findFirst({
    where: { name: { equals: cleanName, mode: 'insensitive' } }
  });
  if (existing) throw new ApiError(400, 'Category with this name already exists.');

  return await prisma.category.create({
    data: { name: cleanName, description }
  });
};

export const getCategories = async (searchQuery) => {
  const where = {};
  if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
    const q = searchQuery.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { subCategories: { some: { name: { contains: q, mode: 'insensitive' } } } }
    ];
  }

  return await prisma.category.findMany({
    where,
    include: {
      subCategories: {
        include: { additionalFields: true }
      },
      _count: { select: { products: true } }
    },
    orderBy: { name: 'asc' }
  });
};

export const getCategoryById = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      subCategories: {
        include: { additionalFields: true }
      },
      _count: { select: { products: true } }
    }
  });
  if (!category) throw new ApiError(404, 'Category not found.');
  return category;
};

export const updateCategory = async (categoryId, data = {}) => {
  const { name, description } = data;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, 'Category not found.');

  const updateData = {};
  if (description !== undefined) updateData.description = description;

  if (name && name.trim() !== category.name) {
    const cleanName = name.trim();
    const existing = await prisma.category.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
        NOT: { id: categoryId }
      }
    });
    if (existing) throw new ApiError(400, 'Category with this name already exists.');
    updateData.name = cleanName;
  }

  return await prisma.category.update({
    where: { id: categoryId },
    data: updateData,
    include: {
      subCategories: {
        include: { additionalFields: true }
      }
    }
  });
};

export const deleteCategory = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      subCategories: { select: { id: true } }
    }
  });
  if (!category) throw new ApiError(404, 'Category not found.');

  const subCategoryIds = (category.subCategories || []).map((s) => s.id);
  const whereOr = [{ categoryId }];
  if (subCategoryIds.length > 0) {
    whereOr.push({ subCategoryId: { in: subCategoryIds } });
  }

  const productCount = await prisma.product.count({
    where: { OR: whereOr }
  });

  if (productCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete Category '${category.name}' because ${productCount} product(s) are linked to it or its sub-categories. Please delete or reassign those products first.`
    );
  }

  try {
    await prisma.category.delete({ where: { id: categoryId } });
    return { success: true, message: `Category '${category.name}' deleted successfully.` };
  } catch (error) {
    if (error.code === 'P2003' || error.message?.includes('foreign key constraint')) {
      throw new ApiError(400, `Cannot delete Category '${category.name}' because products are referencing it.`);
    }
    throw error;
  }
};


// --- SUB-CATEGORY CRUD ---

export const createSubCategory = async (categoryId, name, description, enableExpiryDate = false, additionalFields = []) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, 'Parent Category not found.');

  const cleanName = name.trim();
  const existing = await prisma.subCategory.findFirst({
    where: {
      categoryId,
      name: { equals: cleanName, mode: 'insensitive' }
    }
  });
  if (existing) throw new ApiError(400, 'Sub-Category with this name already exists under this Category.');

  const subCategory = await prisma.subCategory.create({
    data: {
      categoryId,
      name: cleanName,
      description,
      enableExpiryDate: Boolean(enableExpiryDate)
    },
    include: { additionalFields: true }
  });

  if (Array.isArray(additionalFields) && additionalFields.length > 0) {
    for (const field of additionalFields) {
      if (field.labelName && field.labelName.trim()) {
        await prisma.additionalField.create({
          data: {
            subCategoryId: subCategory.id,
            labelName: field.labelName.trim(),
            inputType: field.inputType || 'TEXT',
            isRequired: Boolean(field.isRequired),
            status: 'ACTIVE'
          }
        });
      }
    }
  }

  return await prisma.subCategory.findUnique({
    where: { id: subCategory.id },
    include: { additionalFields: true }
  });
};

export const getSubCategories = async (categoryId) => {
  const where = {};
  if (categoryId) {
    where.categoryId = categoryId;
  }

  return await prisma.subCategory.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      additionalFields: true,
      _count: { select: { products: true } }
    },
    orderBy: { name: 'asc' }
  });
};

export const getSubCategoryById = async (subCategoryId) => {
  const subCategory = await prisma.subCategory.findUnique({
    where: { id: subCategoryId },
    include: {
      category: { select: { id: true, name: true } },
      additionalFields: true,
      _count: { select: { products: true } }
    }
  });
  if (!subCategory) throw new ApiError(404, 'Sub-Category not found.');
  return subCategory;
};

export const updateSubCategory = async (subCategoryId, data = {}) => {
  const { name, description, enableExpiryDate } = data;
  const subCategory = await prisma.subCategory.findUnique({ where: { id: subCategoryId } });
  if (!subCategory) throw new ApiError(404, 'Sub-Category not found.');

  const updateData = {};
  if (description !== undefined) updateData.description = description;
  if (enableExpiryDate !== undefined) updateData.enableExpiryDate = Boolean(enableExpiryDate);

  if (name && name.trim() !== subCategory.name) {
    const cleanName = name.trim();
    const existing = await prisma.subCategory.findFirst({
      where: {
        categoryId: subCategory.categoryId,
        name: { equals: cleanName, mode: 'insensitive' },
        NOT: { id: subCategoryId }
      }
    });
    if (existing) throw new ApiError(400, 'Sub-Category with this name already exists under this Category.');
    updateData.name = cleanName;
  }

  return await prisma.subCategory.update({
    where: { id: subCategoryId },
    data: updateData,
    include: { additionalFields: true }
  });
};

export const deleteSubCategory = async (subCategoryId) => {
  const subCategory = await prisma.subCategory.findUnique({ where: { id: subCategoryId } });
  if (!subCategory) throw new ApiError(404, 'Sub-Category not found.');

  const productCount = await prisma.product.count({
    where: { subCategoryId }
  });

  if (productCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete Sub-Category '${subCategory.name}' because ${productCount} product(s) are linked to it. Please delete or reassign those products first.`
    );
  }

  try {
    await prisma.subCategory.delete({ where: { id: subCategoryId } });
    return { success: true, message: `Sub-Category '${subCategory.name}' deleted successfully.` };
  } catch (error) {
    if (error.code === 'P2003' || error.message?.includes('foreign key constraint')) {
      throw new ApiError(400, `Cannot delete Sub-Category '${subCategory.name}' because products are referencing it.`);
    }
    throw error;
  }
};


// --- DYNAMIC ADDITIONAL FIELDS CRUD ---

export const addAdditionalField = async (subCategoryId, fieldData = {}) => {
  const { labelName, inputType, isRequired, status } = fieldData;

  const subCategory = await prisma.subCategory.findUnique({ where: { id: subCategoryId } });
  if (!subCategory) throw new ApiError(404, 'Sub-Category not found.');

  const cleanLabel = labelName ? labelName.trim() : 'Custom Field';
  const existing = await prisma.additionalField.findFirst({
    where: {
      subCategoryId,
      labelName: { equals: cleanLabel, mode: 'insensitive' }
    }
  });
  if (existing) throw new ApiError(400, `Field '${cleanLabel}' already exists in this Sub-Category.`);

  return await prisma.additionalField.create({
    data: {
      subCategoryId,
      labelName: cleanLabel,
      inputType: inputType || 'TEXT',
      isRequired: Boolean(isRequired),
      status: status || 'ACTIVE'
    }
  });
};

export const updateAdditionalField = async (fieldId, fieldData = {}) => {
  const { labelName, inputType, isRequired, status } = fieldData;
  const field = await prisma.additionalField.findUnique({ where: { id: fieldId } });
  if (!field) throw new ApiError(404, 'Additional Field configuration not found.');

  const updateData = {};
  if (inputType) updateData.inputType = inputType;
  if (isRequired !== undefined) updateData.isRequired = Boolean(isRequired);
  if (status) updateData.status = status;

  if (labelName && labelName.trim() !== field.labelName) {
    const cleanLabel = labelName.trim();
    const existing = await prisma.additionalField.findFirst({
      where: {
        subCategoryId: field.subCategoryId,
        labelName: { equals: cleanLabel, mode: 'insensitive' },
        NOT: { id: fieldId }
      }
    });
    if (existing) throw new ApiError(400, `Field '${cleanLabel}' already exists in this Sub-Category.`);
    updateData.labelName = cleanLabel;
  }

  return await prisma.additionalField.update({
    where: { id: fieldId },
    data: updateData
  });
};

export const deleteAdditionalField = async (fieldId) => {
  const field = await prisma.additionalField.findUnique({ where: { id: fieldId } });
  if (!field) throw new ApiError(404, 'Additional Field configuration not found.');

  await prisma.additionalField.delete({ where: { id: fieldId } });
  return { success: true, message: `Field '${field.labelName}' deleted successfully.` };
};
