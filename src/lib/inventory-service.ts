import { prisma } from "./prisma";
import { InventoryMovementType, Prisma } from "@prisma/client";
import type {
  StockStatus,
  InventoryListItem,
  InventoryDetailView,
  InventoryMovementRecord,
  PaginatedInventoryResponse,
} from "../types";
import type {
  StockMovementInput,
  UpdateLowStockThresholdInput,
  InventoryFilterQuery,
} from "../validations/inventory";

/**
 * Custom application error with user-friendly messages.
 */
export class InventoryServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

/**
 * Pure function to calculate stock status.
 * - Current Stock == 0 => OUT_OF_STOCK
 * - Current Stock > 0 && Current Stock <= Low Stock Threshold => LOW_STOCK
 * - Current Stock > Low Stock Threshold => IN_STOCK
 */
export function calculateStockStatus(
  quantity: number,
  lowStockThreshold: number
): StockStatus {
  if (quantity <= 0) {
    return "OUT_OF_STOCK";
  }
  if (quantity <= lowStockThreshold) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

// ==============================================================================
// 1. INVENTORY LISTING & SEARCH
// ==============================================================================

/**
 * Retrieves paginated list of inventory records with search, filtering, and aggregate metrics.
 */
export async function getInventoryList(
  query: InventoryFilterQuery = {}
): Promise<PaginatedInventoryResponse> {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    brandId,
    stockStatus = "all",
  } = query;

  const skip = (page - 1) * limit;

  // Build where filter on Product
  const productWhere: Prisma.ProductWhereInput = {};

  if (brandId) {
    productWhere.brandId = brandId;
  }

  if (categoryId) {
    productWhere.categoryId = categoryId;
  }

  if (search && search.trim()) {
    const term = search.trim();
    productWhere.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { modelNumber: { contains: term, mode: "insensitive" } },
      { brand: { name: { contains: term, mode: "insensitive" } } },
      { category: { name: { contains: term, mode: "insensitive" } } },
    ];
  }

  // Fetch all matching products with inventory and latest movement
  const products = await prisma.product.findMany({
    where: productWhere,
    include: {
      brand: {
        select: { id: true, name: true, slug: true },
      },
      category: {
        select: { id: true, name: true, slug: true },
      },
      inventory: true,
      inventoryMovements: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          movementType: true,
          quantity: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { name: "asc" },
    ],
  });

  // Map to InventoryListItem and auto-calculate stockStatus
  const allMappedItems: InventoryListItem[] = products.map((p) => {
    const qty = p.inventory ? p.inventory.quantity : 0;
    const threshold = p.inventory ? p.inventory.lowStockThreshold : 5;
    const status = calculateStockStatus(qty, threshold);

    return {
      id: p.inventory ? p.inventory.id : `virtual-${p.id}`,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      sku: p.sku,
      modelNumber: p.modelNumber,
      mrp: Number(p.mrp),
      sellingPrice: p.sellingPrice != null ? Number(p.sellingPrice) : null,
      brand: p.brand,
      category: p.category,
      quantity: qty,
      lowStockThreshold: threshold,
      stockStatus: status,
      updatedAt: p.inventory ? p.inventory.updatedAt : p.createdAt,
      lastMovement: p.inventoryMovements[0] || null,
    };
  });

  // Calculate overall metrics across all matching products before stock status filtering
  const metrics = {
    totalProducts: allMappedItems.length,
    inStockCount: allMappedItems.filter((i) => i.stockStatus === "IN_STOCK").length,
    lowStockCount: allMappedItems.filter((i) => i.stockStatus === "LOW_STOCK").length,
    outOfStockCount: allMappedItems.filter((i) => i.stockStatus === "OUT_OF_STOCK").length,
    totalUnitsInStock: allMappedItems.reduce((sum, item) => sum + item.quantity, 0),
  };

  // Filter by stockStatus if specified
  let filteredItems = allMappedItems;
  if (stockStatus !== "all") {
    const targetStatus = stockStatus.toUpperCase() as StockStatus;
    filteredItems = allMappedItems.filter((item) => item.stockStatus === targetStatus);
  }

  // Paginate in memory (since stockStatus is computed dynamically)
  const totalCount = filteredItems.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const paginatedItems = filteredItems.slice(skip, skip + limit);

  return {
    items: paginatedItems,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    metrics,
  };
}

// ==============================================================================
// 2. INVENTORY DETAIL & MOVEMENT HISTORY
// ==============================================================================

/**
 * Retrieves full inventory details and historical movements for a specific product.
 */
export async function getInventoryByProductId(
  productId: string
): Promise<InventoryDetailView> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      inventory: true,
      inventoryMovements: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!product) {
    throw new InventoryServiceError("Product not found.", 404);
  }

  // Ensure inventory record exists in database
  let inventory = product.inventory;
  if (!inventory) {
    inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 0,
        lowStockThreshold: 5,
      },
    });
  }

  const stockStatus = calculateStockStatus(
    inventory.quantity,
    inventory.lowStockThreshold
  );

  const movements: InventoryMovementRecord[] = product.inventoryMovements.map((m) => ({
    id: m.id,
    productId: m.productId,
    quantity: m.quantity,
    movementType: m.movementType,
    note: m.note,
    createdById: m.createdById,
    createdByName: m.createdBy?.name || null,
    createdAt: m.createdAt,
  }));

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      modelNumber: product.modelNumber,
      mrp: Number(product.mrp),
      sellingPrice: product.sellingPrice != null ? Number(product.sellingPrice) : null,
      brand: product.brand,
      category: product.category,
    },
    inventory: {
      id: inventory.id,
      quantity: inventory.quantity,
      lowStockThreshold: inventory.lowStockThreshold,
      stockStatus,
      updatedAt: inventory.updatedAt,
    },
    movements,
  };
}

// ==============================================================================
// 3. ATOMIC STOCK MOVEMENTS
// ==============================================================================

/**
 * Records a stock movement (PURCHASE, SALE, DAMAGED, RETURN, ADJUSTMENT) atomically.
 */
export async function recordStockMovement(
  input: StockMovementInput,
  createdById?: string
): Promise<{
  inventory: {
    id: string;
    productId: string;
    quantity: number;
    lowStockThreshold: number;
    stockStatus: StockStatus;
  };
  movement: InventoryMovementRecord;
}> {
  const { productId, movementType, quantity, note } = input;

  return await prisma.$transaction(async (tx) => {
    // 1. Verify product existence
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new InventoryServiceError("Product not found.", 404);
    }

    // 2. Fetch or initialize inventory
    let inventory = await tx.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      inventory = await tx.inventory.create({
        data: {
          productId,
          quantity: 0,
          lowStockThreshold: 5,
        },
      });
    }

    const currentStock = inventory.quantity;
    let delta = 0;
    let newStock = currentStock;

    // 3. Calculate new quantity based on movement type
    switch (movementType) {
      case InventoryMovementType.PURCHASE: {
        const purchaseQty = Math.abs(quantity);
        delta = purchaseQty;
        newStock = currentStock + purchaseQty;
        break;
      }

      case InventoryMovementType.SALE: {
        const saleQty = Math.abs(quantity);
        if (currentStock < saleQty) {
          throw new InventoryServiceError(
            `Not enough stock available. Current stock is ${currentStock} units, but ${saleQty} was requested for sale.`
          );
        }
        delta = -saleQty;
        newStock = currentStock - saleQty;
        break;
      }

      case InventoryMovementType.DAMAGED: {
        const damagedQty = Math.abs(quantity);
        if (currentStock < damagedQty) {
          throw new InventoryServiceError(
            `Damaged quantity (${damagedQty}) cannot exceed current available stock (${currentStock}).`
          );
        }
        delta = -damagedQty;
        newStock = currentStock - damagedQty;
        break;
      }

      case InventoryMovementType.RETURN: {
        const returnQty = Math.abs(quantity);
        delta = returnQty;
        newStock = currentStock + returnQty;
        break;
      }

      case InventoryMovementType.ADJUSTMENT: {
        delta = quantity; // can be positive or negative
        newStock = currentStock + quantity;
        if (newStock < 0) {
          throw new InventoryServiceError(
            `Stock adjustment cannot result in negative stock. Current stock is ${currentStock} units, adjustment of ${quantity} would result in ${newStock}.`
          );
        }
        break;
      }

      default:
        throw new InventoryServiceError("Invalid inventory movement type.");
    }

    // 4. Update inventory quantity
    const updatedInventory = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: newStock,
        updatedAt: new Date(),
      },
    });

    // 5. Create audit movement record
    const createdMovement = await tx.inventoryMovement.create({
      data: {
        productId,
        quantity: delta,
        movementType,
        note: note?.trim() || null,
        createdById: createdById || null,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    const stockStatus = calculateStockStatus(
      updatedInventory.quantity,
      updatedInventory.lowStockThreshold
    );

    return {
      inventory: {
        id: updatedInventory.id,
        productId: updatedInventory.productId,
        quantity: updatedInventory.quantity,
        lowStockThreshold: updatedInventory.lowStockThreshold,
        stockStatus,
      },
      movement: {
        id: createdMovement.id,
        productId: createdMovement.productId,
        quantity: createdMovement.quantity,
        movementType: createdMovement.movementType,
        note: createdMovement.note,
        createdById: createdMovement.createdById,
        createdByName: createdMovement.createdBy?.name || null,
        createdAt: createdMovement.createdAt,
      },
    };
  });
}

// ==============================================================================
// 4. UPDATE LOW STOCK THRESHOLD
// ==============================================================================

/**
 * Updates the low-stock alert threshold for a product.
 */
export async function updateLowStockThreshold(
  input: UpdateLowStockThresholdInput
) {
  const { productId, lowStockThreshold } = input;

  if (lowStockThreshold < 0) {
    throw new InventoryServiceError("Low-stock threshold must be 0 or greater.");
  }

  // Ensure inventory exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new InventoryServiceError("Product not found.", 404);
  }

  const updated = await prisma.inventory.upsert({
    where: { productId },
    create: {
      productId,
      quantity: 0,
      lowStockThreshold,
    },
    update: {
      lowStockThreshold,
      updatedAt: new Date(),
    },
  });

  const stockStatus = calculateStockStatus(updated.quantity, updated.lowStockThreshold);

  return {
    id: updated.id,
    productId: updated.productId,
    quantity: updated.quantity,
    lowStockThreshold: updated.lowStockThreshold,
    stockStatus,
  };
}
