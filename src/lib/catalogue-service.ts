import { prisma } from "./prisma";
import { AttributeType, Prisma } from "@prisma/client";
import { calculateStockStatus } from "./inventory-service";
import { calculateDiscountPercent } from "./product-service";
import { getCategoryWithDescendantIds } from "./category-service";
import { timeOperation, getActiveTiming } from "./perf-timing";
import type {
  CatalogueProductItem,
  DynamicAttributeFilterDef,
  PaginatedCatalogueResponse,
  CategoryBreadcrumb,
  ProductImageItem,
  ProductVideoItem,
} from "../types";

export interface AttributeFilterParam {
  attributeId?: string;
  slug?: string;
  values?: string[];
  minNumeric?: number;
  maxNumeric?: number;
  booleanValue?: boolean;
}

export interface CatalogueQueryParams {
  search?: string;
  categoryId?: string;
  brandIds?: string[];
  minPrice?: number; // legacy alias for minSellingPrice
  maxPrice?: number; // legacy alias for maxSellingPrice
  minSellingPrice?: number;
  maxSellingPrice?: number;
  minPriceCode?: number;
  maxPriceCode?: number;
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  attributeFilters?: AttributeFilterParam[];
  sortBy?: "price_asc" | "price_desc" | "name_asc" | "name_desc" | "newest" | "featured";
  page?: number;
  limit?: number;
}

const PRICE_CODE_SQL_EXPR = Prisma.sql`
  CASE
    WHEN trim("privatePriceCode") ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN (trim("privatePriceCode"))::numeric
    WHEN trim("privatePriceCode") ~ '^[0-9]+(\\.[0-9]+)?\\s*\\+\\s*[0-9]+(\\.[0-9]+)?$'
      THEN split_part(trim("privatePriceCode"), '+', 1)::numeric + split_part(trim("privatePriceCode"), '+', 2)::numeric
    WHEN trim("privatePriceCode") ~ '^[0-9]+(\\.[0-9]+)?\\s*\\+\\s*[0-9]+(\\.[0-9]+)?\\s*\\+\\s*[0-9]+(\\.[0-9]+)?$'
      THEN split_part(trim("privatePriceCode"), '+', 1)::numeric + split_part(trim("privatePriceCode"), '+', 2)::numeric + split_part(trim("privatePriceCode"), '+', 3)::numeric
    ELSE NULL
  END
`;

/**
 * Safely parses a private price code string into its calculated numeric value.
 * - Plain numeric codes (e.g. "693", "407") evaluate to their numeric value: 693, 407.
 * - Composite addition codes (e.g. "1400+70", "821+70") evaluate to their sum: 1470, 891.
 * - Invalid or non-numeric codes (e.g. "Na", null, undefined) return null.
 */
export function parsePriceCodeNumeric(code: string | null | undefined): number | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!trimmed || trimmed.toLowerCase() === "na" || trimmed.toLowerCase() === "n/a") {
    return null;
  }

  // Plain numeric
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? null : val;
  }

  // Composite addition: e.g. "1400+70", "821+70", "100+20+5"
  if (/^\d+(\.\d+)?(\s*\+\s*\d+(\.\d+)?)+$/.test(trimmed)) {
    const parts = trimmed.split("+").map((p) => parseFloat(p.trim()));
    if (parts.length >= 2 && parts.every((p) => !isNaN(p))) {
      return parts.reduce((acc, curr) => acc + curr, 0);
    }
  }

  return null;
}

export interface CataloguePriceRanges {
  priceCodeRange: { min: number; max: number };
  sellingPriceRange: { min: number; max: number };
  priceRange: { min: number; max: number }; // For backwards compatibility
}

// In-memory cache for global price bounds to avoid expensive table-wide aggregates on every request
let cachedPriceRanges: (CataloguePriceRanges & { timestamp: number }) | null = null;
const PRICE_RANGE_CACHE_TTL = 60 * 1000; // 60 seconds

export function invalidateCachedPriceRanges(): void {
  cachedPriceRanges = null;
}

export async function getCachedPriceRanges(): Promise<CataloguePriceRanges> {
  const now = Date.now();
  if (cachedPriceRanges && now - cachedPriceRanges.timestamp < PRICE_RANGE_CACHE_TTL) {
    getActiveTiming()?.record("cache_price_range", 0, "Price Range (Memory Cache Hit)");
    return {
      priceCodeRange: cachedPriceRanges.priceCodeRange,
      sellingPriceRange: cachedPriceRanges.sellingPriceRange,
      priceRange: cachedPriceRanges.priceRange,
    };
  }

  return await timeOperation(
    "db_price_aggregate",
    async () => {
      // 1. Calculate selling price bounds directly via Prisma aggregate (database index scan)
      // NEVER fallback to MRP.
      const [sellingPriceAggregate, priceCodeAggregate] = await Promise.all([
        prisma.product.aggregate({
          where: { isActive: true, sellingPrice: { not: null, gt: 0 } },
          _min: { sellingPrice: true },
          _max: { sellingPrice: true },
        }),
        // 2. Calculate price code bounds 100% database-side (guarded numeric extraction including composite sums, no full-table load into Node)
        prisma.$queryRaw<Array<{ min_code: number | null; max_code: number | null }>>`
          SELECT
            MIN(${PRICE_CODE_SQL_EXPR}) as min_code,
            MAX(${PRICE_CODE_SQL_EXPR}) as max_code
          FROM products
          WHERE "isActive" = true
        `,
      ]);

      const minSellingPrice =
        sellingPriceAggregate._min.sellingPrice != null
          ? Math.floor(Number(sellingPriceAggregate._min.sellingPrice))
          : 0;
      const maxSellingPrice =
        sellingPriceAggregate._max.sellingPrice != null
          ? Math.ceil(Number(sellingPriceAggregate._max.sellingPrice))
          : 0;

      const codeRow = priceCodeAggregate[0];
      const minPriceCode =
        codeRow?.min_code != null ? Math.floor(Number(codeRow.min_code)) : 0;
      const maxPriceCode =
        codeRow?.max_code != null ? Math.ceil(Number(codeRow.max_code)) : 0;

      const result: CataloguePriceRanges = {
        sellingPriceRange: { min: minSellingPrice, max: maxSellingPrice },
        priceCodeRange: { min: minPriceCode, max: maxPriceCode },
        priceRange: { min: minSellingPrice, max: maxSellingPrice },
      };

      cachedPriceRanges = { ...result, timestamp: now };
      return result;
    },
    "Price Range Bounds Calculation (Database-Side)"
  );
}

// Retain legacy getCachedPriceRange for backwards compatibility
export async function getCachedPriceRange(): Promise<{ min: number; max: number }> {
  const ranges = await getCachedPriceRanges();
  return ranges.priceRange;
}

/**
 * Retrieves dynamic attribute filter definitions for a given category (and its ancestors).
 * Uses in-memory hierarchy traversal to minimize database queries.
 */
export async function getCategoryDynamicFilters(
  categoryId?: string | null
): Promise<DynamicAttributeFilterDef[]> {
  if (!categoryId || categoryId === "all") {
    // When "All Categories" is selected, do not return specification filters
    return [];
  }

  // Fetch all categories once for fast parent/descendant resolution
  const allCategories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });

  const parentMap = new Map<string, string | null>(allCategories.map((c) => [c.id, c.parentId]));
  const childMap = new Map<string, string[]>();
  for (const cat of allCategories) {
    if (cat.parentId) {
      if (!childMap.has(cat.parentId)) childMap.set(cat.parentId, []);
      childMap.get(cat.parentId)!.push(cat.id);
    }
  }

  // Gather category and all its descendants
  const descendantIds: string[] = [categoryId];
  const queue: string[] = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childMap.get(current) || [];
    for (const child of children) {
      descendantIds.push(child);
      queue.push(child);
    }
  }

  // Walk up ancestor path to gather inherited and direct attributes
  const ancestorIds: string[] = [];
  let currId: string | null = categoryId;
  const visited = new Set<string>();

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    ancestorIds.push(currId);
    currId = parentMap.get(currId) || null;
  }

  const categoryIdsToInclude = Array.from(new Set([...ancestorIds, ...descendantIds]));

  const attributes = await prisma.categoryAttribute.findMany({
    where: {
      categoryId: { in: categoryIdsToInclude },
      isFilterable: true,
    },
    include: {
      predefinedValues: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return attributes.map((attr) => ({
    id: attr.id,
    categoryId: attr.categoryId,
    name: attr.name,
    slug: attr.slug,
    type: attr.type,
    unit: attr.unit,
    options: attr.predefinedValues.map((v) => ({
      id: v.id,
      value: v.value,
      label: v.label,
    })),
  }));
}

/**
 * Main query function for Customer Showroom Catalogue.
 * Performs server-side multi-attribute filtering (OR within attribute, AND across attributes),
 * category hierarchy traversal, price bounds, sorting, and pagination.
 *
 * Performance-optimized: selects only lightweight card fields, fetches primary image only,
 * and skips video/heavy relational overhead for list rendering.
 */
const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  modelNumber: true,
  description: true,
  brandId: true,
  categoryId: true,
  mrp: true,
  sellingPrice: true,
  privatePriceCode: true,
  warranty: true,
  isFeatured: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  brand: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  category: {
    select: { id: true, name: true, slug: true, parentId: true },
  },
  inventory: {
    select: { id: true, quantity: true, lowStockThreshold: true },
  },
  images: {
    orderBy: [
      { isPrimary: Prisma.SortOrder.desc },
      { sortOrder: Prisma.SortOrder.asc },
      { createdAt: Prisma.SortOrder.asc },
    ],
    take: 1,
    select: {
      id: true,
      productId: true,
      url: true,
      publicId: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  attributeValues: {
    take: 4,
    select: {
      id: true,
      attributeId: true,
      value: true,
      numericValue: true,
      booleanValue: true,
      attribute: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          unit: true,
        },
      },
    },
  },
};

type RawProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/**
 * Retrieves paginated products for Customer Showroom catalogue with
 * category hierarchy traversal, mutually exclusive price filtering (Selling Price or Price Code),
 * sorting, and pagination.
 *
 * Missing-value semantics:
 * When Selling Price Range or Price Code Range is active, matching products appear first,
 * out-of-range products are excluded, and products missing the active field appear last.
 */
export async function getCatalogueProducts(
  params: CatalogueQueryParams = {}
): Promise<PaginatedCatalogueResponse> {
  const {
    search,
    categoryId,
    brandIds = [],
    minPrice,
    maxPrice,
    minSellingPrice: rawMinSelling,
    maxSellingPrice: rawMaxSelling,
    minPriceCode: rawMinPriceCode,
    maxPriceCode: rawMaxPriceCode,
    inStockOnly = false,
    featuredOnly = false,
    attributeFilters = [],
    sortBy = "featured",
    page = 1,
    limit = 12,
  } = params;

  const skip = (page - 1) * limit;

  // Determine which price filter is active (mutually exclusive)
  const isPriceCodeActive =
    (rawMinPriceCode !== undefined && rawMinPriceCode !== null) ||
    (rawMaxPriceCode !== undefined && rawMaxPriceCode !== null);

  const effectiveMinSelling = rawMinSelling ?? minPrice;
  const effectiveMaxSelling = rawMaxSelling ?? maxPrice;

  const isSellingPriceActive =
    !isPriceCodeActive &&
    ((effectiveMinSelling !== undefined && effectiveMinSelling !== null) ||
      (effectiveMaxSelling !== undefined && effectiveMaxSelling !== null));

  const minSellingPrice = isSellingPriceActive && effectiveMinSelling !== undefined ? Math.max(0, effectiveMinSelling) : undefined;
  const maxSellingPrice = isSellingPriceActive && effectiveMaxSelling !== undefined ? Math.max(0, effectiveMaxSelling) : undefined;
  const minPriceCode = isPriceCodeActive && rawMinPriceCode !== undefined ? Math.max(0, rawMinPriceCode) : undefined;
  const maxPriceCode = isPriceCodeActive && rawMaxPriceCode !== undefined ? Math.max(0, rawMaxPriceCode) : undefined;

  // Base Where Conditions (active, category, brand, featured, search, in-stock, specifications)
  const baseAndConditions: Prisma.ProductWhereInput[] = [{ isActive: true }];

  // 1. Category hierarchy filter (selected category + all descendant subcategories)
  if (categoryId && categoryId !== "all") {
    const categoryIds = await timeOperation(
      "category_hierarchy",
      () => getCategoryWithDescendantIds(categoryId),
      "Resolve Category Hierarchy"
    );
    baseAndConditions.push({ categoryId: { in: categoryIds } });
  }

  // 2. Brand filter
  if (brandIds && brandIds.length > 0) {
    baseAndConditions.push({ brandId: { in: brandIds } });
  }

  // 3. Featured only
  if (featuredOnly) {
    baseAndConditions.push({ isFeatured: true });
  }

  // 4. Text Search
  if (search && search.trim()) {
    const term = search.trim();
    baseAndConditions.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
        { modelNumber: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { brand: { name: { contains: term, mode: "insensitive" } } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  // 5. In-Stock Filter
  if (inStockOnly) {
    baseAndConditions.push({
      inventory: {
        quantity: { gt: 0 },
      },
    });
  }

  // 6. Dynamic Category Attribute Filters
  if (attributeFilters && attributeFilters.length > 0) {
    for (const filter of attributeFilters) {
      if (!filter) continue;

      const attrWhere: Prisma.ProductAttributeValueWhereInput = {};
      if (filter.attributeId) {
        attrWhere.attributeId = filter.attributeId;
      } else if (filter.slug) {
        attrWhere.attribute = { slug: filter.slug };
      }

      if (filter.values && filter.values.length > 0) {
        if (filter.values.length === 1) {
          attrWhere.value = filter.values[0];
        } else {
          attrWhere.OR = filter.values.map((v) => ({ value: v }));
        }
      }

      if (filter.minNumeric !== undefined || filter.maxNumeric !== undefined) {
        attrWhere.numericValue = {};
        if (filter.minNumeric !== undefined) {
          attrWhere.numericValue.gte = filter.minNumeric;
        }
        if (filter.maxNumeric !== undefined) {
          attrWhere.numericValue.lte = filter.maxNumeric;
        }
      }

      if (filter.booleanValue !== undefined) {
        attrWhere.booleanValue = filter.booleanValue;
      }

      baseAndConditions.push({
        attributeValues: {
          some: attrWhere,
        },
      });
    }
  }

  const baseWhere: Prisma.ProductWhereInput = {
    AND: baseAndConditions,
  };

  // 7. Sorting
  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
  switch (sortBy) {
    case "price_asc":
      orderBy = [{ sellingPrice: "asc" }, { createdAt: "desc" }];
      break;
    case "price_desc":
      orderBy = [{ sellingPrice: "desc" }, { createdAt: "desc" }];
      break;
    case "name_asc":
      orderBy = { name: "asc" };
      break;
    case "name_desc":
      orderBy = { name: "desc" };
      break;
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    case "featured":
    default:
      orderBy = [{ isFeatured: "desc" }, { createdAt: "desc" }];
      break;
  }

  let totalCount = 0;
  let rawProducts: RawProductCard[] = [];

  if (isSellingPriceActive) {
    // SELLING PRICE RANGE FILTER
    // Matching products: sellingPrice within [min, max]
    // Missing products: sellingPrice is null (displayed last)
    // Excluded products: sellingPrice not null and outside [min, max]
    const sellingPriceFilter: Prisma.DecimalNullableFilter = { not: null };
    if (minSellingPrice !== undefined) sellingPriceFilter.gte = minSellingPrice;
    if (maxSellingPrice !== undefined) sellingPriceFilter.lte = maxSellingPrice;

    const matchingWhere: Prisma.ProductWhereInput = {
      AND: [...baseAndConditions, { sellingPrice: sellingPriceFilter }],
    };
    const missingWhere: Prisma.ProductWhereInput = {
      AND: [...baseAndConditions, { sellingPrice: null }],
    };

    const [matchingCount, missingCount] = await Promise.all([
      timeOperation(
        "db_count_matching",
        () => prisma.product.count({ where: matchingWhere }),
        "Count Matching Selling Price Products"
      ),
      timeOperation(
        "db_count_missing",
        () => prisma.product.count({ where: missingWhere }),
        "Count Missing Selling Price Products"
      ),
    ]);

    totalCount = matchingCount + missingCount;

    if (skip < matchingCount) {
      const takeMatching = Math.min(limit, matchingCount - skip);
      const matchingProducts = await timeOperation(
        "db_products_matching",
        () =>
          prisma.product.findMany({
            where: matchingWhere,
            skip,
            take: takeMatching,
            orderBy,
            select: productCardSelect,
          }),
        "Fetch Matching Selling Price Products"
      );

      if (matchingProducts.length < limit) {
        const remainingLimit = limit - matchingProducts.length;
        const missingProducts = await timeOperation(
          "db_products_missing",
          () =>
            prisma.product.findMany({
              where: missingWhere,
              skip: 0,
              take: remainingLimit,
              orderBy,
              select: productCardSelect,
            }),
          "Fetch Missing Selling Price Products (Fill Remaining)"
        );
        rawProducts = [...matchingProducts, ...missingProducts];
      } else {
        rawProducts = matchingProducts;
      }
    } else {
      const missingSkip = skip - matchingCount;
      rawProducts = await timeOperation(
        "db_products_missing",
        () =>
          prisma.product.findMany({
            where: missingWhere,
            skip: missingSkip,
            take: limit,
            orderBy,
            select: productCardSelect,
          }),
        "Fetch Missing Selling Price Products"
      );
    }
  } else if (isPriceCodeActive) {
    // PRICE CODE RANGE FILTER (100% Database-Side ID Resolution)
    // - Numeric price codes in [min, max] appear first
    // - Missing, null, and non-numeric codes appear last (across all pages)
    // - Out-of-range numeric codes are excluded
    // - No full-table load into Node.js; only the paginated product IDs are resolved
    const baseClauses: Prisma.Sql[] = [Prisma.sql`"isActive" = true`];

    if (categoryId && categoryId !== "all") {
      const categoryIds = await timeOperation(
        "category_hierarchy",
        () => getCategoryWithDescendantIds(categoryId),
        "Resolve Category Hierarchy"
      );
      if (categoryIds.length > 0) {
        baseClauses.push(Prisma.sql`"categoryId" IN (${Prisma.join(categoryIds)})`);
      }
    }

    if (brandIds && brandIds.length > 0) {
      baseClauses.push(Prisma.sql`"brandId" IN (${Prisma.join(brandIds)})`);
    }

    if (featuredOnly) {
      baseClauses.push(Prisma.sql`"isFeatured" = true`);
    }

    if (inStockOnly) {
      baseClauses.push(
        Prisma.sql`EXISTS (SELECT 1 FROM inventories i WHERE i."productId" = products.id AND i.quantity > 0)`
      );
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      baseClauses.push(
        Prisma.sql`("name" ILIKE ${term} OR "sku" ILIKE ${term} OR "modelNumber" ILIKE ${term} OR "description" ILIKE ${term} OR EXISTS (SELECT 1 FROM brands b WHERE b.id = products."brandId" AND b.name ILIKE ${term}) OR EXISTS (SELECT 1 FROM categories c WHERE c.id = products."categoryId" AND c.name ILIKE ${term}))`
      );
    }

    if (attributeFilters && attributeFilters.length > 0) {
      for (const filter of attributeFilters) {
        if (!filter) continue;
        const conds: Prisma.Sql[] = [];
        if (filter.attributeId) {
          conds.push(Prisma.sql`pav."attributeId" = ${filter.attributeId}`);
        } else if (filter.slug) {
          conds.push(Prisma.sql`ca.slug = ${filter.slug}`);
        }
        if (filter.values && filter.values.length > 0) {
          conds.push(Prisma.sql`pav.value IN (${Prisma.join(filter.values)})`);
        }
        if (filter.minNumeric !== undefined) {
          conds.push(Prisma.sql`pav."numericValue" >= ${filter.minNumeric}`);
        }
        if (filter.maxNumeric !== undefined) {
          conds.push(Prisma.sql`pav."numericValue" <= ${filter.maxNumeric}`);
        }
        if (filter.booleanValue !== undefined) {
          conds.push(Prisma.sql`pav."booleanValue" = ${filter.booleanValue}`);
        }
        baseClauses.push(
          Prisma.sql`EXISTS (SELECT 1 FROM product_attribute_values pav LEFT JOIN category_attributes ca ON ca.id = pav."attributeId" WHERE pav."productId" = products.id AND ${Prisma.join(conds, " AND ")})`
        );
      }
    }

    const baseWhereSql = Prisma.sql`${Prisma.join(baseClauses, " AND ")}`;

    const validCodeCheck = Prisma.sql`(${PRICE_CODE_SQL_EXPR}) IS NOT NULL`;
    const codeConditions: Prisma.Sql[] = [validCodeCheck];
    if (minPriceCode !== undefined) {
      codeConditions.push(Prisma.sql`(${PRICE_CODE_SQL_EXPR}) >= ${minPriceCode}`);
    }
    if (maxPriceCode !== undefined) {
      codeConditions.push(Prisma.sql`(${PRICE_CODE_SQL_EXPR}) <= ${maxPriceCode}`);
    }

    const matchingWhereSql = Prisma.sql`${baseWhereSql} AND ${Prisma.join(codeConditions, " AND ")}`;
    const missingWhereSql = Prisma.sql`${baseWhereSql} AND (${PRICE_CODE_SQL_EXPR}) IS NULL`;

    let matchingOrderSql: Prisma.Sql;
    let missingOrderSql: Prisma.Sql;

    switch (sortBy) {
      case "price_asc":
        matchingOrderSql = Prisma.sql`(${PRICE_CODE_SQL_EXPR}) ASC, "createdAt" DESC`;
        missingOrderSql = Prisma.sql`"sellingPrice" ASC NULLS LAST, "createdAt" DESC`;
        break;
      case "price_desc":
        matchingOrderSql = Prisma.sql`(${PRICE_CODE_SQL_EXPR}) DESC, "createdAt" DESC`;
        missingOrderSql = Prisma.sql`"sellingPrice" DESC NULLS LAST, "createdAt" DESC`;
        break;
      case "name_asc":
        matchingOrderSql = Prisma.sql`"name" ASC`;
        missingOrderSql = Prisma.sql`"name" ASC`;
        break;
      case "name_desc":
        matchingOrderSql = Prisma.sql`"name" DESC`;
        missingOrderSql = Prisma.sql`"name" DESC`;
        break;
      case "newest":
        matchingOrderSql = Prisma.sql`"createdAt" DESC`;
        missingOrderSql = Prisma.sql`"createdAt" DESC`;
        break;
      case "featured":
      default:
        matchingOrderSql = Prisma.sql`"isFeatured" DESC, "createdAt" DESC`;
        missingOrderSql = Prisma.sql`"isFeatured" DESC, "createdAt" DESC`;
        break;
    }

    // 1. Database-side counts
    const [counts]: any = await timeOperation(
      "db_price_code_counts",
      () =>
        prisma.$queryRaw<Array<{ matching_count: number; missing_count: number }>>`
          SELECT
            (SELECT COUNT(*)::int FROM products WHERE ${matchingWhereSql}) as matching_count,
            (SELECT COUNT(*)::int FROM products WHERE ${missingWhereSql}) as missing_count
        `,
      "Count Matching and Missing Price Code Products (Database-Side)"
    );

    const matchingCount = Number(counts?.matching_count || 0);
    const missingCount = Number(counts?.missing_count || 0);
    totalCount = matchingCount + missingCount;

    // 2. Database-side pagination of product IDs
    let pageIds: string[] = [];

    if (skip < matchingCount) {
      const takeMatching = Math.min(limit, matchingCount - skip);
      const matchingRows = await timeOperation(
        "db_price_code_page_matching",
        () =>
          prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM products
            WHERE ${matchingWhereSql}
            ORDER BY ${matchingOrderSql}
            LIMIT ${takeMatching} OFFSET ${skip}
          `,
        "Fetch Matching Price Code Page IDs (Database-Side)"
      );
      pageIds = matchingRows.map((r) => r.id);

      if (pageIds.length < limit) {
        const remainingLimit = limit - pageIds.length;
        const missingRows = await timeOperation(
          "db_price_code_page_missing",
          () =>
            prisma.$queryRaw<Array<{ id: string }>>`
              SELECT id FROM products
              WHERE ${missingWhereSql}
              ORDER BY ${missingOrderSql}
              LIMIT ${remainingLimit} OFFSET 0
            `,
          "Fetch Missing Price Code Page IDs (Fill Remaining)"
        );
        pageIds = [...pageIds, ...missingRows.map((r) => r.id)];
      }
    } else {
      const missingSkip = skip - matchingCount;
      const missingRows = await timeOperation(
        "db_price_code_page_missing",
        () =>
          prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM products
            WHERE ${missingWhereSql}
            ORDER BY ${missingOrderSql}
            LIMIT ${limit} OFFSET ${missingSkip}
          `,
        "Fetch Missing Price Code Page IDs"
      );
      pageIds = missingRows.map((r) => r.id);
    }

    if (pageIds.length > 0) {
      const pageProducts = await timeOperation(
        "db_products_page",
        () =>
          prisma.product.findMany({
            where: { id: { in: pageIds } },
            select: productCardSelect,
          }),
        "Fetch Page Products for Price Code"
      );
      const prodMap = new Map(pageProducts.map((p) => [p.id, p]));
      rawProducts = pageIds.map((id) => prodMap.get(id)).filter((p): p is RawProductCard => Boolean(p));
    } else {
      rawProducts = [];
    }
  } else {
    // Default catalogue behavior (No price filter active)
    const [count, prods] = await Promise.all([
      timeOperation("db_count", () => prisma.product.count({ where: baseWhere }), "Product Count Query"),
      timeOperation(
        "db_products",
        () =>
          prisma.product.findMany({
            where: baseWhere,
            skip,
            take: limit,
            orderBy,
            select: productCardSelect,
          }),
        "Product FindMany & Relations"
      ),
    ]);
    totalCount = count;
    rawProducts = prods;
  }

  // Retrieve dynamic category filters and cached price ranges concurrently
  const [availableFilters, priceRanges] = await Promise.all([
    timeOperation(
      "db_filters",
      () => getCategoryDynamicFilters(categoryId),
      "Resolve Dynamic Attribute Filters"
    ),
    getCachedPriceRanges(),
  ]);

  // Format products for catalogue list
  const products: CatalogueProductItem[] = await timeOperation(
    "format_products",
    () =>
      rawProducts.map((p) => {
        const mrp = Number(p.mrp);
        const sellingPrice = p.sellingPrice != null ? Number(p.sellingPrice) : null;
        const qty = p.inventory?.quantity ?? 0;
        const threshold = p.inventory?.lowStockThreshold ?? 5;
        const stockStatus = calculateStockStatus(qty, threshold);

        const primaryImage =
          p.images.find((img) => img.isPrimary) ||
          (p.images.length > 0 ? p.images[0] : null);

        const formattedImages: ProductImageItem[] = p.images.map((img) => ({
          id: img.id,
          productId: img.productId,
          url: img.url,
          publicId: img.publicId,
          altText: img.altText,
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary,
          createdAt: img.createdAt,
          updatedAt: img.updatedAt,
        }));

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          modelNumber: p.modelNumber,
          description: p.description,
          brandId: p.brandId,
          categoryId: p.categoryId,
          mrp,
          sellingPrice,
          stockStatus,
          stockQuantity: qty,
          discountPercent: calculateDiscountPercent(mrp, sellingPrice),
          privatePriceCode: p.privatePriceCode,
          warranty: p.warranty,
          isFeatured: p.isFeatured,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          brand: p.brand,
          category: p.category,
          inventory: {
            quantity: qty,
            lowStockThreshold: threshold,
            stockStatus,
          },
          primaryImage,
          images: formattedImages,
          videos: [], // videos are not needed on product list cards
          attributeValues: p.attributeValues.map((av) => ({
            id: av.id,
            attributeId: av.attributeId,
            attributeSlug: av.attribute.slug,
            attributeName: av.attribute.name,
            attributeType: av.attribute.type,
            unit: av.attribute.unit,
            value: av.value,
            numericValue: av.numericValue,
            booleanValue: av.booleanValue,
          })),
        };
      }),
    "Format Product Cards (In-Memory)"
  );

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    products,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    availableFilters,
    priceRange: priceRanges.priceRange,
    priceCodeRange: priceRanges.priceCodeRange,
    sellingPriceRange: priceRanges.sellingPriceRange,
  };
}

/**
 * Retrieves full detail for a single product in Customer Showroom.
 * Fetches all images, all videos, full specifications, breadcrumbs, and similar products.
 */
export async function getCatalogueProductDetail(
  idOrSlug: string
): Promise<CatalogueProductItem | null> {
  const isCuid = idOrSlug.startsWith("c") && idOrSlug.length > 20;

  const product = await timeOperation(
    "db_main_product",
    () =>
      prisma.product.findFirst({
        where: {
          OR: [
            { id: isCuid ? idOrSlug : undefined },
            { slug: idOrSlug },
            { sku: idOrSlug },
          ],
          isActive: true,
        },
        include: {
          brand: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          category: {
            select: { id: true, name: true, slug: true, parentId: true },
          },
          inventory: {
            select: { id: true, quantity: true, lowStockThreshold: true },
          },
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          videos: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          attributeValues: {
            include: {
              attribute: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  type: true,
                  unit: true,
                },
              },
            },
          },
        },
      }),
    "Query Main Product with Media & Relations"
  );

  if (!product) return null;

  // Build breadcrumbs in memory
  const allCategories = await timeOperation(
    "db_breadcrumbs_categories",
    () =>
      prisma.category.findMany({
        select: { id: true, name: true, slug: true, parentId: true },
      }),
    "Query Categories for Breadcrumbs"
  );

  const breadcrumbs: CategoryBreadcrumb[] = await timeOperation(
    "build_breadcrumbs",
    () => {
      const catMap = new Map(allCategories.map((c) => [c.id, c]));
      const crumbs: CategoryBreadcrumb[] = [];
      let currentParentId = product.category.parentId;
      const visited = new Set<string>();

      while (currentParentId && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        const parent = catMap.get(currentParentId);
        if (parent) {
          crumbs.unshift({ id: parent.id, name: parent.name, slug: parent.slug });
          currentParentId = parent.parentId;
        } else {
          break;
        }
      }
      crumbs.push({
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      });
      return crumbs;
    },
    "Build Breadcrumbs Hierarchy in Memory"
  );

  const mrp = Number(product.mrp);
  const sellingPrice = product.sellingPrice != null ? Number(product.sellingPrice) : null;
  const qty = product.inventory?.quantity ?? 0;
  const threshold = product.inventory?.lowStockThreshold ?? 5;
  const stockStatus = calculateStockStatus(qty, threshold);

  const primaryImage =
    product.images.find((img) => img.isPrimary) ||
    (product.images.length > 0 ? product.images[0] : null);

  const formattedImages: ProductImageItem[] = product.images.map((img) => ({
    id: img.id,
    productId: img.productId,
    url: img.url,
    publicId: img.publicId,
    altText: img.altText,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
    createdAt: img.createdAt,
    updatedAt: img.updatedAt,
  }));

  const formattedVideos: ProductVideoItem[] = product.videos.map((vid) => {
    let youtubeVideoId: string | null = null;
    if (vid.videoType === "YOUTUBE") {
      const match = vid.url.match(
        /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
      );
      youtubeVideoId = match ? match[1] : null;
    }
    return {
      id: vid.id,
      productId: vid.productId,
      videoType: vid.videoType,
      url: vid.url,
      title: vid.title,
      sortOrder: vid.sortOrder,
      createdAt: vid.createdAt,
      youtubeVideoId,
      thumbnailUrl: youtubeVideoId
        ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`
        : undefined,
    };
  });

  const parentId = product.category.parentId;
  const currentCategoryId = product.categoryId;
  const siblingCategoryIds = parentId
    ? allCategories
        .filter(
          (c) =>
            (c.id === parentId || c.parentId === parentId) &&
            c.id !== currentCategoryId
        )
        .map((c) => c.id)
    : [];

  const similarProducts = await timeOperation(
    "service_similar_products",
    () =>
      getSimilarProducts(product.id, 8, {
        categoryId: product.categoryId,
        parentId,
        siblingCategoryIds,
      }),
    "Similar Products Service Total"
  );

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    modelNumber: product.modelNumber,
    description: product.description,
    brandId: product.brandId,
    categoryId: product.categoryId,
    mrp,
    sellingPrice,
    discountPercent: calculateDiscountPercent(mrp, sellingPrice),
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
    inventory: {
      quantity: qty,
      lowStockThreshold: threshold,
      stockStatus,
    },
    primaryImage,
    images: formattedImages,
    videos: formattedVideos,
    attributeValues: product.attributeValues.map((av) => ({
      id: av.id,
      attributeId: av.attributeId,
      attributeSlug: av.attribute.slug,
      attributeName: av.attribute.name,
      attributeType: av.attribute.type,
      unit: av.attribute.unit,
      value: av.value,
      numericValue: av.numericValue,
      booleanValue: av.booleanValue,
    })),
    similarProducts,
  };
}

/**
 * Retrieves similar products based on:
 * 1. Same subcategory first (excluding current product).
 * 2. Same parent category if needed to reach target limit (4-8 products).
 * 3. Excludes current product and avoids duplicates.
 *
 * Performance-optimized: selects lightweight card fields and primary images only.
 */
export interface SimilarProductsOptions {
  categoryId?: string;
  parentId?: string | null;
  siblingCategoryIds?: string[];
}

export async function getSimilarProducts(
  productId: string,
  limit = 8,
  options?: SimilarProductsOptions
): Promise<CatalogueProductItem[]> {
  let categoryId: string;
  let parentId: string | null = null;

  if (options?.categoryId) {
    categoryId = options.categoryId;
    parentId = options.parentId !== undefined ? options.parentId : null;
    getActiveTiming()?.record(
      "db_similar_lookup_current",
      0,
      "Lookup Current Product Category (Reused from Main)"
    );
  } else {
    const currentProduct = await timeOperation(
      "db_similar_lookup_current",
      () =>
        prisma.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            categoryId: true,
            category: { select: { parentId: true } },
          },
        }),
      "Lookup Current Product Category"
    );

    if (!currentProduct) return [];
    categoryId = currentProduct.categoryId;
    parentId = currentProduct.category.parentId;
  }

  const foundProductIds = new Set<string>([productId]);
  const rawSimilarList: any[] = [];

  const similarSelect = {
    id: true,
    name: true,
    slug: true,
    sku: true,
    modelNumber: true,
    description: true,
    brandId: true,
    categoryId: true,
    mrp: true,
    sellingPrice: true,
    privatePriceCode: true,
    warranty: true,
    isFeatured: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
    category: { select: { id: true, name: true, slug: true, parentId: true } },
    inventory: { select: { id: true, quantity: true, lowStockThreshold: true } },
    images: {
      orderBy: [{ isPrimary: Prisma.SortOrder.desc }, { sortOrder: Prisma.SortOrder.asc }, { createdAt: Prisma.SortOrder.asc }],
      take: 1,
      select: {
        id: true,
        productId: true,
        url: true,
        publicId: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    attributeValues: {
      take: 4,
      select: {
        id: true,
        attributeId: true,
        value: true,
        numericValue: true,
        booleanValue: true,
        attribute: {
          select: { id: true, name: true, slug: true, type: true, unit: true },
        },
      },
    },
  };

  // 1. Same subcategory products
  const sameCategoryProducts = await timeOperation(
    "db_similar_same_subcat",
    () =>
      prisma.product.findMany({
        where: {
          categoryId,
          id: { not: productId },
          isActive: true,
        },
        take: limit,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        select: similarSelect,
      }),
    "Query Similar Products (Same Subcategory)"
  );

  for (const p of sameCategoryProducts) {
    foundProductIds.add(p.id);
    rawSimilarList.push(p);
  }

  // 2. If fewer than limit and parent category exists, fill remaining from same parent category / siblings
  if (rawSimilarList.length < limit && parentId) {
    const remainingCount = limit - rawSimilarList.length;

    // Resolve sibling category IDs: either from provided authoritative list or query
    let targetCategoryIds: string[];
    if (options?.siblingCategoryIds !== undefined) {
      targetCategoryIds = options.siblingCategoryIds.filter((id) => id !== categoryId);
    } else {
      const siblingCategories = await prisma.category.findMany({
        where: {
          OR: [{ id: parentId }, { parentId }],
          id: { not: categoryId },
        },
        select: { id: true },
      });
      targetCategoryIds = siblingCategories.map((c) => c.id);
    }

    if (targetCategoryIds.length > 0) {
      const siblingCategoryProducts = await timeOperation(
        "db_similar_parent_cat",
        () =>
          prisma.product.findMany({
            where: {
              id: { notIn: Array.from(foundProductIds) },
              isActive: true,
              categoryId: { in: targetCategoryIds },
            },
            take: remainingCount,
            orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
            select: similarSelect,
          }),
        "Query Similar Products (Parent/Sibling Category)"
      );

      for (const p of siblingCategoryProducts) {
        if (!foundProductIds.has(p.id)) {
          foundProductIds.add(p.id);
          rawSimilarList.push(p);
        }
      }
    }
  }

  // Map each raw product to CatalogueProductItem format
  return await timeOperation(
    "format_similar_products",
    () =>
      rawSimilarList.map((p) => {
        const mrp = Number(p.mrp);
        const sellingPrice = p.sellingPrice != null ? Number(p.sellingPrice) : null;
        const qty = p.inventory?.quantity ?? 0;
        const threshold = p.inventory?.lowStockThreshold ?? 5;
        const stockStatus = calculateStockStatus(qty, threshold);
        const primaryImage =
          p.images.find((img: any) => img.isPrimary) ||
          (p.images.length > 0 ? p.images[0] : null);

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          modelNumber: p.modelNumber,
          description: p.description,
          brandId: p.brandId,
          categoryId: p.categoryId,
          mrp,
          sellingPrice,
          discountPercent: calculateDiscountPercent(mrp, sellingPrice),
          privatePriceCode: p.privatePriceCode,
          warranty: p.warranty,
          isFeatured: p.isFeatured,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          brand: p.brand,
          category: p.category,
          inventory: {
            quantity: qty,
            lowStockThreshold: threshold,
            stockStatus,
          },
          primaryImage,
          images: p.images.map((img: any) => ({
            id: img.id,
            productId: img.productId,
            url: img.url,
            publicId: img.publicId,
            altText: img.altText,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
          })),
          videos: [],
          attributeValues: p.attributeValues.map((av: any) => ({
            id: av.id,
            attributeId: av.attributeId,
            attributeSlug: av.attribute.slug,
            attributeName: av.attribute.name,
            attributeType: av.attribute.type,
            unit: av.attribute.unit,
            value: av.value,
            numericValue: av.numericValue,
            booleanValue: av.booleanValue,
          })),
        };
      }),
    "Format Similar Product Cards (In-Memory)"
  );
}
