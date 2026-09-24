import {
  AdminRole,
  AttributeType,
  VideoType,
  InventoryMovementType,
  Prisma,
} from "@prisma/client";

export { AdminRole, AttributeType, VideoType, InventoryMovementType };

// Human-friendly mapping for AttributeType
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  SELECT: "Select one",
  MULTI_SELECT: "Select multiple",
  TEXT: "Text",
  NUMBER: "Number",
  BOOLEAN: "Yes / No",
  RANGE: "Range",
};

export const ATTRIBUTE_TYPE_DESCRIPTIONS: Record<AttributeType, string> = {
  SELECT: "Customers choose a single option from a list (e.g. 2 Burners, 3 Burners)",
  MULTI_SELECT: "Customers can choose multiple options (e.g. Features)",
  TEXT: "Free-form text for unique specifications (e.g. Color finish)",
  NUMBER: "Numeric value with optional unit (e.g. 750 Watts)",
  BOOLEAN: "Simple Yes or No switch (e.g. Auto Clean, Child Lock)",
  RANGE: "Numeric range with min and max bounds",
};

// Tree node interface for admin hierarchy
export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    children: number;
    products: number;
    attributes: number;
  };
  children: CategoryTreeNode[];
}

export interface CategoryBreadcrumb {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryDetailView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  parent: {
    id: string;
    name: string;
    slug: string;
  } | null;
  breadcrumbs: CategoryBreadcrumb[];
  _count: {
    children: number;
    products: number;
    attributes: number;
  };
  attributes: {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    type: AttributeType;
    unit: string | null;
    isFilterable: boolean;
    isRequired: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    predefinedValues: {
      id: string;
      attributeId: string;
      value: string;
      label: string;
      sortOrder: number;
    }[];
    _count: {
      productAttributeValues: number;
      predefinedValues: number;
    };
  }[];
}

// Brand simple interface for dropdowns
export interface BrandOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

// Product List Item for Admin Table
export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  modelNumber: string | null;
  description: string | null;
  brandId: string;
  categoryId: string;
  mrp: number;
  sellingPrice: number | null;
  discountPercent: number | null;
  privatePriceCode: string | null; // Price Code in UI
  warranty: string | null;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  brand: {
    id: string;
    name: string;
    slug: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  };
  _count?: {
    attributeValues: number;
    images: number;
    videos: number;
  };
}

export interface ProductAttributeValueDetail {
  id: string;
  productId: string;
  attributeId: string;
  attributeValueId: string | null;
  value: string;
  numericValue: number | null;
  booleanValue: boolean | null;
  attribute: {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    type: AttributeType;
    unit: string | null;
    isRequired: boolean;
    isFilterable: boolean;
  };
  attributeValue: {
    id: string;
    value: string;
    label: string;
  } | null;
}

// Product Complete Detail View for Form / View
export interface ProductAdminDetailView {
  id: string;
  name: string;
  slug: string;
  sku: string;
  modelNumber: string | null;
  description: string | null;
  brandId: string;
  categoryId: string;
  mrp: number;
  sellingPrice: number | null;
  discountPercent: number | null;
  privatePriceCode: string | null;
  warranty: string | null;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  brand: BrandOption;
  category: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    breadcrumbs: CategoryBreadcrumb[];
  };
  attributeValues: ProductAttributeValueDetail[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedProductsResponse {
  products: ProductListItem[];
  pagination: PaginationInfo;
}

// Helper types for relations and payload
export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: {
    children: true;
    attributes: {
      include: {
        predefinedValues: true;
      };
    };
  };
}>;

export type ProductWithDetails = Prisma.ProductGetPayload<{
  include: {
    brand: true;
    category: true;
    images: true;
    videos: true;
    inventory: true;
    attributeValues: {
      include: {
        attribute: true;
        attributeValue: true;
      };
    };
  };
}>;

// ==============================================================================
// INVENTORY & STOCK MANAGEMENT TYPES (Phase 4)
// ==============================================================================

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

export const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  PURCHASE: "Purchase (Add Stock)",
  SALE: "Customer Sale",
  DAMAGED: "Damaged Stock",
  RETURN: "Customer Return",
  ADJUSTMENT: "Manual Adjustment",
};

export interface InventoryListItem {
  id: string; // Inventory ID
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  modelNumber: string | null;
  mrp: number;
  sellingPrice: number | null;
  brand: {
    id: string;
    name: string;
    slug: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  quantity: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  updatedAt: Date;
  lastMovement: {
    movementType: InventoryMovementType;
    quantity: number;
    createdAt: Date;
  } | null;
}

export interface InventoryMovementRecord {
  id: string;
  productId: string;
  quantity: number; // Delta quantity (+ for add, - for deduct)
  movementType: InventoryMovementType;
  note: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface InventoryDetailView {
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    modelNumber: string | null;
    mrp: number;
    sellingPrice: number | null;
    brand: {
      id: string;
      name: string;
    };
    category: {
      id: string;
      name: string;
    };
  };
  inventory: {
    id: string;
    quantity: number;
    lowStockThreshold: number;
    stockStatus: StockStatus;
    updatedAt: Date;
  };
  movements: InventoryMovementRecord[];
}

export interface InventoryMetrics {
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalUnitsInStock: number;
}

export interface PaginatedInventoryResponse {
  items: InventoryListItem[];
  pagination: PaginationInfo;
  metrics: InventoryMetrics;
}

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  version: string;
}
