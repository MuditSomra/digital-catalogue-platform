import { PrismaClient } from "@prisma/client";
import {
  getCatalogueProducts,
  getCachedPriceRanges,
  invalidateCachedPriceRanges,
  parsePriceCodeNumeric,
} from "../src/lib/catalogue-service";

const prisma = new PrismaClient();

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS ${totalTests}] ${testName}`);
    if (detail) console.log(`     └─ ${detail}`);
  } else {
    console.error(`  ❌ [FAIL ${totalTests}] ${testName}`);
    if (detail) console.error(`     └─ ${detail}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log("============================================================");
  console.log("PRICE CODE & COMPOSITE FILTERING / SORTING VERIFICATION SUITE");
  console.log("============================================================\n");

  try {
    // --------------------------------------------------------------------------
    // 1. UNIT TESTS: parsePriceCodeNumeric helper
    // --------------------------------------------------------------------------
    console.log("--- 1. Unit Tests: parsePriceCodeNumeric helper ---");

    assert(
      parsePriceCodeNumeric("1400+70") === 1470,
      "Composite code '1400+70' calculates sum 1470",
      `Expected: 1470, Got: ${parsePriceCodeNumeric("1400+70")}`
    );

    assert(
      parsePriceCodeNumeric("821+70") === 891,
      "Composite code '821+70' calculates sum 891",
      `Expected: 891, Got: ${parsePriceCodeNumeric("821+70")}`
    );

    assert(
      parsePriceCodeNumeric("1728+79") === 1807,
      "Composite code '1728+79' calculates sum 1807",
      `Expected: 1807, Got: ${parsePriceCodeNumeric("1728+79")}`
    );

    assert(
      parsePriceCodeNumeric("693") === 693,
      "Plain numeric code '693' evaluates to 693",
      `Expected: 693, Got: ${parsePriceCodeNumeric("693")}`
    );

    assert(
      parsePriceCodeNumeric("292") === 292,
      "Plain numeric code '292' evaluates to 292",
      `Expected: 292, Got: ${parsePriceCodeNumeric("292")}`
    );

    assert(
      parsePriceCodeNumeric(" 1400 + 70 ") === 1470,
      "Composite code with whitespace ' 1400 + 70 ' calculates sum 1470",
      `Expected: 1470, Got: ${parsePriceCodeNumeric(" 1400 + 70 ")}`
    );

    assert(
      parsePriceCodeNumeric("100+20+5") === 125,
      "Multi-part composite code '100+20+5' calculates sum 125",
      `Expected: 125, Got: ${parsePriceCodeNumeric("100+20+5")}`
    );

    assert(
      parsePriceCodeNumeric("Na") === null,
      "Invalid code 'Na' returns null safely",
      `Expected: null, Got: ${parsePriceCodeNumeric("Na")}`
    );

    assert(
      parsePriceCodeNumeric("N/A") === null,
      "Invalid code 'N/A' returns null safely",
      `Expected: null, Got: ${parsePriceCodeNumeric("N/A")}`
    );

    assert(
      parsePriceCodeNumeric(null) === null,
      "Null code returns null safely",
      `Expected: null, Got: ${parsePriceCodeNumeric(null)}`
    );

    assert(
      parsePriceCodeNumeric(undefined) === null,
      "Undefined code returns null safely",
      `Expected: null, Got: ${parsePriceCodeNumeric(undefined)}`
    );

    assert(
      parsePriceCodeNumeric("") === null,
      "Empty string code returns null safely",
      `Expected: null, Got: ${parsePriceCodeNumeric("")}`
    );

    assert(
      parsePriceCodeNumeric("invalid_code") === null,
      "Arbitrary string 'invalid_code' returns null safely",
      `Expected: null, Got: ${parsePriceCodeNumeric("invalid_code")}`
    );

    // --------------------------------------------------------------------------
    // 2. DATABASE-SIDE RANGE BOUNDS AGGREGATION
    // --------------------------------------------------------------------------
    console.log("\n--- 2. Database-Side Range Bounds Aggregation ---");
    invalidateCachedPriceRanges();
    const ranges = await getCachedPriceRanges();

    assert(
      ranges.priceCodeRange.min === 292,
      "Global Price Code minimum bound evaluates to 292 database-side",
      `Min price code: ${ranges.priceCodeRange.min}`
    );

    assert(
      ranges.priceCodeRange.max === 1807,
      "Global Price Code maximum bound evaluates to 1807 (1728+79 sum) database-side",
      `Max price code: ${ranges.priceCodeRange.max}`
    );

    assert(
      ranges.sellingPriceRange.min > 0 && ranges.sellingPriceRange.max >= ranges.sellingPriceRange.min,
      "Selling price bounds are calculated via Prisma aggregate independently",
      `Selling range: [${ranges.sellingPriceRange.min}, ${ranges.sellingPriceRange.max}]`
    );

    // --------------------------------------------------------------------------
    // 3. SORTING: ASCENDING ORDER WITH COMPOSITE SUMS
    // --------------------------------------------------------------------------
    console.log("\n--- 3. Sorting: Ascending (price_asc) with Composite Sums ---");
    const ascResult = await getCatalogueProducts({
      minPriceCode: ranges.priceCodeRange.min,
      maxPriceCode: ranges.priceCodeRange.max,
      sortBy: "price_asc",
      limit: 50,
    });

    const ascProducts = ascResult.products;
    const ascParsedValues = ascProducts.map((p) => ({
      name: p.name,
      code: p.privatePriceCode,
      numeric: parsePriceCodeNumeric(p.privatePriceCode),
    }));

    // Find index of first null/non-numeric code
    const firstNullAscIndex = ascParsedValues.findIndex((p) => p.numeric === null);
    const validAsc = ascParsedValues.filter((p) => p.numeric !== null);
    const missingAsc = ascParsedValues.filter((p) => p.numeric === null);

    assert(validAsc.length > 0, "Found valid numeric/composite products in catalogue");
    assert(missingAsc.length > 0, "Found missing/invalid code products in catalogue");
    assert(
      firstNullAscIndex === validAsc.length,
      "All invalid/null price code products appear strictly AFTER all valid numeric products",
      `Valid count: ${validAsc.length}, First missing at index: ${firstNullAscIndex}`
    );

    // Verify strictly ascending order of valid products
    let isStrictlyAscending = true;
    for (let i = 0; i < validAsc.length - 1; i++) {
      if ((validAsc[i].numeric as number) > (validAsc[i + 1].numeric as number)) {
        isStrictlyAscending = false;
        console.error(`Order violation: ${validAsc[i].name} (${validAsc[i].numeric}) > ${validAsc[i + 1].name} (${validAsc[i + 1].numeric})`);
        break;
      }
    }
    assert(isStrictlyAscending, "Valid price codes sort in non-decreasing order by calculated sum");

    // Verify composite codes placement in ascending list
    const p821_70 = ascParsedValues.find((p) => p.code === "821+70");
    const p1400_70 = ascParsedValues.find((p) => p.code === "1400+70");
    const p693 = ascParsedValues.find((p) => p.code === "693");
    const p1214 = ascParsedValues.find((p) => p.code === "1214");

    assert(
      Boolean(p821_70 && p693 && p1214),
      "Test products '821+70', '693', '1214' are present"
    );

    if (p821_70 && p693 && p1214) {
      const idx693 = ascParsedValues.findIndex((p) => p.code === "693");
      const idx821 = ascParsedValues.findIndex((p) => p.code === "821+70");
      const idx1214 = ascParsedValues.findIndex((p) => p.code === "1214");
      assert(
        idx693 < idx821 && idx821 < idx1214,
        "Composite '821+70' (891) is ordered between '693' (693) and '1214' (1214)",
        `Index 693: ${idx693}, Index 821+70: ${idx821}, Index 1214: ${idx1214}`
      );
    }

    if (p1400_70 && p1214) {
      const idx1214 = ascParsedValues.findIndex((p) => p.code === "1214");
      const idx1400 = ascParsedValues.findIndex((p) => p.code === "1400+70");
      assert(
        idx1214 < idx1400,
        "Composite '1400+70' (1470) is ordered after '1214' (1214)",
        `Index 1214: ${idx1214}, Index 1400+70: ${idx1400}`
      );
    }

    // --------------------------------------------------------------------------
    // 4. SORTING: DESCENDING ORDER WITH COMPOSITE SUMS
    // --------------------------------------------------------------------------
    console.log("\n--- 4. Sorting: Descending (price_desc) with Composite Sums ---");
    const descResult = await getCatalogueProducts({
      minPriceCode: ranges.priceCodeRange.min,
      maxPriceCode: ranges.priceCodeRange.max,
      sortBy: "price_desc",
      limit: 50,
    });

    const descParsedValues = descResult.products.map((p) => ({
      name: p.name,
      code: p.privatePriceCode,
      numeric: parsePriceCodeNumeric(p.privatePriceCode),
    }));

    const firstNullDescIndex = descParsedValues.findIndex((p) => p.numeric === null);
    const validDesc = descParsedValues.filter((p) => p.numeric !== null);

    assert(
      firstNullDescIndex === validDesc.length,
      "All invalid/null price code products appear strictly AFTER all valid numeric products in descending sort",
      `Valid count: ${validDesc.length}, First missing at index: ${firstNullDescIndex}`
    );

    let isStrictlyDescending = true;
    for (let i = 0; i < validDesc.length - 1; i++) {
      if ((validDesc[i].numeric as number) < (validDesc[i + 1].numeric as number)) {
        isStrictlyDescending = false;
        console.error(`Order violation: ${validDesc[i].name} (${validDesc[i].numeric}) < ${validDesc[i + 1].name} (${validDesc[i + 1].numeric})`);
        break;
      }
    }
    assert(isStrictlyDescending, "Valid price codes sort in non-increasing order by calculated sum");

    assert(
      descParsedValues[0].code === "1728+79",
      "Top product in price_desc is '1728+79' (1807 sum)",
      `First product: ${descParsedValues[0].name} (code: ${descParsedValues[0].code})`
    );

    // --------------------------------------------------------------------------
    // 5. RANGE BOUNDARIES & OUT-OF-RANGE EXCLUSION
    // --------------------------------------------------------------------------
    console.log("\n--- 5. Range Boundaries & Out-Of-Range Exclusion ---");
    const subRangeResult = await getCatalogueProducts({
      minPriceCode: 800,
      maxPriceCode: 1500,
      sortBy: "price_asc",
      limit: 50,
    });

    const subRangeCodes = subRangeResult.products.map((p) => p.privatePriceCode);
    const subRangeValidParsed = subRangeResult.products
      .map((p) => parsePriceCodeNumeric(p.privatePriceCode))
      .filter((v): v is number => v !== null);

    assert(
      subRangeCodes.includes("821+70"),
      "Composite '821+70' (891) is included in [800, 1500]"
    );
    assert(
      subRangeCodes.includes("1400+70"),
      "Composite '1400+70' (1470) is included in [800, 1500]"
    );
    assert(
      subRangeCodes.includes("1214"),
      "Plain code '1214' is included in [800, 1500]"
    );
    assert(
      !subRangeCodes.includes("693"),
      "Plain code '693' (< 800) is strictly excluded"
    );
    assert(
      !subRangeCodes.includes("292"),
      "Plain code '292' (< 800) is strictly excluded"
    );
    assert(
      !subRangeCodes.includes("1528+70"),
      "Composite code '1528+70' (1598 > 1500) is strictly excluded"
    );
    assert(
      !subRangeCodes.includes("1728+79"),
      "Composite code '1728+79' (1807 > 1500) is strictly excluded"
    );

    const allInBounds = subRangeValidParsed.every((val) => val >= 800 && val <= 1500);
    assert(allInBounds, "Every returned valid numeric price code satisfies 800 <= code <= 1500");

    // Missing products (null and 'Na') should still be present after matching items
    const subRangeMissing = subRangeResult.products.filter(
      (p) => parsePriceCodeNumeric(p.privatePriceCode) === null
    );
    assert(subRangeMissing.length > 0, "Products with missing/invalid codes remain visible after matching results");

    // --------------------------------------------------------------------------
    // 6. PAGINATION & BOUNDARY CROSSING
    // --------------------------------------------------------------------------
    console.log("\n--- 6. Pagination & Boundary Crossing ---");
    const pageSize = 5;
    const page1 = await getCatalogueProducts({
      minPriceCode: ranges.priceCodeRange.min,
      maxPriceCode: ranges.priceCodeRange.max,
      sortBy: "price_desc",
      page: 1,
      limit: pageSize,
    });

    const page2 = await getCatalogueProducts({
      minPriceCode: ranges.priceCodeRange.min,
      maxPriceCode: ranges.priceCodeRange.max,
      sortBy: "price_desc",
      page: 2,
      limit: pageSize,
    });

    const page3 = await getCatalogueProducts({
      minPriceCode: ranges.priceCodeRange.min,
      maxPriceCode: ranges.priceCodeRange.max,
      sortBy: "price_desc",
      page: 3,
      limit: pageSize,
    });

    const page4 = await getCatalogueProducts({
      minPriceCode: ranges.priceCodeRange.min,
      maxPriceCode: ranges.priceCodeRange.max,
      sortBy: "price_desc",
      page: 4,
      limit: pageSize,
    });

    const allPaginatedIds = [
      ...page1.products.map((p) => p.id),
      ...page2.products.map((p) => p.id),
      ...page3.products.map((p) => p.id),
      ...page4.products.map((p) => p.id),
    ];

    const uniqueIds = new Set(allPaginatedIds);
    assert(
      uniqueIds.size === allPaginatedIds.length,
      "Pagination does not produce duplicate products across pages",
      `Total returned: ${allPaginatedIds.length}, Unique IDs: ${uniqueIds.size}`
    );

    assert(
      page1.pagination.totalCount === allPaginatedIds.length,
      "TotalCount equals sum of all paginated items across pages",
      `Reported total: ${page1.pagination.totalCount}, Total items: ${allPaginatedIds.length}`
    );

    // Page 4 contains the last matching item (292) and the first missing items
    const page4Codes = page4.products.map((p) => p.privatePriceCode);
    assert(
      page4Codes.includes("292"),
      "Page 4 contains the lowest matching price code '292'"
    );
    assert(
      page4Codes.includes("Na") || page4Codes.includes(null),
      "Page 4 seamlessly fills remaining slots with missing/null price code items",
      `Page 4 codes: ${JSON.stringify(page4Codes)}`
    );

    // --------------------------------------------------------------------------
    // 7. PRESERVATION OF ORIGINAL STRING VALUES (NO OVERWRITE)
    // --------------------------------------------------------------------------
    console.log("\n--- 7. Preservation of Original privatePriceCode String ---");
    const checkProduct = page1.products.find((p) => p.privatePriceCode === "1728+79");
    assert(
      checkProduct !== undefined && checkProduct.privatePriceCode === "1728+79",
      "Original privatePriceCode string '1728+79' is preserved in product response",
      `Returned privatePriceCode: ${checkProduct?.privatePriceCode}`
    );

    // Check DB directly
    const dbRecord = await prisma.product.findFirst({
      where: { privatePriceCode: "1728+79" },
      select: { privatePriceCode: true },
    });
    assert(
      dbRecord?.privatePriceCode === "1728+79",
      "Database stored privatePriceCode value is unmodified"
    );

    // --------------------------------------------------------------------------
    // 8. SELLING PRICE FILTER & MUTUAL EXCLUSIVITY
    // --------------------------------------------------------------------------
    console.log("\n--- 8. Selling Price Filter & Mutual Exclusivity ---");
    const sellingPriceResult = await getCatalogueProducts({
      minSellingPrice: 2000,
      maxSellingPrice: 6500,
      sortBy: "price_asc",
      limit: 20,
    });

    const sellingMatching = sellingPriceResult.products.filter(
      (p) => p.sellingPrice != null && p.sellingPrice >= 2000 && p.sellingPrice <= 6500
    );
    assert(sellingMatching.length > 0, "Selling price filter successfully matches products in range");

    // Mutual exclusivity check: if minPriceCode is passed, Selling Price is ignored in catalogue-service
    const exclusiveResult = await getCatalogueProducts({
      minPriceCode: 1400,
      maxPriceCode: 1500,
      minSellingPrice: 1000, // Should be ignored because price code is active
      sortBy: "price_asc",
      limit: 20,
    });

    const exclusiveCodes = exclusiveResult.products.map((p) => p.privatePriceCode);
    assert(
      exclusiveCodes.includes("1400+70") && exclusiveCodes.includes("1417+70"),
      "Price Code takes precedence and filters by price code when both are provided"
    );

    // --------------------------------------------------------------------------
    // 9. SINGLE BOUND, EXACT MATCH, AND INVERTED RANGE BOUNDARIES
    // --------------------------------------------------------------------------
    console.log("\n--- 9. Single Bound, Exact Match & Boundary Tests ---");

    // Single bound: Min only
    const minOnlyResult = await getCatalogueProducts({
      minPriceCode: 1500,
      sortBy: "price_asc",
      limit: 20,
    });
    const minOnlyValidCodes = minOnlyResult.products
      .map((p) => parsePriceCodeNumeric(p.privatePriceCode))
      .filter((v): v is number => v !== null);
    assert(
      minOnlyValidCodes.every((c) => c >= 1500),
      "Single bound (minPriceCode: 1500) only includes products with price code >= 1500"
    );

    // Single bound: Max only
    const maxOnlyResult = await getCatalogueProducts({
      maxPriceCode: 500,
      sortBy: "price_asc",
      limit: 20,
    });
    const maxOnlyValidCodes = maxOnlyResult.products
      .map((p) => parsePriceCodeNumeric(p.privatePriceCode))
      .filter((v): v is number => v !== null);
    assert(
      maxOnlyValidCodes.every((c) => c <= 500),
      "Single bound (maxPriceCode: 500) only includes products with price code <= 500"
    );

    // Exact match: Min === Max
    const exactMatchResult = await getCatalogueProducts({
      minPriceCode: 693,
      maxPriceCode: 693,
      sortBy: "price_asc",
      limit: 20,
    });
    const exactMatchCodes = exactMatchResult.products
      .map((p) => p.privatePriceCode)
      .filter((c) => parsePriceCodeNumeric(c) !== null);
    assert(
      exactMatchCodes.length === 1 && exactMatchCodes[0] === "693",
      "Exact match (min: 693, max: 693) returns only product with price code '693'",
      `Returned matching codes: ${JSON.stringify(exactMatchCodes)}`
    );

    // Inverted bounds at database level: min > max produces 0 matching products
    const invertedResult = await getCatalogueProducts({
      minPriceCode: 1500,
      maxPriceCode: 800,
      sortBy: "price_asc",
      limit: 20,
    });
    const invertedMatching = invertedResult.products.filter(
      (p) => parsePriceCodeNumeric(p.privatePriceCode) !== null
    );
    assert(
      invertedMatching.length === 0,
      "Inverted range (min 1500 > max 800) matches 0 products",
      `Matching count: ${invertedMatching.length}`
    );

    console.log("\n============================================================");
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} tests)`);
    console.log("============================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
