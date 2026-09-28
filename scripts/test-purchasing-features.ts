import { prisma } from "../src/lib/prisma";
import { getProductQuotations } from "../src/lib/purchasing-service";

async function runTests() {
  console.log("================================================================================");
  console.log("VERIFYING PURCHASING UPGRADES: SORTING, SPECS, IMAGES & CATEGORY FILTERING");
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

  // 1. Test Lowest Quoted Price Sorting
  const lowestSort = await getProductQuotations({ sortBy: "lowest_price" });
  assert(lowestSort.groups.length > 0, "Returned quotation groups for lowest_price sort");
  let lowestPriceValid = true;
  for (let i = 0; i < lowestSort.groups.length - 1; i++) {
    const current = lowestSort.groups[i].lowestQuotedPrice;
    const next = lowestSort.groups[i + 1].lowestQuotedPrice;
    if (current !== null && next !== null && current > next) {
      lowestPriceValid = false;
      break;
    }
    // nulls should be at the end
    if (current === null && next !== null) {
      lowestPriceValid = false;
      break;
    }
  }
  assert(lowestPriceValid, "Lowest Quoted Price sort orders ascending properly (lowest first)");

  // 2. Test Highest Gross Margin Sorting
  const marginSort = await getProductQuotations({ sortBy: "highest_margin" });
  let marginSortValid = true;
  for (let i = 0; i < marginSort.groups.length - 1; i++) {
    const current = marginSort.groups[i].potentialMarginPercent;
    const next = marginSort.groups[i + 1].potentialMarginPercent;
    if (current !== null && next !== null && current < next) {
      marginSortValid = false;
      break;
    }
    if (current === null && next !== null) {
      marginSortValid = false;
      break;
    }
  }
  assert(marginSortValid, "Highest Gross Margin sort orders descending properly (highest margin % first)");

  // 3. Test Newest Quotation Date Sorting
  const newestSort = await getProductQuotations({ sortBy: "newest" });
  let newestSortValid = true;
  for (let i = 0; i < newestSort.groups.length - 1; i++) {
    const getLatest = (g: any) =>
      g.quotations.length > 0 ? Math.max(...g.quotations.map((q: any) => new Date(q.quotationDate).getTime())) : 0;
    const current = getLatest(newestSort.groups[i]);
    const next = getLatest(newestSort.groups[i + 1]);
    if (current > 0 && next > 0 && current < next) {
      newestSortValid = false;
      break;
    }
    if (current === 0 && next > 0) {
      newestSortValid = false;
      break;
    }
  }
  assert(newestSortValid, "Newest Quotation Date sort orders descending properly (newest quote date first)");

  // 4. Test Supplier Name (A-Z) Sorting
  const supplierSort = await getProductQuotations({ sortBy: "supplier" });
  let supplierSortValid = true;
  for (let i = 0; i < supplierSort.groups.length - 1; i++) {
    const current = supplierSort.groups[i].lowestQuotationSupplier;
    const next = supplierSort.groups[i + 1].lowestQuotationSupplier;
    if (current && next && current.localeCompare(next, undefined, { sensitivity: "base" }) > 0) {
      supplierSortValid = false;
      break;
    }
    if (!current && next) {
      supplierSortValid = false;
      break;
    }
  }
  assert(supplierSortValid, "Supplier Name (A-Z) sort orders ascending alphabetically");

  // 5. Test Product Name (A-Z) Sorting
  const nameSort = await getProductQuotations({ sortBy: "product_name" });
  let nameSortValid = true;
  for (let i = 0; i < nameSort.groups.length - 1; i++) {
    const current = nameSort.groups[i].product.name;
    const next = nameSort.groups[i + 1].product.name;
    if (current.localeCompare(next, undefined, { sensitivity: "base" }) > 0) {
      nameSortValid = false;
      break;
    }
  }
  assert(nameSortValid, "Product Name (A-Z) sort orders ascending alphabetically");

  // 6. Test Product Specifications in Groups
  const productsWithSpecs = lowestSort.groups.filter(
    (g) => g.product.attributeValues && g.product.attributeValues.length > 0
  );
  assert(
    productsWithSpecs.length > 0,
    `Dynamic attribute specifications included in product groups (${productsWithSpecs.length} products with specs)`
  );
  if (productsWithSpecs.length > 0) {
    const sampleSpec = productsWithSpecs[0].product.attributeValues![0];
    console.log(
      `   Sample specification: [${productsWithSpecs[0].product.name}] -> ${sampleSpec.attributeName}: ${sampleSpec.value || sampleSpec.numericValue}`
    );
  }

  // 7. Test Product Images in Groups
  const productsWithImages = lowestSort.groups.filter(
    (g) => g.product.images && g.product.images.length > 0
  );
  assert(
    productsWithImages.length > 0,
    `Product images and primary images included in product groups (${productsWithImages.length} products with images)`
  );

  // 8. Test Multi-category Filtering
  const topCategory = await prisma.category.findFirst({
    where: { parentId: null },
  });
  if (topCategory) {
    const catFiltered = await getProductQuotations({ categoryId: topCategory.id });
    assert(catFiltered.groups.length > 0, `Category filter for top-level "${topCategory.name}" returns products and subcategories`);
    
    // Check no duplicate products in groups
    const productIds = catFiltered.groups.map((g) => g.product.id);
    const uniqueProductIds = new Set(productIds);
    assert(
      productIds.length === uniqueProductIds.size,
      "No duplicate products or groups in category comparison view"
    );
  }

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
