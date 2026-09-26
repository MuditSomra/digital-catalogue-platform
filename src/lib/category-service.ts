import { prisma } from "./prisma";
import { slugify } from "./slugify";
import type {
  CategoryTreeNode,
  CategoryBreadcrumb,
  CategoryDetailView,
} from "../types";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validations/category";

/**
 * Custom application error with friendly, non-technical message.
 */
export class CategoryServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "CategoryServiceError";
  }
}

/**
 * Helper to ensure unique slug across categories table.
 */
async function generateUniqueCategorySlug(baseName: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(baseName) || "category";
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.category.findUnique({
      where: { slug: candidate },
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
 * Validates whether proposedParentId would cause a circular hierarchy.
 */
async function validateNoCircularParent(categoryId: string, proposedParentId: string): Promise<void> {
  if (categoryId === proposedParentId) {
    throw new CategoryServiceError(
      "A category cannot be its own parent. Please select a different parent category or make it a top-level category."
    );
  }

  // Walk up the proposed parent's ancestors
  let currentParentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (currentParentId === categoryId) {
      throw new CategoryServiceError(
        "A category cannot be placed inside one of its own subcategories. This would create an infinite loop. Please choose a different parent category."
      );
    }

    if (visited.has(currentParentId)) {
      break;
    }
    visited.add(currentParentId);

    const parentCategory: { id: string; parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: currentParentId },
        select: { id: true, parentId: true },
      });

    if (!parentCategory) {
      throw new CategoryServiceError("The selected parent category does not exist.");
    }

    currentParentId = parentCategory.parentId;
  }
}

/**
 * Retrieves the complete category tree with nested children and counts.
 */
export async function getCategoriesTree(): Promise<CategoryTreeNode[]> {
  const allCategories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          children: true,
          products: true,
          attributes: true,
        },
      },
    },
  });

  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  // First pass: create tree node objects
  for (const cat of allCategories) {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      _count: cat._count,
      children: [],
    });
  }

  // Second pass: nest children into parents
  for (const cat of allCategories) {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else {
      rootCategories.push(node);
    }
  }

  return rootCategories;
}

/**
 * Retrieves a flat list of categories formatted for parent selection dropdowns.
 * Example label: "Kitchen Appliances > Cooking Appliances > Gas Stoves"
 */
export async function getFlatCategoryOptions(excludeCategoryId?: string): Promise<
  { id: string; name: string; path: string; depth: number; isDisabled: boolean }[]
> {
  const allCategories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      parentId: true,
      isActive: true,
    },
  });

  // Map for fast parent lookup
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  // Find all descendants of excludeCategoryId to disable them in dropdown (prevent circular)
  const disabledIds = new Set<string>();
  if (excludeCategoryId) {
    disabledIds.add(excludeCategoryId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cat of allCategories) {
        if (cat.parentId && disabledIds.has(cat.parentId) && !disabledIds.has(cat.id)) {
          disabledIds.add(cat.id);
          changed = true;
        }
      }
    }
  }

  // Calculate full path and depth for each category
  function getPath(catId: string): string[] {
    const path: string[] = [];
    let currentId: string | null = catId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const cat = categoryMap.get(currentId);
      if (cat) {
        path.unshift(cat.name);
        currentId = cat.parentId;
      } else {
        break;
      }
    }
    return path;
  }

  return allCategories.map((cat) => {
    const pathParts = getPath(cat.id);
    return {
      id: cat.id,
      name: cat.name,
      parentId: cat.parentId,
      path: pathParts.join(" > "),
      depth: pathParts.length - 1,
      isDisabled: disabledIds.has(cat.id),
    };
  });
}

/**
 * Retrieves a single category with full breadcrumb path and attributes with values.
 */
export async function getCategoryById(id: string): Promise<CategoryDetailView> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          children: true,
          products: true,
          attributes: true,
        },
      },
      attributes: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          predefinedValues: {
            orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
            select: {
              id: true,
              attributeId: true,
              value: true,
              label: true,
              sortOrder: true,
            },
          },
          _count: {
            select: {
              productAttributeValues: true,
              predefinedValues: true,
            },
          },
        },
      },
    },
  });

  if (!category) {
    throw new CategoryServiceError("The requested category was not found.", 404);
  }

  // Build breadcrumb trail from root to this category
  const breadcrumbs: CategoryBreadcrumb[] = [];
  let currentParentId = category.parentId;
  const visited = new Set<string>();

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = await prisma.category.findUnique({
      where: { id: currentParentId },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    if (parent) {
      breadcrumbs.unshift({ id: parent.id, name: parent.name, slug: parent.slug });
      currentParentId = parent.parentId;
    } else {
      break;
    }
  }

  // Add self to end of breadcrumbs
  breadcrumbs.push({ id: category.id, name: category.name, slug: category.slug });

  return {
    ...category,
    breadcrumbs,
  };
}

/**
 * Creates a new category with smart defaults and automatic slug generation.
 */
export async function createCategory(input: CreateCategoryInput) {
  // 1. If parentId specified, verify parent exists
  if (input.parentId) {
    const parentExists = await prisma.category.findUnique({
      where: { id: input.parentId },
      select: { id: true },
    });
    if (!parentExists) {
      throw new CategoryServiceError("The selected parent category does not exist.");
    }
  }

  // 2. Generate unique slug
  const slug = await generateUniqueCategorySlug(input.slug || input.name);

  // 3. Determine sortOrder if not provided or 0
  let sortOrder = input.sortOrder;
  if (!sortOrder) {
    const maxSort = await prisma.category.aggregate({
      where: { parentId: input.parentId || null },
      _max: { sortOrder: true },
    });
    sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  }

  // 4. Create category
  const created = await prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      parentId: input.parentId || null,
      sortOrder,
      isActive: input.isActive ?? true,
    },
  });

  return created;
}

/**
 * Updates an existing category with hierarchy safety and slug integrity.
 */
export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, parentId: true, name: true, slug: true },
  });

  if (!existing) {
    throw new CategoryServiceError("Category not found.", 404);
  }

  // Validate parent hierarchy if parentId is being updated
  if (input.parentId !== undefined) {
    const newParentId = input.parentId || null;
    if (newParentId) {
      await validateNoCircularParent(id, newParentId);
    }
  }

  // Handle slug if name or slug changes
  let slug = existing.slug;
  if (input.slug) {
    slug = await generateUniqueCategorySlug(input.slug, id);
  } else if (input.name && input.name !== existing.name) {
    // Keep existing slug unless explicitly provided, or regenerate if needed
    slug = await generateUniqueCategorySlug(input.name, id);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined || (input.name && input.name !== existing.name) ? { slug } : {}),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.parentId !== undefined && { parentId: input.parentId || null }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  return updated;
}

/**
 * Toggles active status of a category.
 */
export async function toggleCategoryStatus(id: string, isActive?: boolean) {
  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!existing) {
    throw new CategoryServiceError("Category not found.", 404);
  }

  const newStatus = isActive !== undefined ? isActive : !existing.isActive;

  return prisma.category.update({
    where: { id },
    data: { isActive: newStatus },
  });
}

/**
 * Safely deletes a category after ensuring no children or products are attached.
 */
export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          children: true,
          products: true,
        },
      },
    },
  });

  if (!category) {
    throw new CategoryServiceError("Category not found.", 404);
  }

  if (category._count.children > 0) {
    throw new CategoryServiceError(
      `This category cannot be deleted because it contains ${category._count.children} subcategory(ies). Please move or delete the subcategories first.`
    );
  }

  if (category._count.products > 0) {
    throw new CategoryServiceError(
      `This category cannot be deleted because ${category._count.products} product(s) are currently assigned to it. Please reassign or delete the products first.`
    );
  }

  // Safe to delete
  return prisma.category.delete({
    where: { id },
  });
}

/**
 * Batch reorders categories.
 */
export async function reorderCategories(items: { id: string; sortOrder: number }[]) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.category.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );
}

/**
 * Returns an array containing the target category ID and all its descendant subcategory IDs.
 */
export async function getCategoryWithDescendantIds(categoryId: string): Promise<string[]> {
  const allCategories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });

  const childMap = new Map<string, string[]>();
  for (const cat of allCategories) {
    if (cat.parentId) {
      if (!childMap.has(cat.parentId)) {
        childMap.set(cat.parentId, []);
      }
      childMap.get(cat.parentId)!.push(cat.id);
    }
  }

  const result: string[] = [categoryId];
  const queue: string[] = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childMap.get(currentId) || [];
    for (const childId of children) {
      result.push(childId);
      queue.push(childId);
    }
  }

  return result;
}

