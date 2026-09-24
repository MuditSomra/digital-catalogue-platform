import { prisma } from "./prisma";
import { slugify } from "./slugify";
import type {
  CreateCategoryAttributeInput,
  UpdateCategoryAttributeInput,
  CreateAttributeValueInput,
  UpdateAttributeValueInput,
} from "../validations/attribute";

/**
 * Custom application error with friendly, non-technical message.
 */
export class AttributeServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "AttributeServiceError";
  }
}

/**
 * Helper to generate a unique slug for an attribute within a category.
 */
async function generateUniqueAttributeSlug(
  categoryId: string,
  baseName: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = slugify(baseName) || "spec";
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.categoryAttribute.findUnique({
      where: {
        categoryId_slug: {
          categoryId,
          slug: candidate,
        },
      },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
}

/**
 * Retrieves all dynamic specifications for a specific category.
 */
export async function getCategoryAttributes(categoryId: string) {
  const categoryExists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true },
  });

  if (!categoryExists) {
    throw new AttributeServiceError("The selected category was not found.", 404);
  }

  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      predefinedValues: {
        orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      },
      _count: {
        select: {
          productAttributeValues: true,
          predefinedValues: true,
        },
      },
    },
  });

  return attributes;
}

/**
 * Creates a new dynamic specification inside a category.
 */
export async function createCategoryAttribute(input: CreateCategoryAttributeInput) {
  // 1. Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AttributeServiceError("The selected category was not found.", 404);
  }

  // 2. Check for duplicate name/slug within this category
  const candidateSlug = input.slug || slugify(input.name);
  const existingSameSlug = await prisma.categoryAttribute.findUnique({
    where: {
      categoryId_slug: {
        categoryId: input.categoryId,
        slug: candidateSlug,
      },
    },
    select: { id: true },
  });

  if (existingSameSlug) {
    throw new AttributeServiceError(
      `A specification with the name "${input.name}" already exists in this category. Please use a unique specification name.`
    );
  }

  const slug = candidateSlug;

  // 3. Determine sortOrder if not provided
  let sortOrder = input.sortOrder;
  if (!sortOrder) {
    const maxSort = await prisma.categoryAttribute.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  }

  // 4. Create attribute and initial options if provided
  const created = await prisma.$transaction(async (tx) => {
    const attr = await tx.categoryAttribute.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        slug,
        type: input.type,
        unit: input.unit || null,
        isFilterable: input.isFilterable ?? true,
        isRequired: input.isRequired ?? false,
        sortOrder,
      },
    });

    if (input.initialOptions && input.initialOptions.length > 0) {
      for (let i = 0; i < input.initialOptions.length; i++) {
        const opt = input.initialOptions[i];
        if (opt.trim()) {
          await tx.attributeValue.create({
            data: {
              attributeId: attr.id,
              value: opt.trim(),
              label: opt.trim(),
              sortOrder: i + 1,
            },
          });
        }
      }
    }

    return attr;
  });

  return getCategoryAttributeById(created.id);
}

/**
 * Retrieves a single category attribute by ID.
 */
export async function getCategoryAttributeById(id: string) {
  const attribute = await prisma.categoryAttribute.findUnique({
    where: { id },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      predefinedValues: {
        orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      },
      _count: {
        select: {
          productAttributeValues: true,
          predefinedValues: true,
        },
      },
    },
  });

  if (!attribute) {
    throw new AttributeServiceError("Specification not found.", 404);
  }

  return attribute;
}

/**
 * Updates a dynamic specification.
 */
export async function updateCategoryAttribute(id: string, input: UpdateCategoryAttributeInput) {
  const existing = await prisma.categoryAttribute.findUnique({
    where: { id },
    select: { id: true, categoryId: true, name: true, slug: true, type: true },
  });

  if (!existing) {
    throw new AttributeServiceError("Specification not found.", 404);
  }

  // Check duplicate slug within the same category if name/slug is changing
  let slug = existing.slug;
  if (input.name && input.name !== existing.name && !input.slug) {
    const targetSlug = slugify(input.name);
    const duplicate = await prisma.categoryAttribute.findUnique({
      where: {
        categoryId_slug: {
          categoryId: existing.categoryId,
          slug: targetSlug,
        },
      },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== id) {
      throw new AttributeServiceError(
        `A specification named "${input.name}" already exists in this category.`
      );
    }
    slug = targetSlug;
  } else if (input.slug && input.slug !== existing.slug) {
    const duplicate = await prisma.categoryAttribute.findUnique({
      where: {
        categoryId_slug: {
          categoryId: existing.categoryId,
          slug: input.slug,
        },
      },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== id) {
      throw new AttributeServiceError(
        `A specification with this internal slug already exists in this category.`
      );
    }
    slug = input.slug;
  }

  const updated = await prisma.categoryAttribute.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(slug !== existing.slug && { slug }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.isFilterable !== undefined && { isFilterable: input.isFilterable }),
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    include: {
      predefinedValues: {
        orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      },
      _count: {
        select: {
          productAttributeValues: true,
          predefinedValues: true,
        },
      },
    },
  });

  return updated;
}

/**
 * Safely deletes a dynamic specification if not referenced by products.
 */
export async function deleteCategoryAttribute(id: string) {
  const attribute = await prisma.categoryAttribute.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          productAttributeValues: true,
        },
      },
    },
  });

  if (!attribute) {
    throw new AttributeServiceError("Specification not found.", 404);
  }

  if (attribute._count.productAttributeValues > 0) {
    throw new AttributeServiceError(
      `This specification cannot be deleted because ${attribute._count.productAttributeValues} product(s) currently have values assigned for it. Please remove or update the products first.`
    );
  }

  return prisma.categoryAttribute.delete({
    where: { id },
  });
}

/**
 * Batch reorders category attributes.
 */
export async function reorderCategoryAttributes(items: { id: string; sortOrder: number }[]) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.categoryAttribute.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );
}

// ==============================================================================
// OPTION VALUES (AttributeValue)
// ==============================================================================

/**
 * Adds an option value to a specification.
 */
export async function createAttributeValue(input: CreateAttributeValueInput) {
  // 1. Verify specification exists
  const attribute = await prisma.categoryAttribute.findUnique({
    where: { id: input.attributeId },
    select: { id: true, name: true, type: true },
  });

  if (!attribute) {
    throw new AttributeServiceError("The specification was not found.", 404);
  }

  // 2. Check duplicate value within this attribute
  const existingVal = await prisma.attributeValue.findUnique({
    where: {
      attributeId_value: {
        attributeId: input.attributeId,
        value: input.value,
      },
    },
    select: { id: true },
  });

  if (existingVal) {
    throw new AttributeServiceError(
      `An option with the value "${input.value}" already exists for "${attribute.name}".`
    );
  }

  // 3. Determine sortOrder
  let sortOrder = input.sortOrder;
  if (!sortOrder) {
    const maxSort = await prisma.attributeValue.aggregate({
      where: { attributeId: input.attributeId },
      _max: { sortOrder: true },
    });
    sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  }

  return prisma.attributeValue.create({
    data: {
      attributeId: input.attributeId,
      value: input.value,
      label: input.label || input.value,
      sortOrder,
    },
  });
}

/**
 * Updates an option value or display label.
 */
export async function updateAttributeValue(id: string, input: UpdateAttributeValueInput) {
  const existing = await prisma.attributeValue.findUnique({
    where: { id },
    select: { id: true, attributeId: true, value: true, label: true },
  });

  if (!existing) {
    throw new AttributeServiceError("Option not found.", 404);
  }

  // Check duplicate value if value is changing
  if (input.value && input.value !== existing.value) {
    const duplicate = await prisma.attributeValue.findUnique({
      where: {
        attributeId_value: {
          attributeId: existing.attributeId,
          value: input.value,
        },
      },
      select: { id: true },
    });

    if (duplicate && duplicate.id !== id) {
      throw new AttributeServiceError(`An option with value "${input.value}" already exists.`);
    }
  }

  return prisma.attributeValue.update({
    where: { id },
    data: {
      ...(input.value !== undefined && { value: input.value }),
      ...(input.label !== undefined && { label: input.label }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
  });
}

/**
 * Safely deletes an option value if not currently assigned to products.
 */
export async function deleteAttributeValue(id: string) {
  const option = await prisma.attributeValue.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          productAttributeValues: true,
        },
      },
    },
  });

  if (!option) {
    throw new AttributeServiceError("Option not found.", 404);
  }

  if (option._count.productAttributeValues > 0) {
    throw new AttributeServiceError(
      `This option ("${option.label}") cannot be deleted because ${option._count.productAttributeValues} product(s) are currently assigned this value. Please update the affected products first.`
    );
  }

  return prisma.attributeValue.delete({
    where: { id },
  });
}

/**
 * Batch reorders attribute option values.
 */
export async function reorderAttributeValues(items: { id: string; sortOrder: number }[]) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.attributeValue.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );
}
