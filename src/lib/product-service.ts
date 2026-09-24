import { prisma } from "./prisma";
import { slugify } from "./slugify";
import { AttributeType, Prisma } from "@prisma/client";
import type {
  ProductListItem,
  ProductAdminDetailView,
  PaginatedProductsResponse,
  BrandOption,
  CategoryBreadcrumb,
} from "../types";
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductFilterQuery,
} from "../validations/product";
import type { BrandInput } from "../validations/brand";

/**
 * Custom application error with friendly, non-technical message.
 */
export class ProductServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "ProductServiceError";
  }
}

/**
 * Calculates percentage discount from MRP and Selling Price.
 * Discount % = ((MRP - Selling Price) / MRP) * 100
 */
export function calculateDiscountPercent(
  mrp: number,
  sellingPrice?: number | null
): number | null {
  if (!sellingPrice || mrp <= 0 || sellingPrice >= mrp) {
    return null;
  }
  const discount = ((mrp - sellingPrice) / mrp) * 100;
  return Math.round(discount);
}

/**
 * Generates a unique slug for a product.
 */
async function generateUniqueProductSlug(
  baseName: string,
  modelNumber?: string | null,
  excludeId?: string
): Promise<string> {
  const nameSlug = slugify(baseName) || "product";
  const modelSlug = modelNumber ? slugify(modelNumber) : "";
  const initialCandidate = modelSlug ? `${nameSlug}-${modelSlug}` : nameSlug;

  let candidate = initialCandidate;
  let counter = 1;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    counter++;
    candidate = `${initialCandidate}-${counter}`;
  }
}

/**
 * Generates a unique slug for a brand.
 */
async function generateUniqueBrandSlug(baseName: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(baseName) || "brand";
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.brand.findUnique({
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

// ==============================================================================
// 1. BRAND MANAGEMENT (Inline & Dropdown Support)
// ==============================================================================

/**
 * Retrieves all active brands for product selection.
 */
export async function getBrands(): Promise<BrandOption[]> {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true,
    },
  });
}

/**
 * Creates a brand inline during product creation.
 */
export async function createBrand(input: BrandInput): Promise<BrandOption> {
  const existingName = await prisma.brand.findUnique({
    where: { name: input.name.trim() },
    select: { id: true },
  });

  if (existingName) {
    throw new ProductServiceError(
      `A brand with the name "${input.name}" already exists. Please select it from the list.`
    );
  }

  const slug = await generateUniqueBrandSlug(input.slug || input.name);

  return prisma.brand.create({
    data: {
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true,
    },
  });
}

// ==============================================================================
// 2. PRODUCT LISTING & FILTERING
// ==============================================================================

/**
 * Retrieves a paginated and filtered list of products.
 */
export async function getProducts(
  query: ProductFilterQuery
): Promise<PaginatedProductsResponse> {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    brandId,
    status = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  // Build where filter
  const where: Prisma.ProductWhereInput = {};

  // Status filtering
  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  } else if (status === "featured") {
    where.isFeatured = true;
  }

  // Brand filter
  if (brandId && brandId !== "all") {
    where.brandId = brandId;
  }

  // Category filter (includes category or its children)
  if (categoryId && categoryId !== "all") {
    where.categoryId = categoryId;
  }

  // Text search filter
  if (search && search.trim().length > 0) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { modelNumber: { contains: term, mode: "insensitive" } },
      { brand: { name: { contains: term, mode: "insensitive" } } },
      { category: { name: { contains: term, mode: "insensitive" } } },
      { privatePriceCode: { contains: term, mode: "insensitive" } },
    ];
  }

  // Ordering
  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [total, rawProducts] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        brand: {
          select: { id: true, name: true, slug: true },
        },
        category: {
          select: { id: true, name: true, slug: true, parentId: true },
        },
        _count: {
          select: {
            attributeValues: true,
            images: true,
            videos: true,
          },
        },
      },
    }),
  ]);

  const products: ProductListItem[] = rawProducts.map((p) => {
    const mrpNum = Number(p.mrp);
    const sellingPriceNum = p.sellingPrice != null ? Number(p.sellingPrice) : null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      modelNumber: p.modelNumber,
      description: p.description,
      brandId: p.brandId,
      categoryId: p.categoryId,
      mrp: mrpNum,
      sellingPrice: sellingPriceNum,
      discountPercent: calculateDiscountPercent(mrpNum, sellingPriceNum),
      privatePriceCode: p.privatePriceCode,
      warranty: p.warranty,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      brand: p.brand,
      category: p.category,
      _count: p._count,
    };
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    products,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// ==============================================================================
// 3. PRODUCT DETAIL
// ==============================================================================

/**
 * Retrieves full details for a product, including category breadcrumbs and attributes.
 */
export async function getProductById(id: string): Promise<ProductAdminDetailView> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isActive: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
        },
      },
      attributeValues: {
        include: {
          attribute: {
            select: {
              id: true,
              categoryId: true,
              name: true,
              slug: true,
              type: true,
              unit: true,
              isRequired: true,
              isFilterable: true,
            },
          },
          attributeValue: {
            select: {
              id: true,
              value: true,
              label: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new ProductServiceError("The requested product was not found.", 404);
  }

  // Build category breadcrumb hierarchy
  const breadcrumbs: CategoryBreadcrumb[] = [];
  let currentParentId = product.category.parentId;
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
  breadcrumbs.push({
    id: product.category.id,
    name: product.category.name,
    slug: product.category.slug,
  });

  const mrpNum = Number(product.mrp);
  const sellingPriceNum = product.sellingPrice != null ? Number(product.sellingPrice) : null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    modelNumber: product.modelNumber,
    description: product.description,
    brandId: product.brandId,
    categoryId: product.categoryId,
    mrp: mrpNum,
    sellingPrice: sellingPriceNum,
    discountPercent: calculateDiscountPercent(mrpNum, sellingPriceNum),
    privatePriceCode: product.privatePriceCode,
    warranty: product.warranty,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    brand: product.brand,
    category: {
      ...product.category,
      breadcrumbs,
    },
    attributeValues: product.attributeValues.map((av) => ({
      id: av.id,
      productId: av.productId,
      attributeId: av.attributeId,
      attributeValueId: av.attributeValueId,
      value: av.value,
      numericValue: av.numericValue,
      booleanValue: av.booleanValue,
      attribute: av.attribute,
      attributeValue: av.attributeValue,
    })),
  };
}

// ==============================================================================
// 4. DYNAMIC SPECIFICATION PROCESSING HELPER
// ==============================================================================

interface AttributeCreateRecord {
  attributeId: string;
  attributeValueId: string | null;
  value: string;
  numericValue: number | null;
  booleanValue: boolean | null;
}

/**
 * Validates dynamic specifications against the target category and prepares
 * relational ProductAttributeValue records.
 */
async function processDynamicSpecifications(
  categoryId: string,
  submittedAttributes: CreateProductInput["attributes"] = []
): Promise<AttributeCreateRecord[]> {
  // 1. Fetch all category attributes for this category
  const categoryAttributes = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    include: {
      predefinedValues: true,
    },
  });

  const attrMap = new Map(categoryAttributes.map((a) => [a.id, a]));
  const submittedAttrMap = new Map<string, unknown>();

  for (const item of submittedAttributes) {
    submittedAttrMap.set(item.attributeId, item.value);
  }

  // 2. Validate all required specifications are present
  for (const attr of categoryAttributes) {
    if (attr.isRequired) {
      const val = submittedAttrMap.get(attr.id);
      const isEmpty =
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0);

      if (isEmpty) {
        throw new ProductServiceError(
          `Please provide a value for the required specification "${attr.name}".`
        );
      }
    }
  }

  const resultRecords: AttributeCreateRecord[] = [];

  // 3. Process submitted attributes
  for (const item of submittedAttributes) {
    const attr = attrMap.get(item.attributeId);
    if (!attr) {
      // Attribute does not belong to this category (rejected!)
      throw new ProductServiceError(
        `One of the submitted specifications does not belong to the selected category.`
      );
    }

    const rawValue = item.value;
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    if (attr.type === AttributeType.SELECT) {
      const strVal = String(rawValue).trim();
      if (!strVal) continue;

      // Find matching predefined value
      const matchingOption = attr.predefinedValues.find(
        (o) => o.value.toLowerCase() === strVal.toLowerCase() || o.id === item.attributeValueId
      );

      const numeric = !isNaN(parseFloat(strVal)) ? parseFloat(strVal) : null;

      resultRecords.push({
        attributeId: attr.id,
        attributeValueId: matchingOption ? matchingOption.id : null,
        value: matchingOption ? matchingOption.value : strVal,
        numericValue: numeric,
        booleanValue: null,
      });
    } else if (attr.type === AttributeType.MULTI_SELECT) {
      const valuesArray = Array.isArray(rawValue)
        ? rawValue
        : [String(rawValue).trim()];

      for (const valItem of valuesArray) {
        const strVal = String(valItem).trim();
        if (!strVal) continue;

        const matchingOption = attr.predefinedValues.find(
          (o) => o.value.toLowerCase() === strVal.toLowerCase()
        );

        resultRecords.push({
          attributeId: attr.id,
          attributeValueId: matchingOption ? matchingOption.id : null,
          value: matchingOption ? matchingOption.value : strVal,
          numericValue: null,
          booleanValue: null,
        });
      }
    } else if (attr.type === AttributeType.BOOLEAN) {
      const bool =
        typeof rawValue === "boolean"
          ? rawValue
          : rawValue === "true" || rawValue === "Yes" || rawValue === 1;

      resultRecords.push({
        attributeId: attr.id,
        attributeValueId: null,
        value: bool ? "Yes" : "No",
        numericValue: null,
        booleanValue: bool,
      });
    } else if (attr.type === AttributeType.NUMBER || attr.type === AttributeType.RANGE) {
      const num =
        typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));
      if (isNaN(num)) {
        throw new ProductServiceError(
          `Please enter a valid numeric value for "${attr.name}".`
        );
      }

      resultRecords.push({
        attributeId: attr.id,
        attributeValueId: null,
        value: String(num),
        numericValue: num,
        booleanValue: null,
      });
    } else {
      // TEXT
      const strVal = String(rawValue).trim();
      if (!strVal) continue;

      resultRecords.push({
        attributeId: attr.id,
        attributeValueId: null,
        value: strVal,
        numericValue: null,
        booleanValue: null,
      });
    }
  }

  return resultRecords;
}

// ==============================================================================
// 5. PRODUCT CREATION
// ==============================================================================

/**
 * Creates a product and its dynamic attribute values in a single transaction.
 */
export async function createProduct(input: CreateProductInput) {
  // 1. Verify Category exists
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true, isActive: true },
  });

  if (!category) {
    throw new ProductServiceError("The selected category was not found.", 404);
  }

  // 2. Verify Brand exists
  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: { id: true, name: true },
  });

  if (!brand) {
    throw new ProductServiceError("The selected brand was not found.", 404);
  }

  // 3. Validate Price constraints
  const mrpNum = Number(input.mrp);
  const sellingPriceNum = input.sellingPrice != null ? Number(input.sellingPrice) : null;

  if (mrpNum <= 0) {
    throw new ProductServiceError("MRP must be greater than zero.");
  }

  if (sellingPriceNum != null && sellingPriceNum > mrpNum) {
    throw new ProductServiceError("Selling price cannot be greater than MRP.");
  }

  // 4. Validate SKU uniqueness
  const existingSku = await prisma.product.findUnique({
    where: { sku: input.sku.trim().toUpperCase() },
    select: { id: true },
  });

  if (existingSku) {
    throw new ProductServiceError(
      `This SKU "${input.sku}" is already being used by another product. Please enter a unique SKU.`
    );
  }

  // 5. Generate unique slug
  const slug = await generateUniqueProductSlug(input.name, input.modelNumber);

  // 6. Validate & process dynamic specifications for this category
  const rawAttrs = input.attributeValues ?? input.attributes ?? [];
  const attributeRecords = await processDynamicSpecifications(
    input.categoryId,
    rawAttrs
  );

  // 7. Atomic transaction creation
  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name.trim(),
        slug,
        sku: input.sku.trim().toUpperCase(),
        modelNumber: input.modelNumber?.trim() || null,
        description: input.description?.trim() || null,
        brandId: input.brandId,
        categoryId: input.categoryId,
        mrp: mrpNum,
        sellingPrice: sellingPriceNum,
        privatePriceCode: input.privatePriceCode?.trim() || null,
        warranty: input.warranty?.trim() || null,
        isFeatured: input.isFeatured ?? false,
        isActive: input.isActive ?? true,
      },
    });

    if (attributeRecords.length > 0) {
      await tx.productAttributeValue.createMany({
        data: attributeRecords.map((r) => ({
          productId: product.id,
          attributeId: r.attributeId,
          attributeValueId: r.attributeValueId,
          value: r.value,
          numericValue: r.numericValue,
          booleanValue: r.booleanValue,
        })),
      });
    }

    return product;
  });

  return getProductById(created.id);
}

// ==============================================================================
// 6. PRODUCT UPDATE & CATEGORY CHANGE SAFETY
// ==============================================================================

/**
 * Updates a product with category change safety and specification sync.
 */
export async function updateProduct(id: string, input: UpdateProductInput) {
  // 1. Verify product exists
  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      categoryId: true,
      brandId: true,
      mrp: true,
      sellingPrice: true,
    },
  });

  if (!existing) {
    throw new ProductServiceError("Product not found.", 404);
  }

  const targetCategoryId = input.categoryId || existing.categoryId;
  const isCategoryChanging = input.categoryId && input.categoryId !== existing.categoryId;

  // 2. Validate Brand if changed
  if (input.brandId && input.brandId !== existing.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: input.brandId },
      select: { id: true },
    });
    if (!brand) {
      throw new ProductServiceError("The selected brand was not found.");
    }
  }

  // 3. Validate Category if changed
  if (isCategoryChanging) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new ProductServiceError("The selected category was not found.");
    }
  }

  // 4. Validate SKU uniqueness if changed
  if (input.sku && input.sku.trim().toUpperCase() !== existing.sku) {
    const skuDuplicate = await prisma.product.findUnique({
      where: { sku: input.sku.trim().toUpperCase() },
      select: { id: true },
    });
    if (skuDuplicate && skuDuplicate.id !== id) {
      throw new ProductServiceError(
        `This SKU "${input.sku}" is already being used by another product. Please enter a unique SKU.`
      );
    }
  }

  // 5. Validate Price constraints
  const mrpNum = input.mrp !== undefined ? Number(input.mrp) : Number(existing.mrp);
  const sellingPriceNum =
    input.sellingPrice !== undefined
      ? input.sellingPrice != null
        ? Number(input.sellingPrice)
        : null
      : existing.sellingPrice != null
      ? Number(existing.sellingPrice)
      : null;

  if (mrpNum <= 0) {
    throw new ProductServiceError("MRP must be greater than zero.");
  }

  if (sellingPriceNum != null && sellingPriceNum > mrpNum) {
    throw new ProductServiceError("Selling price cannot be greater than MRP.");
  }

  // 6. Handle slug update if name changes or slug provided
  let slug = existing.slug;
  if (input.slug) {
    slug = await generateUniqueProductSlug(input.slug, input.modelNumber, id);
  } else if (input.name && input.name !== existing.name) {
    slug = await generateUniqueProductSlug(input.name, input.modelNumber, id);
  }

  // 7. Validate & process specifications
  let attributeRecords: AttributeCreateRecord[] | null = null;
  const rawAttrs = input.attributeValues !== undefined ? input.attributeValues : input.attributes;
  if (rawAttrs !== undefined || isCategoryChanging) {
    attributeRecords = await processDynamicSpecifications(
      targetCategoryId,
      rawAttrs || []
    );
  }

  // 8. Execute update in transaction
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(slug !== existing.slug && { slug }),
        ...(input.sku !== undefined && { sku: input.sku.trim().toUpperCase() }),
        ...(input.modelNumber !== undefined && {
          modelNumber: input.modelNumber?.trim() || null,
        }),
        ...(input.description !== undefined && {
          description: input.description?.trim() || null,
        }),
        ...(input.brandId !== undefined && { brandId: input.brandId }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.mrp !== undefined && { mrp: mrpNum }),
        ...(input.sellingPrice !== undefined && { sellingPrice: sellingPriceNum }),
        ...(input.privatePriceCode !== undefined && {
          privatePriceCode: input.privatePriceCode?.trim() || null,
        }),
        ...(input.warranty !== undefined && {
          warranty: input.warranty?.trim() || null,
        }),
        ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    if (attributeRecords !== null) {
      // Remove obsolete / existing attribute values
      await tx.productAttributeValue.deleteMany({
        where: { productId: id },
      });

      // Insert new attribute values
      if (attributeRecords.length > 0) {
        await tx.productAttributeValue.createMany({
          data: attributeRecords.map((r) => ({
            productId: id,
            attributeId: r.attributeId,
            attributeValueId: r.attributeValueId,
            value: r.value,
            numericValue: r.numericValue,
            booleanValue: r.booleanValue,
          })),
        });
      }
    }
  });

  return getProductById(id);
}

// ==============================================================================
// 7. STATUS TOGGLES & SAFE DELETION
// ==============================================================================

/**
 * Toggles product active state.
 */
export async function toggleProductActive(id: string, isActive?: boolean) {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!existing) {
    throw new ProductServiceError("Product not found.", 404);
  }

  const nextStatus = isActive !== undefined ? isActive : !existing.isActive;

  return prisma.product.update({
    where: { id },
    data: { isActive: nextStatus },
    select: { id: true, name: true, isActive: true },
  });
}

/**
 * Toggles product featured status.
 */
export async function toggleProductFeatured(id: string, isFeatured?: boolean) {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, isFeatured: true },
  });

  if (!existing) {
    throw new ProductServiceError("Product not found.", 404);
  }

  const nextStatus = isFeatured !== undefined ? isFeatured : !existing.isFeatured;

  return prisma.product.update({
    where: { id },
    data: { isFeatured: nextStatus },
    select: { id: true, name: true, isFeatured: true },
  });
}

/**
 * Safely deletes a product and its associated media/attributes.
 */
export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          inventoryMovements: true,
        },
      },
    },
  });

  if (!product) {
    throw new ProductServiceError("Product not found.", 404);
  }

  // Deleting cascades to images, videos, inventory, productAttributeValues.
  // If historical inventory audit movements exist, clean them or delete product.
  return prisma.product.delete({
    where: { id },
  });
}
