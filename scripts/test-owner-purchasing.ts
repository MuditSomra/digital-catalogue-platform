import { prisma } from "../src/lib/prisma";
import { authenticateAdmin } from "../src/lib/auth-service";
import {
  getProductQuotations,
  createSupplierQuotation,
  updateSupplierQuotation,
  deleteSupplierQuotation,
  createProductWithInitialQuotation,
} from "../src/lib/purchasing-service";
import { verifyOwnerPin } from "../src/lib/pin-service";
import { AdminRole } from "@prisma/client";

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING OWNER ACCOUNT, RBAC & PURCHASING INTEGRATION TESTS");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: OWNER & ADMIN ACCOUNTS & AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log("--- TEST SUITE 1: OWNER & ADMIN ACCOUNTS & AUTHENTICATION ---");

    const ownerAuth = await authenticateAdmin({
      email: "owner@kitchenshowroom.local",
      password: "Owner@Showroom2026!",
    });
    assert(Boolean(ownerAuth.user), "Owner credentials authenticate successfully");
    assert(
      ownerAuth.user.role === AdminRole.OWNER,
      "Owner user has role 'OWNER'",
      `Actual: ${ownerAuth.user.role}`
    );

    const adminAuth = await authenticateAdmin({
      email: "admin@kitchenshowroom.local",
      password: "Admin@Showroom2026!",
    });
    assert(Boolean(adminAuth.user), "Admin credentials authenticate successfully");
    assert(
      adminAuth.user.role === AdminRole.ADMIN,
      "Admin user has role 'ADMIN'",
      `Actual: ${adminAuth.user.role}`
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 2: OWNER SHOWROOM & PIN VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 2: OWNER SHOWROOM & PIN VERIFICATION ---");

    const pinVerified = await verifyOwnerPin("1234");
    assert(pinVerified, "Owner PIN '1234' verifies successfully for dashboard return");

    let pinFailedAsExpected = false;
    try {
      await verifyOwnerPin("9999");
    } catch {
      pinFailedAsExpected = true;
    }
    assert(pinFailedAsExpected, "Incorrect PIN '9999' is properly rejected with 401 error");

    // -------------------------------------------------------------------------
    // TEST SUITE 3: MULTI-CATEGORY PRODUCT & QUOTATION QUERIES
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 3: MULTI-CATEGORY PRODUCT & QUOTATION COMPARISON ---");

    // Retrieve all products with quotes
    const allQuotesRes = await getProductQuotations();
    assert(
      allQuotesRes.groups.length > 0,
      "Purchasing service loads product quotation groups",
      `Found ${allQuotesRes.groups.length} groups`
    );
    assert(
      allQuotesRes.totalQuotations >= 10,
      "Total recorded quotations retrieved correctly",
      `Found ${allQuotesRes.totalQuotations} quotations`
    );

    // Find a multi-category product
    const multiCatProduct = await prisma.product.findFirst({
      where: {
        categories: {
          some: { isPrimary: false },
        },
      },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (multiCatProduct && multiCatProduct.categories.length > 1) {
      const primaryCat = multiCatProduct.categories.find((c) => c.isPrimary);
      const secondaryCat = multiCatProduct.categories.find((c) => !c.isPrimary);

      if (primaryCat && secondaryCat) {
        // Query by primary category
        const primaryRes = await getProductQuotations({ categoryId: primaryCat.categoryId });
        const inPrimary = primaryRes.groups.some((g) => g.product.id === multiCatProduct.id);
        assert(
          inPrimary,
          `Multi-category product '${multiCatProduct.name}' appears under primary category '${primaryCat.category.name}'`
        );

        // Query by secondary category
        const secondaryRes = await getProductQuotations({ categoryId: secondaryCat.categoryId });
        const inSecondary = secondaryRes.groups.some((g) => g.product.id === multiCatProduct.id);
        assert(
          inSecondary,
          `Multi-category product '${multiCatProduct.name}' also appears under secondary category '${secondaryCat.category.name}'`
        );
      }
    } else {
      console.log("[SKIP] Multi-category product check skipped (none found)");
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 4: INVENTORY ISOLATION GUARANTEE
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 4: STRICT INVENTORY ISOLATION VERIFICATION ---");

    // Pick a test product with inventory
    const targetProduct = await prisma.product.findFirst({
      include: {
        inventory: true,
        quotations: true,
      },
    });

    if (!targetProduct || !targetProduct.inventory) {
      throw new Error("No test product with inventory found");
    }

    const initialStock = targetProduct.inventory.quantity;
    const initialMovementsCount = await prisma.inventoryMovement.count({
      where: { productId: targetProduct.id },
    });

    // 1. ADD a new supplier quotation
    const createdQuote = await createSupplierQuotation({
      productId: targetProduct.id,
      supplierName: "Test Wholesale Integration Vendor",
      quotedPrice: 1999,
      quotationDate: new Date(),
      createdById: ownerAuth.user?.id,
      notes: "Test quotation for isolation test",
    });

    const stockAfterAdd = (await prisma.inventory.findUnique({
      where: { id: targetProduct.inventory.id },
    }))?.quantity;
    const movementsAfterAdd = await prisma.inventoryMovement.count({
      where: { productId: targetProduct.id },
    });

    assert(
      stockAfterAdd === initialStock,
      "Adding a quotation DOES NOT change inventory stock level",
      `Stock remained ${initialStock}`
    );
    assert(
      movementsAfterAdd === initialMovementsCount,
      "Adding a quotation DOES NOT create any inventory movement records",
      `Movement count remained ${initialMovementsCount}`
    );

    // 2. EDIT the supplier quotation
    await updateSupplierQuotation(createdQuote.id, {
      quotedPrice: 1850,
      notes: "Updated price quote",
    });

    const stockAfterEdit = (await prisma.inventory.findUnique({
      where: { id: targetProduct.inventory.id },
    }))?.quantity;
    const movementsAfterEdit = await prisma.inventoryMovement.count({
      where: { productId: targetProduct.id },
    });

    assert(
      stockAfterEdit === initialStock,
      "Editing a quotation DOES NOT modify inventory stock level",
      `Stock remained ${initialStock}`
    );
    assert(
      movementsAfterEdit === initialMovementsCount,
      "Editing a quotation DOES NOT create inventory movements"
    );

    // 3. DELETE the supplier quotation
    await deleteSupplierQuotation(createdQuote.id);

    const stockAfterDelete = (await prisma.inventory.findUnique({
      where: { id: targetProduct.inventory.id },
    }))?.quantity;
    const movementsAfterDelete = await prisma.inventoryMovement.count({
      where: { productId: targetProduct.id },
    });

    assert(
      stockAfterDelete === initialStock,
      "Deleting a quotation DOES NOT alter inventory stock level",
      `Stock remained ${initialStock}`
    );
    assert(
      movementsAfterDelete === initialMovementsCount,
      "Deleting a quotation DOES NOT create inventory movements"
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 5: ADD PRODUCT DIRECTLY FROM PURCHASING
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 5: CREATE PRODUCT WITH INITIAL QUOTATION ---");

    const brand = await prisma.brand.findFirst();
    const category = await prisma.category.findFirst({ where: { parentId: { not: null } } }) || await prisma.category.findFirst();

    if (!brand || !category) {
      throw new Error("Brand or Category not found for product creation test");
    }

    const testSku = `TEST-PURCHASE-${Date.now().toString().slice(-5)}`;
    const newProductResult = await createProductWithInitialQuotation({
      name: `Purchasing Test Product ${Date.now().toString().slice(-4)}`,
      sku: testSku,
      brandId: brand.id,
      categoryId: category.id,
      mrp: 15990,
      sellingPrice: 12990,
      warranty: "2 Years",
      initialQuotation: {
        supplierName: "Direct Factory Wholesale Inc",
        quotedPrice: 7500,
        quotationDate: new Date(),
        notes: "Direct factory wholesale quote",
      },
      createdById: ownerAuth.user?.id,
    });

    assert(Boolean(newProductResult.product.id), "Product created directly from Purchasing");
    assert(Boolean(newProductResult.quotation.id), "Initial quotation created and linked to product");
    assert(
      newProductResult.quotation.quotedPrice === 7500,
      "Quotation price saved accurately (₹7,500)"
    );

    // Clean up test product
    await prisma.supplierQuotation.deleteMany({ where: { productId: newProductResult.product.id } });
    await prisma.productCategory.deleteMany({ where: { productId: newProductResult.product.id } });
    await prisma.inventory.deleteMany({ where: { productId: newProductResult.product.id } });
    await prisma.product.delete({ where: { id: newProductResult.product.id } });

    console.log("\n================================================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed with unhandled error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
