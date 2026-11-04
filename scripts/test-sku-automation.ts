/**
 * Automated Verification Suite for Automatic SKU Generation
 * 
 * Verifies all 10 test scenarios against local testing database (somra_backup_test):
 * 1. New product in Gas Stoves -> GAS-027
 * 2. New product in Chimney -> CHM-016
 * 3. New product in Juicer -> JCR-007
 * 4. New product in a Level 3 category under Juicer -> JCR-008
 * 5. New Level 2 category with prefix VAC -> VAC-001
 * 6. Duplicate prefix rejection
 * 7. Simultaneous product creation without duplicate SKUs (concurrency stress test)
 * 8. Failed product creation rolls back the sequence
 * 9. Existing products retain their original SKUs
 * 10. Category renaming does not affect existing SKUs
 */

// Force connection to local somra_backup_test to protect production
process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/somra_backup_test";
process.env.DIRECT_URL = "postgresql://postgres:password@localhost:5432/somra_backup_test";

async function runTestSuite() {
  const { prisma } = await import("../src/lib/prisma");
  const { createProduct, updateProduct: updateProductService } = await import("../src/lib/product-service");
  const { createCategory, updateCategory, resolveLevel2Category } = await import("../src/lib/category-service");
  const { createProductWithInitialQuotation } = await import("../src/lib/purchasing-service");

  console.log("================================================================================");
  console.log("   AUTOMATIC SKU GENERATION VERIFICATION SUITE");
  console.log("   Database: somra_backup_test (Local)");
  console.log("================================================================================\n");

  const createdProductIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let testCount = 0;
  let passCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`  [PASS] Test ${testCount}: ${testName}${detail ? ` (${detail})` : ""}`);
    } else {
      console.error(`  [FAIL] Test ${testCount}: ${testName}${detail ? ` - Detail: ${detail}` : ""}`);
      throw new Error(`Assertion failed for Test ${testCount}: ${testName}`);
    }
  }

  // Dynamic helper to fetch required category attributes
  async function getRequiredAttributes(categoryId: string) {
    const attrs = await prisma.categoryAttribute.findMany({
      where: { categoryId, isRequired: true },
      include: { predefinedValues: true },
    });
    return attrs.map((a) => ({
      attributeId: a.id,
      attributeValueId: a.predefinedValues[0]?.id || null,
      value: a.predefinedValues[0]?.value || "Standard",
    }));
  }

  try {
    // 0. Setup: fetch standard brand and Level 1 root category
    const brand = await prisma.brand.findFirst();
    if (!brand) throw new Error("No brand found in database");

    const rootCategory = await prisma.category.findFirst({
      where: { parentId: null, name: "Kitchen Appliances" },
    });
    if (!rootCategory) throw new Error("Root category 'Kitchen Appliances' not found");

    // Existing categories
    const gasCat = await prisma.category.findFirst({ where: { skuPrefix: "GAS" } });
    if (!gasCat) throw new Error("Category with prefix GAS not found");

    const chmCat = await prisma.category.findFirst({ where: { skuPrefix: "CHM" } });
    if (!chmCat) throw new Error("Category with prefix CHM not found");

    const jcrCat = await prisma.category.findFirst({ where: { skuPrefix: "JCR" } });
    if (!jcrCat) throw new Error("Category with prefix JCR not found");

    // Ensure exact baseline counters before running scenarios
    await prisma.category.updateMany({ where: { skuPrefix: "GAS" }, data: { skuLastNumber: 26 } });
    await prisma.category.updateMany({ where: { skuPrefix: "CHM" }, data: { skuLastNumber: 15 } });
    await prisma.category.updateMany({ where: { skuPrefix: "JCR" }, data: { skuLastNumber: 6 } });

    // Capture baseline products count and SKUs
    const baselineProducts = await prisma.product.findMany({
      select: { id: true, name: true, sku: true },
    });
    const baselineSkuMap = new Map(baselineProducts.map((p) => [p.id, p.sku]));

    // --------------------------------------------------------------------------
    // Test 1: New product in Gas Stoves -> GAS-027
    // --------------------------------------------------------------------------
    console.log("--- Scenario 1: Gas Stoves Sequential SKU ---");
    const gasAttrs = await getRequiredAttributes(gasCat.id);
    const gasProduct = await createProduct({
      name: "Automated Test Gas Stove 3B",
      brandId: brand.id,
      categoryId: gasCat.id,
      mrp: 5990,
      sellingPrice: 4490,
      attributes: gasAttrs,
    });
    createdProductIds.push(gasProduct.id);
    assert(gasProduct.sku === "GAS-027", "New product in Gas Stoves -> GAS-027", `Got ${gasProduct.sku}`);

    // --------------------------------------------------------------------------
    // Test 2: New product in Chimney -> CHM-016
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 2: Chimney Sequential SKU ---");
    const chmAttrs = await getRequiredAttributes(chmCat.id);
    const chmProduct = await createProduct({
      name: "Automated Test Chimney 60cm",
      brandId: brand.id,
      categoryId: chmCat.id,
      mrp: 14990,
      sellingPrice: 11990,
      attributes: chmAttrs,
    });
    createdProductIds.push(chmProduct.id);
    assert(chmProduct.sku === "CHM-016", "New product in Chimney -> CHM-016", `Got ${chmProduct.sku}`);

    // --------------------------------------------------------------------------
    // Test 3: New product in Juicer -> JCR-007
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 3: Juicer Sequential SKU ---");
    const jcrAttrs = await getRequiredAttributes(jcrCat.id);
    const jcrProduct = await createProduct({
      name: "Automated Test Cold Press Juicer",
      brandId: brand.id,
      categoryId: jcrCat.id,
      mrp: 8990,
      sellingPrice: 6990,
      attributes: jcrAttrs,
    });
    createdProductIds.push(jcrProduct.id);
    assert(jcrProduct.sku === "JCR-007", "New product in Juicer -> JCR-007", `Got ${jcrProduct.sku}`);

    // --------------------------------------------------------------------------
    // Test 4: New product in a Level 3 category under Juicer -> JCR-008
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 4: Level 3 Category under Juicer inherits prefix and sequence ---");
    let level3Juicer = await prisma.category.findFirst({
      where: { parentId: jcrCat.id },
    });
    if (!level3Juicer) {
      level3Juicer = await createCategory({
        name: "Slow Juicers",
        parentId: jcrCat.id,
        isActive: true,
      });
      createdCategoryIds.push(level3Juicer.id);
    }

    const level3Attrs = await getRequiredAttributes(level3Juicer.id);
    const level3Product = await createProduct({
      name: "Automated Test Slow Juicer 200W",
      brandId: brand.id,
      categoryId: level3Juicer.id,
      mrp: 12990,
      sellingPrice: 9990,
      attributes: level3Attrs,
    });
    createdProductIds.push(level3Product.id);
    assert(
      level3Product.sku === "JCR-008",
      "New product in Level 3 category under Juicer -> JCR-008",
      `Got ${level3Product.sku}`
    );

    // Also test purchasing workflow product creation in Level 3 category
    const purchasingResult = await createProductWithInitialQuotation({
      name: "Purchasing Test Citrus Juicer",
      brandId: brand.id,
      categoryId: level3Juicer.id,
      mrp: 4990,
      sellingPrice: 3490,
      initialQuotation: {
        supplierName: "Apex Appliances Ltd",
        quotedPrice: 2200,
        quotationDate: new Date(),
      },
    });
    createdProductIds.push(purchasingResult.product.id);
    assert(
      purchasingResult.product.sku === "JCR-009",
      "Purchasing workflow product in Level 3 category receives next sequential SKU -> JCR-009",
      `Got ${purchasingResult.product.sku}`
    );

    // --------------------------------------------------------------------------
    // Test 5: New Level 2 category with prefix VAC -> VAC-001
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 5: New Level 2 category with prefix VAC ---");
    const vacCategory = await createCategory({
      name: "Automated Vacuum Cleaners",
      parentId: rootCategory.id,
      skuPrefix: "VAC",
      isActive: true,
    });
    createdCategoryIds.push(vacCategory.id);
    assert(
      vacCategory.skuPrefix === "VAC" && vacCategory.skuLastNumber === 0,
      "New Level 2 category initialized with prefix VAC and counter 0",
      `Prefix: ${vacCategory.skuPrefix}, Counter: ${vacCategory.skuLastNumber}`
    );

    const vacProduct = await createProduct({
      name: "Cordless Stick Vacuum Cleaner 400W",
      brandId: brand.id,
      categoryId: vacCategory.id,
      mrp: 18990,
      sellingPrice: 14990,
    });
    createdProductIds.push(vacProduct.id);
    assert(vacProduct.sku === "VAC-001", "First product in VAC category -> VAC-001", `Got ${vacProduct.sku}`);

    // --------------------------------------------------------------------------
    // Test 6: Duplicate prefix rejection
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 6: Duplicate Prefix Rejection ---");
    let duplicateRejected = false;
    try {
      await createCategory({
        name: "Duplicate Gas Stoves Category",
        parentId: rootCategory.id,
        skuPrefix: "GAS", // Existing prefix
        isActive: true,
      });
    } catch (err: any) {
      duplicateRejected = true;
      assert(
        err.message.includes("already used") || err.message.includes("unique"),
        "Duplicate prefix rejected on category creation",
        err.message
      );
    }
    assert(duplicateRejected, "Duplicate prefix rejection on creation succeeded");

    // Also test invalid prefix formats (numbers, lowercase, length < 2 or > 5)
    let invalidFormatRejected = false;
    try {
      await createCategory({
        name: "Invalid Prefix Category",
        parentId: rootCategory.id,
        skuPrefix: "TOOLONGPREFIX",
        isActive: true,
      });
    } catch (err: any) {
      invalidFormatRejected = true;
    }
    assert(invalidFormatRejected, "Invalid prefix length (>5) rejected");

    // --------------------------------------------------------------------------
    // Test 7: Simultaneous product creation without duplicate SKUs (Concurrency)
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 7: Simultaneous Product Creation Concurrency Test ---");
    const CONCURRENCY_COUNT = 6;
    const concurrentPromises = Array.from({ length: CONCURRENCY_COUNT }, (_, i) =>
      createProduct({
        name: `Concurrent Chimney Model ${i + 1}`,
        brandId: brand.id,
        categoryId: chmCat.id,
        mrp: 12000 + i * 500,
        sellingPrice: 10000 + i * 500,
        attributes: chmAttrs,
      })
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    concurrentResults.forEach((p) => createdProductIds.push(p.id));

    const generatedSkus = concurrentResults.map((p) => p.sku);
    const uniqueSkus = new Set(generatedSkus);

    assert(
      uniqueSkus.size === CONCURRENCY_COUNT,
      "All simultaneous product creations received unique SKUs",
      `SKUs: ${generatedSkus.join(", ")}`
    );

    // Verify sequential progression (CHM-017 through CHM-022)
    const expectedSkus = Array.from(
      { length: CONCURRENCY_COUNT },
      (_, i) => `CHM-${String(17 + i).padStart(3, "0")}`
    );
    const sortedGenerated = [...generatedSkus].sort();
    assert(
      JSON.stringify(sortedGenerated) === JSON.stringify(expectedSkus),
      "Simultaneous SKUs formed exact contiguous sequence",
      sortedGenerated.join(", ")
    );

    // --------------------------------------------------------------------------
    // Test 8: Failed product creation rolls back the sequence
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 8: Transaction Rollback on Product Creation Failure ---");
    const categoryBeforeFail = await prisma.category.findUnique({
      where: { id: vacCategory.id },
      select: { skuLastNumber: true },
    });
    const lastNumBefore = categoryBeforeFail?.skuLastNumber ?? 0;

    let transactionFailed = false;
    try {
      // Simulate failure inside transaction with invalid selling price constraint
      await createProduct({
        name: "Failing Product with Invalid Price",
        brandId: brand.id,
        categoryId: vacCategory.id,
        mrp: 5000,
        sellingPrice: 999999, // higher than MRP, violates constraint
      });
    } catch {
      transactionFailed = true;
    }
    assert(transactionFailed, "Invalid product creation threw error as expected");

    const categoryAfterFail = await prisma.category.findUnique({
      where: { id: vacCategory.id },
      select: { skuLastNumber: true },
    });
    const lastNumAfter = categoryAfterFail?.skuLastNumber ?? 0;

    assert(
      lastNumBefore === lastNumAfter,
      "Sequence counter was NOT incremented on transaction failure",
      `Before: ${lastNumBefore}, After: ${lastNumAfter}`
    );

    // Next successful product in VAC should receive VAC-002 (no gap from failed attempt)
    const nextVacProduct = await createProduct({
      name: "Valid Product After Failure",
      brandId: brand.id,
      categoryId: vacCategory.id,
      mrp: 8000,
      sellingPrice: 6000,
    });
    createdProductIds.push(nextVacProduct.id);
    assert(
      nextVacProduct.sku === "VAC-002",
      "Next successful creation gets consecutive sequence without gap -> VAC-002",
      `Got ${nextVacProduct.sku}`
    );

    // --------------------------------------------------------------------------
    // Test 9: Existing products retain original SKUs
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 9: Existing Product SKUs Preserved Exactly ---");
    const existingProductsAfter = await prisma.product.findMany({
      where: { id: { in: Array.from(baselineSkuMap.keys()) } },
      select: { id: true, name: true, sku: true },
    });

    let allBaselinePreserved = true;
    for (const p of existingProductsAfter) {
      const originalSku = baselineSkuMap.get(p.id);
      if (p.sku !== originalSku) {
        allBaselinePreserved = false;
        console.error(`Mismatch on product ${p.name}: was ${originalSku}, now ${p.sku}`);
      }
    }
    assert(
      allBaselinePreserved && existingProductsAfter.length === baselineSkuMap.size,
      `All ${baselineSkuMap.size} baseline products retained their exact original SKUs`
    );

    // --------------------------------------------------------------------------
    // Test 10: Category renaming does not affect existing SKUs or prefixes
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 10: Category Renaming & Prefix Protection ---");
    const originalJcrName = jcrCat.name;
    const renamedCat = await updateCategory(jcrCat.id, {
      name: "Juicers & Cold Press Extractors",
    });
    assert(
      renamedCat.name === "Juicers & Cold Press Extractors" && renamedCat.skuPrefix === "JCR",
      "Category renamed successfully while preserving skuPrefix",
      `Name: ${renamedCat.name}, Prefix: ${renamedCat.skuPrefix}`
    );

    // Verify existing product SKUs under renamed category remain untouched
    const jcrProductsAfterRename = await prisma.product.findMany({
      where: { categoryId: jcrCat.id },
      select: { sku: true },
    });
    assert(
      jcrProductsAfterRename.every((p) => p.sku.startsWith("JCR-")),
      "All product SKUs under renamed category remain intact"
    );

    // Restore original category name
    await updateCategory(jcrCat.id, { name: originalJcrName });

    // Verify prefix change on category with existing SKUs is PREVENTED
    let prefixChangeBlocked = false;
    try {
      await updateCategory(jcrCat.id, { skuPrefix: "EXT" });
    } catch (err: any) {
      prefixChangeBlocked = true;
      assert(
        err.message.includes("Cannot change SKU Prefix") || err.message.includes("already has"),
        "Prevented prefix modification on category with generated SKUs",
        err.message
      );
    }
    assert(prefixChangeBlocked, "Prefix change protection enforced");

    // --------------------------------------------------------------------------
    // Test 11: Client cannot override auto-generated SKU in normal product creation
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 11: Client Cannot Override Auto-Generated SKU ---");
    const overrideAttempt = await createProduct({
      name: "Attempted Client SKU Override Product",
      brandId: brand.id,
      categoryId: gasCat.id,
      mrp: 5990,
      sellingPrice: 4490,
      sku: "MANUAL-999", // Attempted client override
      attributes: gasAttrs,
    });
    createdProductIds.push(overrideAttempt.id);
    assert(
      overrideAttempt.sku.startsWith("GAS-"),
      "Client attempted SKU override was ignored in favor of server-generated SKU",
      `Got ${overrideAttempt.sku} instead of MANUAL-999`
    );

    // --------------------------------------------------------------------------
    // Test 12: Existing product SKU is immutable during update
    // --------------------------------------------------------------------------
    console.log("\n--- Scenario 12: Existing Product SKU is Immutable During Update ---");
    const originalSku = overrideAttempt.sku;
    await updateProductService(overrideAttempt.id, {
      name: "Renamed Product During Update",
      sku: "ALTERED-SKU", // Attempted modification
    });
    const refreshedProduct = await prisma.product.findUnique({
      where: { id: overrideAttempt.id },
      select: { name: true, sku: true },
    });
    assert(
      refreshedProduct?.name === "Renamed Product During Update" && refreshedProduct?.sku === originalSku,
      "Product name was updated but SKU remained strictly immutable",
      `SKU: ${refreshedProduct?.sku}`
    );

  } finally {
    // --------------------------------------------------------------------------
    // Clean up all test artifacts
    // --------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log("   CLEANING UP TEST RECORDS");
    console.log("================================================================================");
    const { prisma } = await import("../src/lib/prisma");

    if (createdProductIds.length > 0) {
      // Delete quote items first if created
      await prisma.supplierQuotation.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.productAttributeValue.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.productCategory.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.inventory.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
      console.log(`- Cleaned up ${createdProductIds.length} test products`);
    }

    if (createdCategoryIds.length > 0) {
      await prisma.category.deleteMany({
        where: { id: { in: createdCategoryIds } },
      });
      console.log(`- Cleaned up ${createdCategoryIds.length} test categories`);
    }

    // Reset Gas, Chimney, Juicer counters back to their original maximum sequence numbers
    const gasMax = await prisma.product.findMany({
      where: { sku: { startsWith: "GAS-" } },
      select: { sku: true },
    });
    const maxGas = Math.max(0, ...gasMax.map((p) => parseInt(p.sku.split("-")[1], 10) || 0));
    await prisma.category.updateMany({
      where: { skuPrefix: "GAS" },
      data: { skuLastNumber: maxGas },
    });

    const chmMax = await prisma.product.findMany({
      where: { sku: { startsWith: "CHM-" } },
      select: { sku: true },
    });
    const maxChm = Math.max(0, ...chmMax.map((p) => parseInt(p.sku.split("-")[1], 10) || 0));
    await prisma.category.updateMany({
      where: { skuPrefix: "CHM" },
      data: { skuLastNumber: maxChm },
    });

    const jcrMax = await prisma.product.findMany({
      where: { sku: { startsWith: "JCR-" } },
      select: { sku: true },
    });
    const maxJcr = Math.max(0, ...jcrMax.map((p) => parseInt(p.sku.split("-")[1], 10) || 0));
    await prisma.category.updateMany({
      where: { skuPrefix: "JCR" },
      data: { skuLastNumber: maxJcr },
    });

    console.log(`- Restored counters: GAS=${maxGas}, CHM=${maxChm}, JCR=${maxJcr}`);
    await prisma.$disconnect();
  }

  console.log("\n================================================================================");
  console.log(`   TEST SUITE SUMMARY: ${passCount} / ${testCount} PASSED`);
  console.log("================================================================================\n");

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
