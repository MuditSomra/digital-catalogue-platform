import { prisma } from "./prisma";
import { getCategoryWithDescendantIds } from "./category-service";
import { generateUniqueProductSlug } from "./product-service";
import type { ProductQuotationGroup, SupplierQuotationItem } from "@/types";
import { Prisma } from "@prisma/client";

export class PurchasingError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "PurchasingError";
  }
}

export interface GetQuotationsOptions {
  categoryId?: string | null;
  search?: string | null;
  sortBy?:
    | "lowest_price"
    | "highest_margin"
    | "newest"
    | "supplier"
    | "product_name"
    | "price_asc"
    | "price_desc"
    | "margin_desc"
    | "date_desc"
    | "supplier_asc"
    | "name_asc"
    | string
    | null;
  attributeFilters?: Record<string, string[]> | null;
}

/**
 * Retrieves products and their supplier quotations grouped by product.
 * Supports multi-category filtering, subcategories, and search.
 */
export async function getProductQuotations(
  options: GetQuotationsOptions = {}
): Promise<{
  groups: ProductQuotationGroup[];
  totalProducts: number;
  totalQuotations: number;
  activeSuppliersCount: number;
}> {
  const { categoryId, search, sortBy = "price_asc", attributeFilters } = options;

  const productWhere: Prisma.ProductWhereInput = {
    isActive: true,
  };

  // 1. Category / Subcategory Filter (Multi-category aware)
  if (categoryId && categoryId !== "all" && categoryId.trim() !== "") {
    const descendantIds = await getCategoryWithDescendantIds(categoryId);
    productWhere.OR = [
      { categoryId: { in: descendantIds } },
      { categories: { some: { categoryId: { in: descendantIds } } } },
    ];
  }

  // 2. Search query (Product Name, SKU, Model Number, or Supplier Name)
  if (search && search.trim() !== "") {
    const term = search.trim();
    const searchConditions: Prisma.ProductWhereInput[] = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { modelNumber: { contains: term, mode: "insensitive" } },
      { brand: { name: { contains: term, mode: "insensitive" } } },
      { quotations: { some: { supplierName: { contains: term, mode: "insensitive" } } } },
    ];

    if (productWhere.OR) {
      productWhere.AND = [{ OR: searchConditions }];
    } else {
      productWhere.OR = searchConditions;
    }
  }

  // 3. Dynamic Attribute Filtering
  if (attributeFilters && Object.keys(attributeFilters).length > 0) {
    const attrConditions: Prisma.ProductWhereInput[] = [];
    for (const [attrSlug, selectedValues] of Object.entries(attributeFilters)) {
      if (selectedValues && selectedValues.length > 0) {
        attrConditions.push({
          attributeValues: {
            some: {
              attribute: { slug: attrSlug },
              value: { in: selectedValues },
            },
          },
        });
      }
    }
    if (attrConditions.length > 0) {
      productWhere.AND = [...(Array.isArray(productWhere.AND) ? productWhere.AND : []), ...attrConditions];
    }
  }

  // 4. Query products with relations
  const products = await prisma.product.findMany({
    where: productWhere,
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true } },
      categories: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: { id: true, url: true, altText: true, isPrimary: true },
      },
      attributeValues: {
        include: {
          attribute: {
            select: { id: true, name: true, slug: true, type: true, unit: true, sortOrder: true },
          },
        },
        orderBy: {
          attribute: { sortOrder: "asc" },
        },
      },
      inventory: { select: { quantity: true } },
      quotations: {
        orderBy: { quotedPrice: "asc" },
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // 5. Transform into ProductQuotationGroup
  const uniqueSuppliers = new Set<string>();
  let totalQuotationsCount = 0;

  const groups: ProductQuotationGroup[] = products.map((p) => {
    const rawQuotes = p.quotations || [];
    totalQuotationsCount += rawQuotes.length;

    rawQuotes.forEach((q) => {
      if (q.supplierName) {
        uniqueSuppliers.add(q.supplierName.trim().toLowerCase());
      }
    });

    const prices = rawQuotes.map((q) => Number(q.quotedPrice));
    const lowestQuotedPrice = prices.length > 0 ? Math.min(...prices) : null;
    const highestQuotedPrice = prices.length > 0 ? Math.max(...prices) : null;
    const averageQuotedPrice =
      prices.length > 0 ? Number((prices.reduce((sum, val) => sum + val, 0) / prices.length).toFixed(2)) : null;

    const formattedQuotes: SupplierQuotationItem[] = rawQuotes.map((q) => {
      const qPrice = Number(q.quotedPrice);
      return {
        id: q.id,
        productId: q.productId,
        supplierName: q.supplierName,
        quotedPrice: qPrice,
        quotationDate: q.quotationDate.toISOString(),
        validUntil: q.validUntil ? q.validUntil.toISOString() : null,
        moq: q.moq,
        leadTimeDays: q.leadTimeDays,
        notes: q.notes,
        createdById: q.createdById,
        createdByUser: q.createdBy ? { name: q.createdBy.name, email: q.createdBy.email } : null,
        isLowestPrice: lowestQuotedPrice !== null && qPrice === lowestQuotedPrice,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      };
    });

    const lowestQuote = formattedQuotes.find((q) => q.isLowestPrice);
    const lowestQuotationSupplier = lowestQuote ? lowestQuote.supplierName : null;

    const sellingPriceNum = p.sellingPrice ? Number(p.sellingPrice) : null;
    const mrpNum = Number(p.mrp);
    const baseRetailPrice = sellingPriceNum || mrpNum;

    let potentialMargin: number | null = null;
    let potentialMarginPercent: number | null = null;

    if (baseRetailPrice && lowestQuotedPrice !== null) {
      potentialMargin = Number((baseRetailPrice - lowestQuotedPrice).toFixed(2));
      potentialMarginPercent = Number((((baseRetailPrice - lowestQuotedPrice) / baseRetailPrice) * 100).toFixed(1));
    }

    // Deduplicated categories list (Primary + Secondary)
    const categoryMap = new Map<string, { id: string; name: string; slug: string; isPrimary: boolean }>();
    categoryMap.set(p.category.id, {
      id: p.category.id,
      name: p.category.name,
      slug: p.category.slug,
      isPrimary: true,
    });

    if (p.categories) {
      p.categories.forEach((pc) => {
        if (!categoryMap.has(pc.category.id)) {
          categoryMap.set(pc.category.id, {
            id: pc.category.id,
            name: pc.category.name,
            slug: pc.category.slug,
            isPrimary: pc.isPrimary,
          });
        }
      });
    }

    const primaryImg =
      p.images && p.images.length > 0
        ? p.images.find((img) => img.isPrimary) || p.images[0]
        : null;

    const formattedSpecs = (p.attributeValues || [])
      .filter((av) => av.value || av.numericValue !== null || av.booleanValue !== null)
      .map((av) => ({
        id: av.id,
        attributeId: av.attributeId,
        attributeSlug: av.attribute.slug,
        attributeName: av.attribute.name,
        attributeType: av.attribute.type,
        unit: av.attribute.unit,
        value: av.value,
        numericValue: av.numericValue ? Number(av.numericValue) : null,
        booleanValue: av.booleanValue,
      }));

    return {
      product: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        modelNumber: p.modelNumber,
        mrp: mrpNum,
        sellingPrice: sellingPriceNum,
        privatePriceCode: p.privatePriceCode,
        brand: p.brand,
        category: p.category,
        categories: Array.from(categoryMap.values()),
        primaryImage: primaryImg ? { url: primaryImg.url, altText: primaryImg.altText } : null,
        images: p.images || [],
        attributeValues: formattedSpecs,
        currentStock: p.inventory?.quantity || 0,
      },
      quotations: formattedQuotes,
      lowestQuotedPrice,
      lowestQuotationSupplier,
      highestQuotedPrice,
      averageQuotedPrice,
      potentialMargin,
      potentialMarginPercent,
    };
  });

  // 6. Apply comprehensive sorting to product groups
  if (sortBy === "lowest_price" || sortBy === "price_asc") {
    groups.sort((a, b) => {
      if (a.lowestQuotedPrice === null && b.lowestQuotedPrice === null) {
        return a.product.name.localeCompare(b.product.name);
      }
      if (a.lowestQuotedPrice === null) return 1;
      if (b.lowestQuotedPrice === null) return -1;
      if (a.lowestQuotedPrice !== b.lowestQuotedPrice) {
        return a.lowestQuotedPrice - b.lowestQuotedPrice;
      }
      return a.product.name.localeCompare(b.product.name);
    });
  } else if (sortBy === "highest_margin" || sortBy === "margin_desc") {
    groups.sort((a, b) => {
      const mA = a.potentialMarginPercent;
      const mB = b.potentialMarginPercent;
      if (mA === null && mB === null) {
        return a.product.name.localeCompare(b.product.name);
      }
      if (mA === null) return 1;
      if (mB === null) return -1;
      if (mB !== mA) {
        return mB - mA; // Highest margin % first
      }
      return a.product.name.localeCompare(b.product.name);
    });
  } else if (sortBy === "newest" || sortBy === "date_desc") {
    groups.sort((a, b) => {
      const getLatestDate = (g: ProductQuotationGroup) => {
        if (!g.quotations || g.quotations.length === 0) return 0;
        return Math.max(
          ...g.quotations.map((q) => {
            const d = q.quotationDate ? new Date(q.quotationDate).getTime() : 0;
            return isNaN(d) ? 0 : d;
          })
        );
      };
      const dA = getLatestDate(a);
      const dB = getLatestDate(b);
      if (dA === 0 && dB === 0) {
        return a.product.name.localeCompare(b.product.name);
      }
      if (dA === 0) return 1;
      if (dB === 0) return -1;
      if (dB !== dA) {
        return dB - dA; // Newest quotation date first
      }
      return a.product.name.localeCompare(b.product.name);
    });
  } else if (sortBy === "supplier" || sortBy === "supplier_asc") {
    groups.sort((a, b) => {
      const sA = a.lowestQuotationSupplier?.trim();
      const sB = b.lowestQuotationSupplier?.trim();
      if (!sA && !sB) {
        return a.product.name.localeCompare(b.product.name);
      }
      if (!sA) return 1;
      if (!sB) return -1;
      const comp = sA.localeCompare(sB, undefined, { sensitivity: "base" });
      if (comp !== 0) return comp;
      return a.product.name.localeCompare(b.product.name);
    });
  } else if (sortBy === "product_name" || sortBy === "name_asc") {
    groups.sort((a, b) => a.product.name.localeCompare(b.product.name, undefined, { sensitivity: "base" }));
  } else {
    // Default fallback: Lowest quoted price
    groups.sort((a, b) => {
      if (a.lowestQuotedPrice === null && b.lowestQuotedPrice === null) {
        return a.product.name.localeCompare(b.product.name);
      }
      if (a.lowestQuotedPrice === null) return 1;
      if (b.lowestQuotedPrice === null) return -1;
      return a.lowestQuotedPrice - b.lowestQuotedPrice;
    });
  }

  return {
    groups,
    totalProducts: groups.length,
    totalQuotations: totalQuotationsCount,
    activeSuppliersCount: uniqueSuppliers.size,
  };
}

/**
 * Creates a new supplier quotation for a product.
 * Does NOT increase stock or create inventory transactions.
 */
export async function createSupplierQuotation(input: {
  productId: string;
  supplierName: string;
  quotedPrice: number;
  quotationDate?: string | Date;
  validUntil?: string | Date | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  createdById?: string | null;
}): Promise<SupplierQuotationItem> {
  const { productId, supplierName, quotedPrice, quotationDate, validUntil, moq, leadTimeDays, notes, createdById } = input;

  if (!productId || productId.trim() === "") {
    throw new PurchasingError("Product ID is required.");
  }
  if (!supplierName || supplierName.trim() === "") {
    throw new PurchasingError("Supplier name is required.");
  }
  if (quotedPrice === undefined || quotedPrice === null || quotedPrice <= 0) {
    throw new PurchasingError("Quoted price must be greater than 0.");
  }

  // Ensure product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, sku: true },
  });
  if (!product) {
    throw new PurchasingError("Product not found.", 404);
  }

  const quotation = await prisma.supplierQuotation.create({
    data: {
      productId,
      supplierName: supplierName.trim(),
      quotedPrice: new Prisma.Decimal(quotedPrice),
      quotationDate: quotationDate ? new Date(quotationDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      moq: moq && moq > 0 ? moq : 1,
      leadTimeDays: leadTimeDays && leadTimeDays > 0 ? leadTimeDays : null,
      notes: notes?.trim() || null,
      createdById: createdById || null,
    },
  });

  return {
    id: quotation.id,
    productId: quotation.productId,
    supplierName: quotation.supplierName,
    quotedPrice: Number(quotation.quotedPrice),
    quotationDate: quotation.quotationDate.toISOString(),
    validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
    moq: quotation.moq,
    leadTimeDays: quotation.leadTimeDays,
    notes: quotation.notes,
    createdById: quotation.createdById,
    createdAt: quotation.createdAt.toISOString(),
    updatedAt: quotation.updatedAt.toISOString(),
  };
}

/**
 * Updates an existing supplier quotation.
 * Does NOT modify inventory.
 */
export async function updateSupplierQuotation(
  id: string,
  input: {
    supplierName?: string;
    quotedPrice?: number;
    quotationDate?: string | Date;
    validUntil?: string | Date | null;
    moq?: number | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }
): Promise<SupplierQuotationItem> {
  const existing = await prisma.supplierQuotation.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new PurchasingError("Supplier quotation not found.", 404);
  }

  if (input.quotedPrice !== undefined && input.quotedPrice <= 0) {
    throw new PurchasingError("Quoted price must be greater than 0.");
  }
  if (input.supplierName !== undefined && input.supplierName.trim() === "") {
    throw new PurchasingError("Supplier name cannot be empty.");
  }

  const updated = await prisma.supplierQuotation.update({
    where: { id },
    data: {
      ...(input.supplierName !== undefined && { supplierName: input.supplierName.trim() }),
      ...(input.quotedPrice !== undefined && { quotedPrice: new Prisma.Decimal(input.quotedPrice) }),
      ...(input.quotationDate !== undefined && { quotationDate: new Date(input.quotationDate) }),
      ...(input.validUntil !== undefined && { validUntil: input.validUntil ? new Date(input.validUntil) : null }),
      ...(input.moq !== undefined && { moq: input.moq && input.moq > 0 ? input.moq : 1 }),
      ...(input.leadTimeDays !== undefined && { leadTimeDays: input.leadTimeDays && input.leadTimeDays > 0 ? input.leadTimeDays : null }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
    },
  });

  return {
    id: updated.id,
    productId: updated.productId,
    supplierName: updated.supplierName,
    quotedPrice: Number(updated.quotedPrice),
    quotationDate: updated.quotationDate.toISOString(),
    validUntil: updated.validUntil ? updated.validUntil.toISOString() : null,
    moq: updated.moq,
    leadTimeDays: updated.leadTimeDays,
    notes: updated.notes,
    createdById: updated.createdById,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Deletes a supplier quotation.
 * Does NOT modify inventory.
 */
export async function deleteSupplierQuotation(id: string): Promise<boolean> {
  const existing = await prisma.supplierQuotation.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new PurchasingError("Supplier quotation not found.", 404);
  }

  await prisma.supplierQuotation.delete({
    where: { id },
  });

  return true;
}

/**
 * Creates a new product directly from the Purchasing section and attaches its first quotation.
 */
export async function createProductWithInitialQuotation(input: {
  name: string;
  sku: string;
  modelNumber?: string | null;
  description?: string | null;
  brandId: string;
  categoryId: string; // primary category
  categoryIds?: string[]; // optional additional categories
  mrp: number;
  sellingPrice?: number | null;
  privatePriceCode?: string | null;
  warranty?: string | null;
  initialQuotation: {
    supplierName: string;
    quotedPrice: number;
    quotationDate?: string | Date;
    validUntil?: string | Date | null;
    moq?: number | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  };
  createdById?: string;
}) {
  const {
    name,
    sku,
    modelNumber,
    description,
    brandId,
    categoryId,
    categoryIds = [],
    mrp,
    sellingPrice,
    privatePriceCode,
    warranty,
    initialQuotation,
    createdById,
  } = input;

  if (!name?.trim()) throw new PurchasingError("Product name is required.");
  if (!sku?.trim()) throw new PurchasingError("SKU is required.");
  if (!brandId) throw new PurchasingError("Brand is required.");
  if (!categoryId) throw new PurchasingError("Primary category is required.");
  if (!mrp || mrp <= 0) throw new PurchasingError("Valid MRP is required.");

  if (!initialQuotation || !initialQuotation.supplierName?.trim() || !initialQuotation.quotedPrice || initialQuotation.quotedPrice <= 0) {
    throw new PurchasingError("A valid initial supplier quotation (supplier name and quoted price) is required.");
  }

  // Check SKU uniqueness
  const existingSku = await prisma.product.findUnique({ where: { sku: sku.trim() } });
  if (existingSku) {
    throw new PurchasingError(`SKU '${sku}' already exists.`);
  }

  const slug = await generateUniqueProductSlug(name.trim(), modelNumber);

  // Aggregate all unique categories
  const allCategoryIds = Array.from(new Set([categoryId, ...categoryIds.filter(Boolean)]));

  // Create Product in transaction
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: name.trim(),
        slug,
        sku: sku.trim().toUpperCase(),
        modelNumber: modelNumber?.trim() || null,
        description: description?.trim() || null,
        brandId,
        categoryId,
        mrp: new Prisma.Decimal(mrp),
        sellingPrice: sellingPrice ? new Prisma.Decimal(sellingPrice) : null,
        privatePriceCode: privatePriceCode?.trim() || null,
        warranty: warranty?.trim() || null,
        isActive: true,
        isFeatured: false,
        inventory: {
          create: {
            quantity: 0,
            lowStockThreshold: 5,
          },
        },
      },
    });

    // Create multi-category mappings
    for (const catId of allCategoryIds) {
      await tx.productCategory.create({
        data: {
          productId: product.id,
          categoryId: catId,
          isPrimary: catId === categoryId,
        },
      });
    }

    // Create initial quotation
    const quotation = await tx.supplierQuotation.create({
      data: {
        productId: product.id,
        supplierName: initialQuotation.supplierName.trim(),
        quotedPrice: initialQuotation.quotedPrice,
        quotationDate: initialQuotation.quotationDate ? new Date(initialQuotation.quotationDate) : new Date(),
        validUntil: initialQuotation.validUntil ? new Date(initialQuotation.validUntil) : null,
        moq: initialQuotation.moq && initialQuotation.moq > 0 ? initialQuotation.moq : 1,
        leadTimeDays: initialQuotation.leadTimeDays && initialQuotation.leadTimeDays > 0 ? initialQuotation.leadTimeDays : null,
        notes: initialQuotation.notes?.trim() || "Initial quotation created with product",
        createdById: createdById || null,
      },
    });

    return {
      product,
      quotation: {
        ...quotation,
        quotedPrice: Number(quotation.quotedPrice),
        quotationDate: quotation.quotationDate.toISOString(),
        validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
        createdAt: quotation.createdAt.toISOString(),
        updatedAt: quotation.updatedAt.toISOString(),
      },
    };
  });

  return result;
}
