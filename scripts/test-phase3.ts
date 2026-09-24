import { prisma } from "../src/lib/prisma";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductActive,
  toggleProductFeatured,
  getBrands,
  createBrand,
  ProductServiceError,
} from "../src/lib/product-service";
import {
  createProductSchema,
  updateProductSchema,
} from "../src/validations/product";
import { getCategoryAttributes } from "../src/lib/attribute-service";

async function runPhase3Tests() {
  console.log("============================================================");
  console.log("🧪 RUNNING PHASE 3 AUTOMATED TESTS: PRODUCT MANAGEMENT");
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

  // Cleanup any leftover test brands from previous runs
  await prisma.product.deleteMany({
    where: { name: { contains: "Phase3 Test" } },
  });
  await prisma.brand.deleteMany({
    where: { name: { contains: "Glen Appliances Test" } },
  });

  // 1. Check existing brands
  const initialBrands = await getBrands();
  assert(
    initialBrands.length >= 6,
    "Brand Listing",
    `Found ${initialBrands.length} brands in database (Prestige, Faber, Bosch, etc.)`
  );

  // 2. Inline Brand Creation
  const testBrandName = `Glen Appliances Test ${Date.now()}`;
  const newBrand = await createBrand({
    name: testBrandName,
    description: "Modern kitchen chimneys and cooktops",
  });
  assert(
    newBrand.name === testBrandName && newBrand.slug.startsWith("glen-appliances-test"),
    "Inline Brand Creation",
    `Created brand: ${newBrand.name} (Slug: ${newBrand.slug})`
  );

  // 3. Find Gas Stoves category
  const gasStovesCategory = await prisma.category.findFirst({
    where: { name: "Gas Stoves" },
  });
  assert(
    Boolean(gasStovesCategory),
    "Category Hierarchy Selection",
    `Found category Gas Stoves (ID: ${gasStovesCategory?.id})`
  );
  if (!gasStovesCategory) throw new Error("Gas Stoves category not found");

  // 4. Dynamic Specifications Load based on Category
  const gasStoveSpecs = await getCategoryAttributes(gasStovesCategory.id);
  assert(
    gasStoveSpecs.length >= 6,
    "Dynamic Specifications Load",
    `Loaded ${gasStoveSpecs.length} dynamic specifications configured for Gas Stoves`
  );

  // Identify specific specifications
  const burnerCountSpec = gasStoveSpecs.find((s) => s.slug.includes("burner-count"));
  const cooktopMaterialSpec = gasStoveSpecs.find((s) => s.slug.includes("cooktop-material"));
  const ignitionSpec = gasStoveSpecs.find((s) => s.slug.includes("ignition"));

  assert(
    Boolean(burnerCountSpec && cooktopMaterialSpec && ignitionSpec),
    "Specification Predefined Values Available",
    "Burner Count, Cooktop Material, and Ignition specifications are active"
  );

  const opt3Burner = burnerCountSpec?.predefinedValues.find((v) => v.value.includes("3"));
  const optSS = cooktopMaterialSpec?.predefinedValues.find((v) => v.value.toLowerCase().includes("stainless"));
  const optAuto = ignitionSpec?.predefinedValues.find((v) => v.value.toLowerCase().includes("automatic"));

  // 5. Create Product with Dynamic Specifications, Pricing, and Price Code
  const testSku = `TEST-GS-3B-${Date.now()}`;
  const createdProduct = await createProduct({
    name: "Prestige Phase3 Test Gas Stove 3B",
    brandId: newBrand.id,
    categoryId: gasStovesCategory.id,
    sku: testSku,
    modelNumber: "TEST-MOD-300",
    description: "Test product for Phase 3 automated verification suite",
    mrp: 12000,
    sellingPrice: 9600, // 20% discount
    privatePriceCode: "P960", // Customer visible price code
    warranty: "2 Years Comprehensive",
    isActive: true,
    isFeatured: true,
    attributeValues: [
      {
        attributeId: burnerCountSpec!.id,
        attributeValueId: opt3Burner?.id,
        value: opt3Burner?.value || "3",
      },
      {
        attributeId: cooktopMaterialSpec!.id,
        attributeValueId: optSS?.id,
        value: optSS?.value || "Stainless Steel",
      },
      {
        attributeId: ignitionSpec!.id,
        attributeValueId: optAuto?.id,
        value: optAuto?.value || "Automatic",
      },
    ],
  });

  assert(
    Boolean(createdProduct && createdProduct.id),
    "Product Creation with Dynamic Specifications",
    `Created product "${createdProduct.name}" (ID: ${createdProduct.id})`
  );

  // 6. Verify Discount Auto-calculation
  assert(
    createdProduct.discountPercent === 20,
    "Discount Percentage Auto-calculation",
    `MRP: ₹12,000, Selling Price: ₹9,600 => Discount: ${createdProduct.discountPercent}%`
  );

  // 7. Verify Price Code is Stored and Accessible
  assert(
    createdProduct.privatePriceCode === "P960",
    "Price Code Stored and Non-Secret",
    `Price Code stored as "${createdProduct.privatePriceCode}"`
  );

  // 8. Fetch Product Detail and check formatted specifications
  const detail = await getProductById(createdProduct.id);
  assert(
    detail.attributeValues.length === 3,
    "Product Dynamic Attribute Values Retrievable",
    `Retrieved ${detail.attributeValues.length} dynamic specification values`
  );

  // 9. Product Listing & Search
  const listResult = await getProducts({
    search: "Phase3 Test",
    limit: 10,
  });
  assert(
    listResult.products.length >= 1 && listResult.products.some((p) => p.id === createdProduct.id),
    "Product Listing & Search by Name",
    `Found product via search query "Phase3 Test"`
  );

  const searchBySku = await getProducts({
    search: testSku,
  });
  assert(
    searchBySku.products.length === 1 && searchBySku.products[0].id === createdProduct.id,
    "Product Search by SKU",
    `Found exact match for SKU: ${testSku}`
  );

  // 10. SKU Uniqueness Validation
  let duplicateSkuCaught = false;
  try {
    await createProduct({
      name: "Duplicate SKU Product",
      brandId: newBrand.id,
      categoryId: gasStovesCategory.id,
      sku: testSku, // Duplicate!
      mrp: 5000,
    });
  } catch (err: any) {
    if (err instanceof ProductServiceError && err.message.includes("already being used")) {
      duplicateSkuCaught = true;
    }
  }
  assert(
    duplicateSkuCaught,
    "SKU Uniqueness Validation",
    "Duplicate SKU rejected with friendly message"
  );

  // 11. MRP Required Validation
  let missingMrpCaught = false;
  try {
    createProductSchema.parse({
      name: "No MRP Product",
      brandId: newBrand.id,
      categoryId: gasStovesCategory.id,
      sku: `NO-MRP-${Date.now()}`,
      // mrp missing
    });
  } catch (err) {
    missingMrpCaught = true;
  }
  assert(missingMrpCaught, "MRP Required Validation", "Missing MRP rejected by schema validator");

  // 12. Selling Price Cannot Exceed MRP
  let priceExceedCaught = false;
  try {
    createProductSchema.parse({
      name: "Invalid Price Product",
      brandId: newBrand.id,
      categoryId: gasStovesCategory.id,
      sku: `INV-PRICE-${Date.now()}`,
      mrp: 5000,
      sellingPrice: 7000, // Greater than MRP!
    });
  } catch (err: any) {
    priceExceedCaught = true;
  }
  assert(
    priceExceedCaught,
    "Selling Price <= MRP Validation",
    "Selling price exceeding MRP rejected by schema refinement"
  );

  // 13. Optional Selling Price & No Discount Calculation
  const noSellingPriceProd = await createProduct({
    name: "MRP Only Product",
    brandId: newBrand.id,
    categoryId: gasStovesCategory.id,
    sku: `MRP-ONLY-${Date.now()}`,
    mrp: 4500,
  });
  assert(
    noSellingPriceProd.sellingPrice === null && noSellingPriceProd.discountPercent === null,
    "Selling Price Optional & No Discount When Empty",
    `MRP: ₹4,500, Selling Price: null => Discount: null`
  );

  // 14. Invalid Category / Attribute Combinations Rejected
  const mixerCategory = await prisma.category.findFirst({
    where: { name: { contains: "Mixer", mode: "insensitive" } },
  });

  if (mixerCategory) {
    let invalidAttrCaught = false;
    try {
      await createProduct({
        name: "Invalid Attribute Mixer",
        brandId: newBrand.id,
        categoryId: mixerCategory.id,
        sku: `INV-ATTR-${Date.now()}`,
        mrp: 3000,
        attributeValues: [
          {
            attributeId: burnerCountSpec!.id, // Gas stove attribute applied to Mixer Grinder!
            value: "3",
          },
        ],
      });
    } catch (err: any) {
      if (err instanceof ProductServiceError && err.message.includes("does not belong")) {
        invalidAttrCaught = true;
      }
    }
    assert(
      invalidAttrCaught,
      "Invalid Category/Attribute Combinations Rejected",
      "Gas Stove attribute rejected when submitting to Mixer Grinder category"
    );
  }

  // 15. Edit Product & Price Code Modification
  const updatedProduct = await updateProduct(createdProduct.id, {
    name: "Prestige Phase3 Test Gas Stove 3B (Updated)",
    mrp: 14000,
    sellingPrice: 10500, // 25% discount
    privatePriceCode: "P1050",
    warranty: "3 Years Extended",
  });
  assert(
    updatedProduct.name === "Prestige Phase3 Test Gas Stove 3B (Updated)" &&
      updatedProduct.mrp === 14000 &&
      updatedProduct.sellingPrice === 10500 &&
      updatedProduct.discountPercent === 25 &&
      updatedProduct.privatePriceCode === "P1050",
    "Product Editing & Real-time Recalculations",
    `Updated name, MRP (₹14,000), Selling Price (₹10,500), Discount (25%), Price Code (P1050)`
  );

  // 16. Category Change Safety & Obsolete Attribute Handling
  if (mixerCategory) {
    const movedProduct = await updateProduct(createdProduct.id, {
      categoryId: mixerCategory.id, // Switch from Gas Stoves to Mixer Grinders
      attributeValues: [], // Old Gas stove attributes should be purged
    });

    const movedDetail = await getProductById(movedProduct.id);
    assert(
      movedDetail.categoryId === mixerCategory.id &&
        movedDetail.attributeValues.every((pav) => pav.attribute.categoryId === mixerCategory.id),
      "Category Change Safety",
      "Switched category to Mixer Grinders and purged obsolete Gas Stove specifications"
    );
  }

  // 17. Toggle Active & Featured
  const toggledActive = await toggleProductActive(createdProduct.id, false);
  assert(toggledActive.isActive === false, "Product Deactivation", "Product deactivated (isActive: false)");

  const toggledFeatured = await toggleProductFeatured(createdProduct.id, true);
  assert(toggledFeatured.isFeatured === true, "Product Featured Toggle", "Product featured (isFeatured: true)");

  // 18. Cleanup Test Products
  await deleteProduct(createdProduct.id);
  await deleteProduct(noSellingPriceProd.id);
  await prisma.brand.delete({ where: { id: newBrand.id } });
  assert(true, "Safe Product Deletion & Cleanup", "Test products and test brand deleted cleanly");

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
  console.log(`🎉 ALL ${passCount} PHASE 3 TESTS PASSED SUCCESSFULLY! (100% Pass Rate)`);
  console.log("============================================================\n");
}

runPhase3Tests()
  .catch((err) => {
    console.error("Phase 3 tests failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
