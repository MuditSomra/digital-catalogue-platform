import { PrismaClient, AttributeType } from "@prisma/client";
import {
  getCategoriesTree,
  getFlatCategoryOptions,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  reorderCategories,
  CategoryServiceError,
} from "../src/lib/category-service";
import {
  getCategoryAttributes,
  createCategoryAttribute,
  getCategoryAttributeById,
  updateCategoryAttribute,
  deleteCategoryAttribute,
  reorderCategoryAttributes,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  reorderAttributeValues,
  AttributeServiceError,
} from "../src/lib/attribute-service";

const prisma = new PrismaClient();

async function runTests() {
  console.log("============================================================");
  console.log("🧪 RUNNING PHASE 2 COMPREHENSIVE TEST SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testNum: number, name: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [TEST ${testNum}] ${name}`);
      if (detail) console.log(`   └─ ${detail}`);
    } else {
      console.error(`❌ [TEST ${testNum}] FAILED: ${name}`);
      if (detail) console.error(`   └─ ${detail}`);
      throw new Error(`Test ${testNum} failed: ${name}`);
    }
  }

  // ------------------------------------------------------------
  // 1. Existing categories count
  // ------------------------------------------------------------
  const allCategories = await prisma.category.findMany();
  assert(
    allCategories.length >= 28,
    1,
    "Existing categories still exist",
    `Found ${allCategories.length} categories in database (expected >= 28)`
  );

  // ------------------------------------------------------------
  // 2. Zero refrigeration categories
  // ------------------------------------------------------------
  const refrigCategories = await prisma.category.findMany({
    where: {
      OR: [
        { name: { contains: "refrigerat", mode: "insensitive" } },
        { name: { contains: "fridge", mode: "insensitive" } },
        { slug: { contains: "refrigerat", mode: "insensitive" } },
        { slug: { contains: "fridge", mode: "insensitive" } },
      ],
    },
  });
  assert(
    refrigCategories.length === 0,
    2,
    "There are still zero refrigeration categories",
    `Count = ${refrigCategories.length}`
  );

  // ------------------------------------------------------------
  // 3. Create a test category
  // ------------------------------------------------------------
  const testRoot = await createCategory({
    name: "Test Smart Appliances",
    description: "Temporary category for automated test suite",
    isActive: true,
    sortOrder: 99,
  });
  assert(
    Boolean(testRoot && testRoot.id && testRoot.slug === "test-smart-appliances"),
    3,
    "Create a test category",
    `Created "${testRoot.name}" with auto-slug "${testRoot.slug}" (ID: ${testRoot.id})`
  );

  // ------------------------------------------------------------
  // 4. Create a subcategory under it
  // ------------------------------------------------------------
  const testSub = await createCategory({
    name: "Smart Ovens",
    parentId: testRoot.id,
    description: "Subcategory for testing",
    isActive: true,
    sortOrder: 1,
  });
  assert(
    Boolean(testSub && testSub.parentId === testRoot.id),
    4,
    "Create a subcategory under it",
    `Created "${testSub.name}" under parent "${testRoot.name}"`
  );

  // ------------------------------------------------------------
  // 5. Edit the category
  // ------------------------------------------------------------
  const editedRoot = await updateCategory(testRoot.id, {
    description: "Updated description for test category",
  });
  assert(
    editedRoot.description === "Updated description for test category",
    5,
    "Edit the category",
    `Description updated: "${editedRoot.description}"`
  );

  // ------------------------------------------------------------
  // 6. Rename the category
  // ------------------------------------------------------------
  const renamedRoot = await updateCategory(testRoot.id, {
    name: "Test Connected Appliances",
  });
  assert(
    renamedRoot.name === "Test Connected Appliances",
    6,
    "Rename the category",
    `Renamed to "${renamedRoot.name}"`
  );

  // ------------------------------------------------------------
  // 7. Move the category
  // ------------------------------------------------------------
  // Find a valid parent, e.g. Cooking Appliances
  const cookingApp = await prisma.category.findUnique({
    where: { slug: "cooking-appliances" },
  });
  const movedSub = await updateCategory(testSub.id, {
    parentId: cookingApp?.id,
  });
  assert(
    movedSub.parentId === cookingApp?.id,
    7,
    "Move the category",
    `Moved "${movedSub.name}" under "${cookingApp?.name}"`
  );
  // Move back under testRoot
  await updateCategory(testSub.id, { parentId: testRoot.id });

  // ------------------------------------------------------------
  // 8. Change sort order
  // ------------------------------------------------------------
  const reorderedRoot = await updateCategory(testRoot.id, {
    sortOrder: 150,
  });
  assert(
    reorderedRoot.sortOrder === 150,
    8,
    "Change sort order",
    `Sort order changed to ${reorderedRoot.sortOrder}`
  );

  // ------------------------------------------------------------
  // 9. Disable the category
  // ------------------------------------------------------------
  const disabledRoot = await toggleCategoryStatus(testRoot.id, false);
  assert(
    disabledRoot.isActive === false,
    9,
    "Disable the category",
    `Category isActive: ${disabledRoot.isActive}`
  );

  // ------------------------------------------------------------
  // 10. Re-enable the category
  // ------------------------------------------------------------
  const enabledRoot = await toggleCategoryStatus(testRoot.id, true);
  assert(
    enabledRoot.isActive === true,
    10,
    "Re-enable the category",
    `Category isActive: ${enabledRoot.isActive}`
  );

  // ------------------------------------------------------------
  // 11. Delete the test category safely (tested below after hierarchy tests)
  // ------------------------------------------------------------

  // ------------------------------------------------------------
  // 12. Attempt to make a category its own parent -> Rejected
  // ------------------------------------------------------------
  let ownParentRejected = false;
  try {
    await updateCategory(testRoot.id, { parentId: testRoot.id });
  } catch (err: unknown) {
    if (err instanceof CategoryServiceError || (err instanceof Error && err.message.includes("own parent"))) {
      ownParentRejected = true;
    }
  }
  assert(
    ownParentRejected,
    12,
    "Attempt to make a category its own parent is rejected",
    "Self-parent assignment safely blocked"
  );

  // ------------------------------------------------------------
  // 13. Attempt to create a circular hierarchy -> Rejected
  // ------------------------------------------------------------
  // testSub is child of testRoot. Attempt to set testRoot.parentId = testSub.id
  let circularRejected = false;
  try {
    await updateCategory(testRoot.id, { parentId: testSub.id });
  } catch (err: unknown) {
    if (err instanceof CategoryServiceError || (err instanceof Error && err.message.includes("subcategories"))) {
      circularRejected = true;
    }
  }
  assert(
    circularRejected,
    13,
    "Attempt to create a circular hierarchy is rejected",
    "Ancestor-descendant circular loop safely blocked"
  );

  // ------------------------------------------------------------
  // 14. Attempt to delete a category containing children -> Blocked
  // ------------------------------------------------------------
  let deleteWithChildrenBlocked = false;
  try {
    await deleteCategory(testRoot.id);
  } catch (err: unknown) {
    if (err instanceof CategoryServiceError && err.message.includes("contains 1 subcategory")) {
      deleteWithChildrenBlocked = true;
    }
  }
  assert(
    deleteWithChildrenBlocked,
    14,
    "Attempt to delete a category containing children is safely prevented",
    "Deletion prevented with friendly message explaining 1 subcategory exists"
  );

  // ------------------------------------------------------------
  // 15. Attempt to delete a category containing products -> Blocked
  // ------------------------------------------------------------
  const gasStoves = await prisma.category.findUnique({
    where: { slug: "gas-stoves" },
    include: { _count: { select: { products: true } } },
  });
  let deleteWithProductsBlocked = false;
  try {
    if (gasStoves) {
      await deleteCategory(gasStoves.id);
    }
  } catch (err: unknown) {
    if (err instanceof CategoryServiceError && err.message.includes("product(s) are currently assigned")) {
      deleteWithProductsBlocked = true;
    }
  }
  assert(
    deleteWithProductsBlocked,
    15,
    "Attempt to delete a category containing products is safely prevented",
    `Gas Stoves deletion safely prevented (${gasStoves?._count.products} products assigned)`
  );

  // ------------------------------------------------------------
  // 16. Create a test specification
  // ------------------------------------------------------------
  const testSpec = await createCategoryAttribute({
    categoryId: testSub.id,
    name: "Baking Capacity",
    type: AttributeType.SELECT,
    unit: "Litres",
    isFilterable: true,
    isRequired: false,
    initialOptions: ["20L", "25L", "30L"],
  });
  assert(
    Boolean(testSpec && testSpec.id && testSpec.predefinedValues.length === 3),
    16,
    "Create a test specification",
    `Created "${testSpec.name}" (Type: ${testSpec.type}, Unit: ${testSpec.unit}) with 3 initial options`
  );

  // ------------------------------------------------------------
  // 17. Edit specification
  // ------------------------------------------------------------
  const editedSpec = await updateCategoryAttribute(testSpec.id, {
    name: "Total Chamber Capacity",
    unit: "L",
  });
  assert(
    editedSpec.name === "Total Chamber Capacity" && editedSpec.unit === "L",
    17,
    "Edit specification",
    `Updated name to "${editedSpec.name}" and unit to "${editedSpec.unit}"`
  );

  // ------------------------------------------------------------
  // 18. Change specification type
  // ------------------------------------------------------------
  const typeChangedSpec = await updateCategoryAttribute(testSpec.id, {
    type: AttributeType.MULTI_SELECT,
  });
  assert(
    typeChangedSpec.type === AttributeType.MULTI_SELECT,
    18,
    "Change specification type where allowed",
    `Type updated to ${typeChangedSpec.type}`
  );

  // ------------------------------------------------------------
  // 19. Enable/disable customer filtering
  // ------------------------------------------------------------
  const filterOffSpec = await updateCategoryAttribute(testSpec.id, {
    isFilterable: false,
  });
  assert(
    filterOffSpec.isFilterable === false,
    19,
    "Enable/disable customer filtering",
    `isFilterable toggled to ${filterOffSpec.isFilterable}`
  );

  // ------------------------------------------------------------
  // 20. Mark it required / not required
  // ------------------------------------------------------------
  const reqOnSpec = await updateCategoryAttribute(testSpec.id, {
    isRequired: true,
  });
  assert(
    reqOnSpec.isRequired === true,
    20,
    "Mark specification required / not required",
    `isRequired toggled to ${reqOnSpec.isRequired}`
  );

  // ------------------------------------------------------------
  // 21. Add options
  // ------------------------------------------------------------
  const newOpt = await createAttributeValue({
    attributeId: testSpec.id,
    value: "35L",
    label: "35 Litres Extra Large",
  });
  assert(
    Boolean(newOpt && newOpt.id && newOpt.value === "35L"),
    21,
    "Add options",
    `Added option "${newOpt.label}" (value: ${newOpt.value})`
  );

  // ------------------------------------------------------------
  // 22. Edit options
  // ------------------------------------------------------------
  const editedOpt = await updateAttributeValue(newOpt.id, {
    label: "35 Litres Jumbo Cavity",
  });
  assert(
    editedOpt.label === "35 Litres Jumbo Cavity",
    22,
    "Edit options",
    `Option label updated to "${editedOpt.label}"`
  );

  // ------------------------------------------------------------
  // 23. Reorder options
  // ------------------------------------------------------------
  const currentOptions = await prisma.attributeValue.findMany({
    where: { attributeId: testSpec.id },
    orderBy: { sortOrder: "asc" },
  });
  const reorderPayload = currentOptions.map((opt, idx) => ({
    id: opt.id,
    sortOrder: currentOptions.length - idx, // reverse order
  }));
  await reorderAttributeValues(reorderPayload);
  const reorderedOptions = await prisma.attributeValue.findMany({
    where: { attributeId: testSpec.id },
    orderBy: { sortOrder: "asc" },
  });
  assert(
    reorderedOptions[0].id === currentOptions[currentOptions.length - 1].id,
    23,
    "Reorder options",
    "Options successfully reordered in database"
  );

  // ------------------------------------------------------------
  // 24. Delete an unused option
  // ------------------------------------------------------------
  await deleteAttributeValue(newOpt.id);
  const deletedOptCheck = await prisma.attributeValue.findUnique({
    where: { id: newOpt.id },
  });
  assert(
    deletedOptCheck === null,
    24,
    "Delete an unused option",
    "Unused option safely deleted from database"
  );

  // Clean up test spec
  await deleteCategoryAttribute(testSpec.id);

  // ------------------------------------------------------------
  // 25. Duplicate category slug/name handled correctly
  // ------------------------------------------------------------
  const dupCat = await createCategory({
    name: "Test Connected Appliances", // Same name as renamedRoot
  });
  assert(
    Boolean(dupCat && dupCat.slug.startsWith("test-connected-appliances")),
    25,
    "Duplicate category slug/name is handled correctly",
    `Auto-generated unique slug: "${dupCat.slug}"`
  );
  await deleteCategory(dupCat.id);

  // ------------------------------------------------------------
  // 26. Duplicate specification within a category is rejected
  // ------------------------------------------------------------
  const specA = await createCategoryAttribute({
    categoryId: testSub.id,
    name: "Timer Feature",
    type: AttributeType.BOOLEAN,
  });
  let dupSpecRejected = false;
  try {
    await createCategoryAttribute({
      categoryId: testSub.id,
      name: "Timer Feature", // Duplicate name in same category
      type: AttributeType.BOOLEAN,
    });
  } catch (err: unknown) {
    if (err instanceof AttributeServiceError && err.message.includes("already exists in this category")) {
      dupSpecRejected = true;
    }
  }
  assert(
    dupSpecRejected,
    26,
    "Duplicate specification within a category is rejected",
    "Rejected with friendly error message"
  );
  await deleteCategoryAttribute(specA.id);

  // ------------------------------------------------------------
  // 27. Duplicate option within a specification is rejected
  // ------------------------------------------------------------
  const specB = await createCategoryAttribute({
    categoryId: testSub.id,
    name: "Control Dial",
    type: AttributeType.SELECT,
    initialOptions: ["Rotary", "Digital"],
  });
  let dupOptRejected = false;
  try {
    await createAttributeValue({
      attributeId: specB.id,
      value: "Rotary", // Duplicate value
      label: "Rotary Knob",
    });
  } catch (err: unknown) {
    if (err instanceof AttributeServiceError && err.message.includes("already exists")) {
      dupOptRejected = true;
    }
  }
  assert(
    dupOptRejected,
    27,
    "Duplicate option within a specification is rejected",
    "Rejected with friendly error message"
  );
  await deleteCategoryAttribute(specB.id);

  // ------------------------------------------------------------
  // 28. Invalid parent category is rejected
  // ------------------------------------------------------------
  let invalidParentRejected = false;
  try {
    await createCategory({
      name: "Invalid Child",
      parentId: "non-existent-category-id-9999",
    });
  } catch (err: unknown) {
    if (err instanceof CategoryServiceError && err.message.includes("parent category does not exist")) {
      invalidParentRejected = true;
    }
  }
  assert(
    invalidParentRejected,
    28,
    "Invalid parent category is rejected",
    "Rejected with clear non-technical guidance"
  );

  // ------------------------------------------------------------
  // 11 (Completed). Safe deletion of test subcategory and root
  // ------------------------------------------------------------
  await deleteCategory(testSub.id);
  await deleteCategory(testRoot.id);
  const testRootCheck = await prisma.category.findUnique({
    where: { id: testRoot.id },
  });
  assert(
    testRootCheck === null,
    11,
    "Delete the test category safely",
    "Test category and subcategory deleted cleanly without orphan records"
  );

  // ------------------------------------------------------------
  // 29. Existing Gas Stove specifications remain intact
  // ------------------------------------------------------------
  const gasStoveSpecs = await prisma.categoryAttribute.findMany({
    where: { category: { slug: "gas-stoves" } },
    include: { predefinedValues: true },
  });
  const specNames = gasStoveSpecs.map((s) => s.name);
  const expectedSpecs = [
    "Burner Count",
    "Cooktop Material",
    "Ignition",
    "Burner Material",
    "Gas Type",
    "Installation Type",
  ];
  const allGasSpecsPresent = expectedSpecs.every((s) => specNames.includes(s));
  assert(
    allGasSpecsPresent && gasStoveSpecs.length >= 6,
    29,
    "Existing Gas Stove specifications remain intact",
    `Found all 6 starter Gas Stove specifications (${specNames.join(", ")})`
  );

  // ------------------------------------------------------------
  // 30. Existing ProductAttributeValue records remain intact
  // ------------------------------------------------------------
  const pavCount = await prisma.productAttributeValue.count();
  assert(
    pavCount >= 28,
    30,
    "Existing ProductAttributeValue records remain intact",
    `Found ${pavCount} dynamic product attribute values in database`
  );

  // ------------------------------------------------------------
  // 31. Existing products remain intact
  // ------------------------------------------------------------
  const productCount = await prisma.product.count();
  assert(
    productCount >= 6,
    31,
    "Existing products remain intact",
    `Found ${productCount} sample products`
  );

  // ------------------------------------------------------------
  // 32. Existing inventory records remain intact
  // ------------------------------------------------------------
  const inventoryCount = await prisma.inventory.count();
  assert(
    inventoryCount >= 6,
    32,
    "Existing inventory remains intact",
    `Found ${inventoryCount} inventory records`
  );

  // ------------------------------------------------------------
  // 33. Existing inventory movements remain intact
  // ------------------------------------------------------------
  const movementCount = await prisma.inventoryMovement.count();
  assert(
    movementCount >= 6,
    33,
    "Existing inventory movements remain intact",
    `Found ${movementCount} audited inventory movements`
  );

  // ------------------------------------------------------------
  // FILTER REGRESSION TEST
  // ------------------------------------------------------------
  console.log("\n------------------------------------------------------------");
  console.log("🔍 RUNNING FILTER REGRESSION TEST");
  console.log("Filter: Burner Count = 3 AND Cooktop Material = Stainless Steel AND Ignition = Automatic");
  console.log("------------------------------------------------------------");

  const filterMatches = await prisma.product.findMany({
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
    select: {
      name: true,
      sku: true,
      modelNumber: true,
    },
  });

  const matchingNames = filterMatches.map((p) => p.name).sort();
  const expectedNames = [
    "Faber Hob Cooktop 3-Burner Stainless Steel Auto",
    "Prestige Royale Plus 3-Burner Auto Gas Stove",
  ].sort();

  const filterPassed =
    matchingNames.length === 2 &&
    matchingNames[0] === expectedNames[0] &&
    matchingNames[1] === expectedNames[1];

  if (filterPassed) {
    console.log("✅ FILTER REGRESSION TEST PASSED!");
    console.log("Matching products returned:");
    for (const p of filterMatches) {
      console.log(`   - ${p.name} (SKU: ${p.sku})`);
    }
  } else {
    console.error("❌ FILTER REGRESSION TEST FAILED!");
    console.error("Returned:", matchingNames);
    console.error("Expected:", expectedNames);
    throw new Error("Filter regression test failed");
  }

  console.log("\n============================================================");
  console.log(`🎉 ALL ${total} TESTS PASSED SUCCESSFULLY! (100% Pass Rate)`);
  console.log("============================================================\n");
}

runTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
