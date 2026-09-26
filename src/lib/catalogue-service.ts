import { prisma } from "./prisma";
import { AttributeType, Prisma } from "@prisma/client";
import { calculateStockStatus } from "./inventory-service";
import { calculateDiscountPercent } from "./product-service";
import { getCategoryWithDescendantIds } from "./category-service";
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
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  attributeFilters?: AttributeFilterParam[];
  sortBy?: "price_asc" | "price_desc" | "name_asc" | "name_desc" | "newest" | "featured";
  page?: number;
  limit?: number;
}

/**
 * Retrieves dynamic attribute filter definitions for a given category (and its ancestors).
 */
export async function getCategoryDynamicFilters(
  categoryId?: string | null
): Promise<DynamicAttributeFilterDef[]> {
  if (!categoryId || categoryId === "all") {
    // When "All Categories" is selected, do not return specification filters
    return [];
  }

  // Gather category, descendants, and ancestors so all relevant filterable specifications are returned
  const descendantIds = await getCategoryWithDescendantIds(categoryId);

  // Walk up ancestor path to gather inherited and direct attributes
  const ancestorIds: string[] = [];
  let currId: string | null = categoryId;
  const visited = new Set<string>();

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    ancestorIds.push(currId);
    const cat: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: currId },
      select: { parentId: true },
    });
    currId = cat?.parentId || null;
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
    inStockOnly = false,
    featuredOnly = false,
    attributeFilters = [],
    sortBy = "featured",
    page = 1,
    limit = 12,
  } = params;

  const skip = (page - 1) * limit;

  // Base Where Condition: only active products in customer catalogue
  const andConditions: Prisma.ProductWhereInput[] = [{ isActive: true }];

  // 1. Category hierarchy filter (selected category + all descendant subcategories)
  if (categoryId && categoryId !== "all") {
    const categoryIds = await getCategoryWithDescendantIds(categoryId);
    andConditions.push({ categoryId: { in: categoryIds } });
  }

  // 2. Brand filter
  if (brandIds && brandIds.length > 0) {
    andConditions.push({ brandId: { in: brandIds } });
  }

  // 3. Featured only
  if (featuredOnly) {
    andConditions.push({ isFeatured: true });
  }

  // 4. Text Search
  if (search && search.trim()) {
    const term = search.trim();
    andConditions.push({
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

  // 5. Price Range Filter (on sellingPrice if present, otherwise mrp)
  if (minPrice !== undefined && minPrice !== null) {
    andConditions.push({
      OR: [
        { sellingPrice: { gte: minPrice } },
        { sellingPrice: null, mrp: { gte: minPrice } },
      ],
    });
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    andConditions.push({
      OR: [
        { sellingPrice: { lte: maxPrice } },
        { sellingPrice: null, mrp: { lte: maxPrice } },
      ],
    });
  }

  // 6. In-Stock Filter
  if (inStockOnly) {
    andConditions.push({
      inventory: {
        quantity: { gt: 0 },
      },
    });
  }

  // 7. Dynamic Category Attribute Filters
  // Logic: OR within same attribute, AND between different attributes
  if (attributeFilters && attributeFilters.length > 0) {
    for (const filter of attributeFilters) {
      if (!filter) continue;

      const attrWhere: Prisma.ProductAttributeValueWhereInput = {};
      if (filter.attributeId) {
        attrWhere.attributeId = filter.attributeId;
      } else if (filter.slug) {
        attrWhere.attribute = { slug: filter.slug };
      }

      // Values (SELECT, MULTI_SELECT, TEXT) -> OR within values
      if (filter.values && filter.values.length > 0) {
        if (filter.values.length === 1) {
          attrWhere.value = filter.values[0];
        } else {
          attrWhere.OR = filter.values.map((v) => ({ value: v }));
        }
      }

      // Numeric Range (NUMBER, RANGE)
      if (filter.minNumeric !== undefined || filter.maxNumeric !== undefined) {
        attrWhere.numericValue = {};
        if (filter.minNumeric !== undefined) {
          attrWhere.numericValue.gte = filter.minNumeric;
        }
        if (filter.maxNumeric !== undefined) {
          attrWhere.numericValue.lte = filter.maxNumeric;
        }
      }

      // Boolean
      if (filter.booleanValue !== undefined) {
        attrWhere.booleanValue = filter.booleanValue;
      }

      andConditions.push({
        attributeValues: {
          some: attrWhere,
        },
      });
    }
  }

  const where: Prisma.ProductWhereInput = {
    AND: andConditions,
  };

  // 8. Sorting
  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
  switch (sortBy) {
    case "price_asc":
      orderBy = [{ sellingPrice: "asc" }, { mrp: "asc" }];
      break;
    case "price_desc":
      orderBy = [{ sellingPrice: "desc" }, { mrp: "desc" }];
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

  // 9. Execute queries in parallel
  const [totalCount, rawProducts, availableFilters, priceAggregate] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
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
    getCategoryDynamicFilters(categoryId),
    prisma.product.aggregate({
      where: { isActive: true },
      _min: { mrp: true, sellingPrice: true },
      _max: { mrp: true, sellingPrice: true },
    }),
  ]);

  // Format products
  const products: CatalogueProductItem[] = rawProducts.map((p) => {
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

    const formattedVideos: ProductVideoItem[] = p.videos.map((vid) => {
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
      images: formattedImages,
      videos: formattedVideos,
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
  });

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const minBound = Math.floor(
    Number(priceAggregate._min.sellingPrice || priceAggregate._min.mrp || 0)
  );
  const maxBound = Math.ceil(
    Number(priceAggregate._max.mrp || priceAggregate._max.sellingPrice || 100000)
  );

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
    priceRange: {
      min: minBound,
      max: maxBound,
    },
  };
}

/**
 * Retrieves full detail for a single product in Customer Showroom.
 */
export async function getCatalogueProductDetail(
  idOrSlug: string
): Promise<CatalogueProductItem | null> {
  const isCuid = idOrSlug.startsWith("c") && idOrSlug.length > 20;

  const product = await prisma.product.findFirst({
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
  });

  if (!product) return null;

  // Build breadcrumbs
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
    similarProducts: await getSimilarProducts(product.id, 8),
  };
}

/**
 * Retrieves similar products based on:
 * 1. Same subcategory first (excluding current product).
 * 2. Same parent category if needed to reach target limit (4-8 products).
 * 3. Excludes current product and avoids duplicates.
 */
export async function getSimilarProducts(
  productId: string,
  limit = 8
): Promise<CatalogueProductItem[]> {
  const currentProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      categoryId: true,
      category: { select: { parentId: true } },
    },
  });

  if (!currentProduct) return [];

  const foundProductIds = new Set<string>([productId]);
  const rawSimilarList: any[] = [];

  // 1. Same subcategory products
  const sameCategoryProducts = await prisma.product.findMany({
    where: {
      categoryId: currentProduct.categoryId,
      id: { not: productId },
      isActive: true,
    },
    take: limit,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    include: {
      brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
      category: { select: { id: true, name: true, slug: true, parentId: true } },
      inventory: { select: { id: true, quantity: true, lowStockThreshold: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      videos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      attributeValues: {
        include: {
          attribute: {
            select: { id: true, name: true, slug: true, type: true, unit: true },
          },
        },
      },
    },
  });

  for (const p of sameCategoryProducts) {
    foundProductIds.add(p.id);
    rawSimilarList.push(p);
  }

  // 2. If fewer than limit and parent category exists, fill remaining from same parent category / siblings
  const parentId = currentProduct.category.parentId;
  if (rawSimilarList.length < limit && parentId) {
    const remainingCount = limit - rawSimilarList.length;
    const siblingCategoryProducts = await prisma.product.findMany({
      where: {
        id: { notIn: Array.from(foundProductIds) },
        isActive: true,
        OR: [
          { categoryId: parentId },
          { category: { parentId: parentId } },
        ],
      },
      take: remainingCount,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        category: { select: { id: true, name: true, slug: true, parentId: true } },
        inventory: { select: { id: true, quantity: true, lowStockThreshold: true } },
        images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        videos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        attributeValues: {
          include: {
            attribute: {
              select: { id: true, name: true, slug: true, type: true, unit: true },
            },
          },
        },
      },
    });

    for (const p of siblingCategoryProducts) {
      if (!foundProductIds.has(p.id)) {
        foundProductIds.add(p.id);
        rawSimilarList.push(p);
      }
    }
  }

  // Map each raw product to CatalogueProductItem format
  return rawSimilarList.map((p) => {
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
      videos: p.videos.map((vid: any) => ({
        id: vid.id,
        productId: vid.productId,
        videoType: vid.videoType,
        url: vid.url,
        title: vid.title,
        sortOrder: vid.sortOrder,
        createdAt: vid.createdAt,
      })),
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
  });
}
