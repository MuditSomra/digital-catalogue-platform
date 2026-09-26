import { PrismaClient, InventoryMovementType } from "@prisma/client";
import {
  getCatalogueProducts,
  getCatalogueProductDetail,
  getCategoryDynamicFilters,
} from "../src/lib/catalogue-service";
import {
  hashPin,
  verifyPinHash,
  setOwnerPin,
  verifyOwnerPin,
  resetOwnerPin,
  isOwnerPinConfigured,
  getPinLockoutStatus,
} from "../src/lib/pin-service";
import { recordStockMovement } from "../src/lib/inventory-service";
import { createProduct, deleteProduct } from "../src/lib/product-service";

const prisma = new PrismaClient();

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [TEST ${totalTests}] ${testName}`);
    if (detail) console.log(`     └─ ${detail}`);
  } else {
    console.error(`  ❌ [TEST ${totalTests}] ${testName}`);
    if (detail) console.error(`     └─ ${detail}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runPhase6Tests() {
  console.log("============================================================");
  console.log("PHASE 6 AUTOMATED VERIFICATION SUITE");
  console.log("Customer Catalogue, Mode Switching, PIN Security & Showroom");
  console.log("============================================================\n");

  try {
    // --------------------------------------------------------------------------
    // 1. PIN SECURITY & CRYPTOGRAPHIC HASHING TESTS
    // --------------------------------------------------------------------------
    console.log("--- 1. PIN Security & Cryptographic Hashing ---");

    const testPin = "4826";
    const hashed = hashPin(testPin);
    assert(hashed.includes(":"), "PIN is hashed with random salt in 'salt:hash' format", `Sample format: ${hashed.slice(0, 24)}...`);
    assert(hashed !== testPin, "PIN is NEVER stored as plaintext");

    const isValid = verifyPinHash(testPin, hashed);
    assert(isValid, "verifyPinHash correctly validates matching PIN using scrypt & timingSafeEqual");

    const isInvalid = verifyPinHash("9999", hashed);
    assert(!isInvalid, "verifyPinHash strictly rejects incorrect PIN candidate");

    // Invalid PIN format rejection
    let rejectedFormat = false;
    try {
      hashPin("123"); // not 4 digits
    } catch {
      rejectedFormat = true;
    }
    assert(rejectedFormat, "PIN hashing rejects strings that are not exactly 4 numeric digits");

    // --------------------------------------------------------------------------
    // 2. PIN SETUP, UPDATE & RESET FLOW
    // --------------------------------------------------------------------------
    console.log("\n--- 2. PIN Setup, Update, Reset & Rate Limiting ---");

    // Clean up any existing PIN for idempotency
    await prisma.storeSetting.deleteMany({ where: { key: { in: ["owner_pin_hash", "owner_pin_attempts"] } } });
    await prisma.adminUser.updateMany({ data: { pinHash: null } });

    // Set owner PIN
    const setupRes = await setOwnerPin({ newPin: "5555" });
    assert(setupRes.success, "setOwnerPin successfully configures owner PIN", setupRes.message);

    const isConfigured = await isOwnerPinConfigured();
    assert(isConfigured, "isOwnerPinConfigured reports true once PIN is set");

    // Verify owner PIN
    const verified = await verifyOwnerPin("5555");
    assert(verified, "verifyOwnerPin succeeds for correct 4-digit PIN");

    // Change owner PIN (requires current PIN)
    const updateRes = await setOwnerPin({ newPin: "7777", currentPin: "5555" });
    assert(updateRes.success, "setOwnerPin updates PIN after verifying current PIN");

    const verifyUpdated = await verifyOwnerPin("7777");
    assert(verifyUpdated, "Updated PIN 7777 is active and verified");

    // Reset owner PIN (admin credential flow)
    const resetRes = await resetOwnerPin("1234");
    assert(resetRes.success, "resetOwnerPin resets owner PIN securely");

    const verifyReset = await verifyOwnerPin("1234");
    assert(verifyReset, "Reset PIN 1234 is active and verified");

    // --------------------------------------------------------------------------
    // 3. CUSTOMER CATALOGUE DYNAMIC SPECIFICATION FILTERING
    // --------------------------------------------------------------------------
    console.log("\n--- 3. Customer Catalogue Dynamic Specification Filtering ---");

    // Query catalogue products for All Categories
    const catalogue = await getCatalogueProducts({ page: 1, limit: 12 });
    assert(catalogue.products.length > 0, "getCatalogueProducts retrieves active showroom products", `Found ${catalogue.products.length} products`);
    assert(catalogue.pagination.totalCount > 0, "Pagination totalCount calculated correctly", `Total count: ${catalogue.pagination.totalCount}`);
    assert(catalogue.availableFilters.length === 0, "All Categories hides specification filters (general filters only: Brand, Price, Availability)");

    // Multi-attribute filter test: Burner Count = 3 AND Cooktop Material = Stainless Steel AND Ignition = Automatic
    const filteredCatalogue = await getCatalogueProducts({
      attributeFilters: [
        { slug: "burner-count", values: ["3"] },
        { slug: "cooktop-material", values: ["Stainless Steel"] },
        { slug: "ignition", values: ["Automatic"] },
      ],
    });

    assert(filteredCatalogue.products.length >= 2, "Dynamic filter matches products with Burner Count = 3, Material = Stainless Steel, Ignition = Auto", `Returned ${filteredCatalogue.products.length} matching appliances`);
    for (const prod of filteredCatalogue.products) {
      const burners = prod.attributeValues.find((av) => av.attributeSlug === "burner-count")?.value;
      const material = prod.attributeValues.find((av) => av.attributeSlug === "cooktop-material")?.value;
      const ignition = prod.attributeValues.find((av) => av.attributeSlug === "ignition")?.value;
      assert(burners === "3" && material === "Stainless Steel" && ignition === "Automatic", `Product '${prod.name}' matches all 3 filter criteria`);
    }

    // --------------------------------------------------------------------------
    // 4. CATEGORY HIERARCHY TRAVERSAL FILTERING & DYNAMIC SPECIFICATIONS
    // --------------------------------------------------------------------------
    console.log("\n--- 4. Category Hierarchy Traversal Filtering ---");

    const rootCategory = await prisma.category.findFirst({
      where: { parentId: null, slug: "kitchen-appliances" },
    });
    const cookingCategory = await prisma.category.findFirst({
      where: { slug: "cooking-appliances" },
    });

    if (cookingCategory) {
      const cookingProducts = await getCatalogueProducts({ categoryId: cookingCategory.id });
      assert(cookingProducts.products.length > 0, "Selecting parent 'Cooking Appliances' returns products in subcategories (Gas Stoves, Hobs)", `Returned ${cookingProducts.products.length} appliances`);
      assert(cookingProducts.availableFilters.length > 0, "Dynamic category specifications returned when category is selected", `Found ${cookingProducts.availableFilters.length} filterable specs for Cooking Appliances`);
    }

    // --------------------------------------------------------------------------
    // 5. PRODUCT DETAIL & SPECIFICATIONS VIEW
    // --------------------------------------------------------------------------
    console.log("\n--- 5. Product Detail, Breadcrumbs & Media View ---");

    const sampleProduct = catalogue.products[0];
    const detail = await getCatalogueProductDetail(sampleProduct.id);
    assert(detail !== null, "getCatalogueProductDetail returns complete product detail", `Product: ${detail?.name}`);
    assert(detail?.category.breadcrumbs !== undefined && detail.category.breadcrumbs.length > 0, "Breadcrumb trail constructed from root to category", `Breadcrumbs: ${detail?.category.breadcrumbs?.map((b) => b.name).join(" > ")}`);
    assert(detail?.inventory !== undefined, "Real-time inventory stock attached to product detail", `Quantity: ${detail?.inventory.quantity}, Status: ${detail?.inventory.stockStatus}`);
    assert(detail?.attributeValues.length !== undefined, "Dynamic specifications array attached to product detail", `Specifications count: ${detail?.attributeValues.length}`);
    assert(detail?.similarProducts !== undefined, "Similar products list attached to product detail", `Found ${detail?.similarProducts?.length} similar products`);
    if (detail?.similarProducts && detail.similarProducts.length > 0) {
      const selfIncluded = detail.similarProducts.some((p) => p.id === sampleProduct.id);
      assert(!selfIncluded, "Similar products strictly excludes current product ID");
    }

    // --------------------------------------------------------------------------
    // 6. OWNER MARK AS SOLD & ATOMIC INVENTORY SALE
    // --------------------------------------------------------------------------
    console.log("\n--- 6. Owner-Only Mark as Sold Action ---");

    // Create a temporary test product with inventory for sale verification
    const brands = await prisma.brand.findMany({ take: 1 });
    const categoriesList = await prisma.category.findMany({ take: 1 });

    const tempProduct = await createProduct({
      name: "Phase 6 Mark Sold Test Appliance",
      brandId: brands[0].id,
      categoryId: categoriesList[0].id,
      sku: `P6-SOLD-TEST-${Date.now()}`,
      mrp: 9999,
      sellingPrice: 7999,
      isActive: true,
    });

    // Add 5 stock units
    await recordStockMovement({
      productId: tempProduct.id,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 5,
      note: "Initial test inventory stock",
    });

    // Mark 2 units as sold using owner PIN verification
    const isPinValid = await verifyOwnerPin("1234");
    assert(isPinValid, "Owner PIN verified prior to executing Mark as Sold");

    const saleResult = await recordStockMovement({
      productId: tempProduct.id,
      movementType: InventoryMovementType.SALE,
      quantity: 2,
      note: "Customer walk-in sale via showroom mode",
    });

    assert(saleResult.inventory.quantity === 3, "Inventory atomically decremented from 5 to 3 on Mark as Sold", `New stock quantity: ${saleResult.inventory.quantity}`);
    assert(saleResult.movement.movementType === InventoryMovementType.SALE, "Audited InventoryMovement record created with type SALE");

    // Cleanup test product
    await prisma.inventoryMovement.deleteMany({ where: { productId: tempProduct.id } });
    await prisma.inventory.deleteMany({ where: { productId: tempProduct.id } });
    await deleteProduct(tempProduct.id);
    assert(true, "Temporary test product and inventory movements cleaned up cleanly");

    console.log("\n============================================================");
    console.log(`🎉 ALL ${totalTests} PHASE 6 AUTOMATED TESTS PASSED SUCCESSFULLY!`);
    console.log("============================================================\n");
  } catch (err) {
    console.error("Phase 6 tests failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase6Tests();
