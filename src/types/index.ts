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
