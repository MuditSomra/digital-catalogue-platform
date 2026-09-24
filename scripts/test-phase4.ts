import { prisma } from "../src/lib/prisma";
import {
  getInventoryList,
  getInventoryByProductId,
  recordStockMovement,
  updateLowStockThreshold,
  calculateStockStatus,
  InventoryServiceError,
} from "../src/lib/inventory-service";
import {
  stockMovementInputSchema,
  updateLowStockThresholdSchema,
} from "../src/validations/inventory";
import { InventoryMovementType } from "@prisma/client";

async function runPhase4Tests() {
  console.log("============================================================");
  console.log("🧪 RUNNING PHASE 4 AUTOMATED TESTS: INVENTORY & STOCK MANAGEMENT");
  console.log("============================================================\n");

  let testCount = 0;
  let passCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`✅ [TEST ${testCount}] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
    } else {
      console.error(`❌ [TEST ${testCount}] FAILED: ${testName}`);
      if (detail) console.error(`   └─ Details: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // Pure function unit tests for Stock Status logic
  assert(
    calculateStockStatus(0, 5) === "OUT_OF_STOCK" && calculateStockStatus(-2, 5) === "OUT_OF_STOCK",
    "Stock Status: Out of Stock",
    "Quantity = 0 with threshold 5 => OUT_OF_STOCK"
  );
  assert(
    calculateStockStatus(3, 5) === "LOW_STOCK" && calculateStockStatus(5, 5) === "LOW_STOCK",
    "Stock Status: Low Stock Alert",
    "Quantity = 3 (<= 5) => LOW_STOCK"
  );
  assert(
    calculateStockStatus(6, 5) === "IN_STOCK" && calculateStockStatus(50, 5) === "IN_STOCK",
    "Stock Status: In Stock",
    "Quantity = 6 (> 5) => IN_STOCK"
  );

  // Setup: Find or create a test product
  const gasStovesCat = await prisma.category.findFirst({
    where: { name: "Gas Stoves" },
  });
  if (!gasStovesCat) throw new Error("Gas Stoves category not found");

  const brand = await prisma.brand.findFirst();
  if (!brand) throw new Error("Brand not found");

  const testSku = `TEST-INV-${Date.now()}`;
  const testProduct = await prisma.product.create({
    data: {
      name: "Phase 4 Inventory Test Cooktop",
      slug: `phase4-inv-test-${Date.now()}`,
      sku: testSku,
      modelNumber: "INV-MOD-101",
      mrp: 8000,
      sellingPrice: 6400,
      brandId: brand.id,
      categoryId: gasStovesCat.id,
      isActive: true,
    },
  });

  // 1. Initial Inventory Retrieval & Auto-initialization
  const initialDetail = await getInventoryByProductId(testProduct.id);
  assert(
    initialDetail.inventory.quantity === 0 &&
      initialDetail.inventory.lowStockThreshold === 5 &&
      initialDetail.inventory.stockStatus === "OUT_OF_STOCK",
    "Inventory Auto-initialization & Retrieval",
    `Initialized product with Quantity: 0, Threshold: 5, Status: OUT_OF_STOCK`
  );

  // 2. Purchase / Add Stock
  const purchaseResult = await recordStockMovement({
    productId: testProduct.id,
    movementType: InventoryMovementType.PURCHASE,
    quantity: 20,
    note: "Initial bulk distributor purchase",
  });
  assert(
    purchaseResult.inventory.quantity === 20 &&
      purchaseResult.inventory.stockStatus === "IN_STOCK" &&
      purchaseResult.movement.movementType === InventoryMovementType.PURCHASE &&
      purchaseResult.movement.quantity === 20,
    "Purchase Increases Stock",
    `Purchased 20 units => New Stock: ${purchaseResult.inventory.quantity} (Status: IN_STOCK)`
  );

  // 3. Customer Sale Decreases Stock
  const saleResult = await recordStockMovement({
    productId: testProduct.id,
    movementType: InventoryMovementType.SALE,
    quantity: 6,
    note: "Customer walk-in showroom sale",
  });
  assert(
    saleResult.inventory.quantity === 14 &&
      saleResult.movement.movementType === InventoryMovementType.SALE &&
      saleResult.movement.quantity === -6,
    "Sale Decreases Stock",
    `Sold 6 units => New Stock: ${saleResult.inventory.quantity} units (Delta: -6)`
  );

  // 4. Sale Greater Than Available Stock Rejected
  let overSaleCaught = false;
  try {
    await recordStockMovement({
      productId: testProduct.id,
      movementType: InventoryMovementType.SALE,
      quantity: 50, // Only 14 in stock!
      note: "Attempting to sell more than in stock",
    });
  } catch (err: any) {
    if (err instanceof InventoryServiceError && err.message.includes("Not enough stock")) {
      overSaleCaught = true;
    }
  }
  assert(
    overSaleCaught,
    "Sale Exceeding Stock Rejected",
    "Attempt to sell 50 units when only 14 available was safely rejected"
  );

  // 5. Damaged Stock Deducted
  const damagedResult = await recordStockMovement({
    productId: testProduct.id,
    movementType: InventoryMovementType.DAMAGED,
    quantity: 2,
    note: "Dented frame during handling",
  });
  assert(
    damagedResult.inventory.quantity === 12 &&
      damagedResult.movement.movementType === InventoryMovementType.DAMAGED &&
      damagedResult.movement.quantity === -2,
    "Damaged Stock Deducted",
    `Damaged 2 units => New Stock: ${damagedResult.inventory.quantity} units`
  );

  // 6. Damaged Quantity Exceeding Stock Rejected
  let overDamageCaught = false;
  try {
    await recordStockMovement({
      productId: testProduct.id,
      movementType: InventoryMovementType.DAMAGED,
      quantity: 20, // Only 12 in stock
    });
  } catch (err: any) {
    if (err instanceof InventoryServiceError && err.message.includes("cannot exceed")) {
      overDamageCaught = true;
    }
  }
  assert(
    overDamageCaught,
    "Excess Damaged Quantity Rejected",
    "Damaged deduction greater than stock was safely rejected"
  );

  // 7. Customer Return Increases Stock
  const returnResult = await recordStockMovement({
    productId: testProduct.id,
    movementType: InventoryMovementType.RETURN,
    quantity: 1,
    note: "Customer exchanged for larger stove",
  });
  assert(
    returnResult.inventory.quantity === 13 &&
      returnResult.movement.movementType === InventoryMovementType.RETURN &&
      returnResult.movement.quantity === 1,
    "Customer Return Increases Stock",
    `Returned 1 unit => New Stock: ${returnResult.inventory.quantity} units`
  );

  // 8. Positive Stock Adjustment
  const posAdjResult = await recordStockMovement({
    productId: testProduct.id,
    movementType: InventoryMovementType.ADJUSTMENT,
    quantity: 2,
    note: "Stock audit found extra boxed unit",
  });
  assert(
    posAdjResult.inventory.quantity === 15 && posAdjResult.movement.quantity === 2,
    "Positive Stock Adjustment",
    `Adjusted +2 units => New Stock: ${posAdjResult.inventory.quantity}`
  );

  // 9. Negative Stock Adjustment
  const negAdjResult = await recordStockMovement({
    productId: testProduct.id,
    movementType: InventoryMovementType.ADJUSTMENT,
    quantity: -12, // 15 - 12 = 3 (triggers LOW STOCK since threshold is 5)
    note: "Warehouse count adjustment",
  });
  assert(
    negAdjResult.inventory.quantity === 3 &&
      negAdjResult.inventory.stockStatus === "LOW_STOCK" &&
      negAdjResult.movement.quantity === -12,
    "Negative Stock Adjustment & Low Stock Transition",
    `Adjusted -12 units => New Stock: 3 units (Threshold: 5 => Status: LOW_STOCK)`
  );

  // 10. Adjustment Resulting in Negative Stock Rejected
  let negAdjOverCaught = false;
  try {
    await recordStockMovement({
      productId: testProduct.id,
      movementType: InventoryMovementType.ADJUSTMENT,
      quantity: -10, // Stock is only 3!
    });
  } catch (err: any) {
    if (err instanceof InventoryServiceError && err.message.includes("negative stock")) {
      negAdjOverCaught = true;
    }
  }
  assert(
    negAdjOverCaught,
    "Negative Stock Prevented",
    "Adjustment that would result in -7 units rejected"
  );

  // 11. Update Low Stock Threshold
  const updatedThreshold = await updateLowStockThreshold({
    productId: testProduct.id,
    lowStockThreshold: 2,
  });
  assert(
    updatedThreshold.lowStockThreshold === 2 &&
      updatedThreshold.stockStatus === "IN_STOCK",
    "Low-Stock Threshold Configured & Status Recalculated",
    `Changed threshold from 5 to 2 (Stock is 3 > 2 => Status changed to IN_STOCK)`
  );

  // 12. Complete Movement Audit Trail Verification
  const auditDetail = await getInventoryByProductId(testProduct.id);
  assert(
    auditDetail.movements.length === 6,
    "Audit Trail Preserves All Movement Records",
    `Found all 6 sequential movements in history (Purchase, Sale, Damaged, Return, Adj+, Adj-)`
  );

  // 13. Inventory List & Search
  const searchResult = await getInventoryList({
    search: testSku,
  });
  assert(
    searchResult.items.length === 1 && searchResult.items[0].productId === testProduct.id,
    "Inventory Search by SKU",
    `Found inventory item matching SKU ${testSku}`
  );

  // 14. Stock Status Filter
  const inStockFilter = await getInventoryList({
    stockStatus: "in_stock",
  });
  assert(
    inStockFilter.items.every((i) => i.stockStatus === "IN_STOCK"),
    "Stock Status Filter: In Stock",
    `Returned ${inStockFilter.items.length} items, all verified IN_STOCK`
  );

  // 15. Combined Multi-Filters (Brand + Category + Stock Status)
  const combinedFilter = await getInventoryList({
    brandId: brand.id,
    categoryId: gasStovesCat.id,
    stockStatus: "in_stock",
  });
  assert(
    combinedFilter.items.every(
      (i) => i.brand.id === brand.id && i.category.id === gasStovesCat.id && i.stockStatus === "IN_STOCK"
    ),
    "Combined Filters: Brand + Category + Stock Status",
    `Returned ${combinedFilter.items.length} matching inventory records`
  );

  // 16. Pagination
  const paginated = await getInventoryList({
    limit: 2,
    page: 1,
  });
  assert(
    paginated.items.length <= 2 &&
      paginated.pagination.page === 1 &&
      paginated.pagination.limit === 2 &&
      paginated.pagination.totalCount >= 1,
    "Inventory Pagination",
    `Page 1 of ${paginated.pagination.totalPages} (Total items: ${paginated.pagination.totalCount})`
  );

  // 17. Validation Schemas Prevent Invalid Inputs
  let zeroQtyCaught = false;
  try {
    stockMovementInputSchema.parse({
      productId: testProduct.id,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 0,
    });
  } catch (err) {
    zeroQtyCaught = true;
  }
  assert(zeroQtyCaught, "Validation: Zero Quantity Rejected", "Quantity = 0 rejected by schema");

  let negPurchaseCaught = false;
  try {
    stockMovementInputSchema.parse({
      productId: testProduct.id,
      movementType: InventoryMovementType.PURCHASE,
      quantity: -5,
    });
  } catch (err) {
    negPurchaseCaught = true;
  }
  assert(
    negPurchaseCaught,
    "Validation: Negative Purchase Quantity Rejected",
    "Negative purchase quantity rejected by schema"
  );

  // 18. Quick Action Identifier Resolution & Flow Verification (Different Products)
  // Simulate Quick Action flow where item is InventoryListItem (id = inventoryId, productId = productId)
  const inventoryListItemMock = {
    id: "inv-record-id-123",
    productId: testProduct.id,
    productName: testProduct.name,
    sku: testProduct.sku,
  };
  const resolvedQuickProductId =
    "productId" in inventoryListItemMock && inventoryListItemMock.productId
      ? inventoryListItemMock.productId
      : (inventoryListItemMock as any).id;

  const quickActionPurchase = await recordStockMovement({
    productId: resolvedQuickProductId,
    movementType: InventoryMovementType.PURCHASE,
    quantity: 5,
    note: "Quick Action +Stock purchase test",
  });
  assert(
    resolvedQuickProductId === testProduct.id &&
      quickActionPurchase.inventory.quantity === 8, // was 3 after adjustments, now + 5 = 8
    "Quick Action +Stock Identifier Resolution",
    `Quick Action correctly resolved productId: ${resolvedQuickProductId} and updated stock to 8`
  );

  const quickActionSale = await recordStockMovement({
    productId: resolvedQuickProductId,
    movementType: InventoryMovementType.SALE,
    quantity: 2,
    note: "Quick Action Sale test",
  });
  assert(
    quickActionSale.inventory.quantity === 6,
    "Quick Action Sale Identifier Resolution",
    `Quick Action correctly executed sale and updated stock to 6`
  );

  // 19. Cleanup Test Product
  await prisma.inventoryMovement.deleteMany({ where: { productId: testProduct.id } });
  await prisma.inventory.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  assert(true, "Safe Cleanup of Test Inventory Records", "Test product and inventory movements cleaned up");

  // 19. Multi-attribute filter regression test
  console.log("\n------------------------------------------------------------");
  console.log("🔍 RUNNING FILTER REGRESSION TEST (Phase 1 Baseline)");
  console.log("Filter: Burner Count = 3 AND Cooktop Material = Stainless Steel AND Ignition = Automatic");
  console.log("------------------------------------------------------------");

  const matchingProducts = await prisma.product.findMany({
    where: {
      AND: [
        {
          attributeValues: {
            some: {
              attribute: { slug: "burner-count" },
              value: "3",
            },
          },
        },
        {
          attributeValues: {
            some: {
              attribute: { slug: "cooktop-material" },
              value: "Stainless Steel",
            },
          },
        },
        {
          attributeValues: {
            some: {
              attribute: { slug: "ignition" },
              value: "Automatic",
            },
          },
        },
      ],
    },
    include: {
      brand: true,
      category: true,
    },
  });

  assert(
    matchingProducts.length === 2,
    "Multi-Attribute Filter Regression",
    `Returned ${matchingProducts.length} matching products: ${matchingProducts.map((p) => p.name).join(", ")}`
  );

  console.log("\n============================================================");
  console.log(`🎉 ALL ${passCount} PHASE 4 TESTS PASSED SUCCESSFULLY! (100% Pass Rate)`);
  console.log("============================================================\n");
}

runPhase4Tests()
  .catch((err) => {
    console.error("Phase 4 tests failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
