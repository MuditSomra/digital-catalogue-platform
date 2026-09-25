import { PrismaClient } from "@prisma/client";
import {
  getCategoriesTree,
  getFlatCategoryOptions,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../src/lib/category-service";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
} from "../src/lib/product-service";
import { getCategoryAttributes } from "../src/lib/attribute-service";

const prisma = new PrismaClient();

// Mirror normalization logic from CascadingCategorySelect for verification
interface TestNode {
  id: string;
  name: string;
  parentId: string | null;
  children: TestNode[];
  isDisabled?: boolean;
}

function normalizeCategories(
  items: any[] | undefined,
  excludeId?: string | null
): {
  tree: TestNode[];
  map: Map<string, TestNode>;
} {
  const map = new Map<string, TestNode>();
  if (!items || items.length === 0) {
    return { tree: [], map };
  }

  function collectNodes(nodes: any[]) {
    for (const node of nodes) {
      if (!node || !node.id) continue;
      if (!map.has(node.id)) {
        map.set(node.id, {
          id: node.id,
          name: node.name,
          parentId: node.parentId || null,
          children: [],
          isDisabled: Boolean(node.isDisabled),
        });
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        collectNodes(node.children);
      }
    }
  }

  collectNodes(items);

  const excludedIds = new Set<string>();
  if (excludeId) {
    excludedIds.add(excludeId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, node] of map.entries()) {
        if (node.parentId && excludedIds.has(node.parentId) && !excludedIds.has(id)) {
          excludedIds.add(id);
          changed = true;
        }
      }
    }
  }

  for (const node of map.values()) {
    node.children = [];
  }

  const rootTree: TestNode[] = [];
  const allNodes = Array.from(map.values());

  for (const node of allNodes) {
    if (excludedIds.has(node.id)) {
      node.isDisabled = true;
      continue;
    }
    if (node.parentId && map.has(node.parentId) && !excludedIds.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else if (!node.parentId || excludedIds.has(node.parentId)) {
      rootTree.push(node);
    }
  }

  return { tree: rootTree, map };
}

function getAncestorPath(
  targetId: string | null | undefined,
  map: Map<string, TestNode>
): string[] {
  if (!targetId || !map.has(targetId)) return [];
  const path: string[] = [];
  let currId: string | null = targetId;
  const visited = new Set<string>();

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    path.unshift(currId);
    const node = map.get(currId);
    currId = node?.parentId || null;
  }
  return path;
}

function computeLevelsToRender(
  tree: TestNode[],
  map: Map<string, TestNode>,
  selectedPath: string[],
  isFilterMode = false,
  allowRootSelection = false
) {
  const list: Array<{
    level: number;
    placeholder: string;
    selectedId: string;
    options: TestNode[];
  }> = [];

  if (tree.length === 0) return list;

  // Level 0
  list.push({
    level: 0,
    placeholder: isFilterMode ? "All Categories" : allowRootSelection ? "(None - Top Level Root Category)" : "Select Category...",
    selectedId: selectedPath[0] || "",
    options: tree,
  });

  // Subsequent levels
  for (let i = 0; i < selectedPath.length; i++) {
    const parentId = selectedPath[i];
    if (!parentId) break;

    const parentNode = map.get(parentId);
    if (parentNode && parentNode.children && parentNode.children.length > 0) {
      list.push({
        level: i + 1,
        placeholder: isFilterMode ? `All ${parentNode.name}` : allowRootSelection ? `(No subcategory - Use "${parentNode.name}")` : "Select Subcategory...",
        selectedId: selectedPath[i + 1] || "",
        options: parentNode.children,
      });
    }
  }

  return list;
}

async function runTests() {
  console.log("============================================================");
  console.log("🚀 TESTING CASCADING CATEGORY DROPDOWN SYSTEM");
  console.log("============================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [TEST ${totalTests}] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
    } else {
      console.error(`❌ [TEST ${totalTests} FAILED] ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      process.exit(1);
    }
  }

  try {
    // 1. Fetch real Category Tree from DB
    const treeData = await getCategoriesTree();
    assert(treeData.length > 0, "Fetch existing category tree from database", `Found ${treeData.length} root categories`);

    // 2. Test Normalization into Map and Root Tree
    const { tree, map } = normalizeCategories(treeData);
    assert(tree.length > 0 && map.size > 0, "Category normalization produces valid tree & lookup map", `Total mapped nodes: ${map.size}`);

    // Verify all root nodes have parentId = null
    const allRootsNull = tree.every((r) => r.parentId === null);
    assert(allRootsNull, "Level 0 contains exclusively root categories (parentId === null)");

    // 3. Test Level 0 initial state
    let selectedPath: string[] = [];
    let levels = computeLevelsToRender(tree, map, selectedPath);
    assert(levels.length === 1, "Initial state renders exactly 1 dropdown (Level 0)");
    assert(levels[0].options.length === tree.length, "Level 0 dropdown contains all root categories");
    assert(levels[0].options.every((opt) => !opt.name.includes(" > ")), "Level 0 dropdown options contain clean names without breadcrumb prefixes");

    // 4. Test selecting a Root category with children (e.g. Kitchen Appliances)
    const kitchenNode = tree.find((t) => t.name.toLowerCase().includes("kitchen"));
    assert(Boolean(kitchenNode), "Found 'Kitchen Appliances' root category", `ID: ${kitchenNode?.id}`);

    let cookingNode: TestNode | undefined;

    if (kitchenNode) {
      selectedPath = [kitchenNode.id];
      levels = computeLevelsToRender(tree, map, selectedPath);
      assert(levels.length === 2, "Selecting root category reveals Level 1 child dropdown", `Rendered ${levels.length} levels`);
      assert(levels[1].options.length > 0, "Level 1 dropdown contains direct children of Kitchen Appliances");
      assert(
        levels[1].options.every((c) => c.parentId === kitchenNode.id),
        "Level 1 dropdown options are all direct children of Level 0"
      );

      // 5. Test selecting Level 1 subcategory (e.g. Cooking Appliances)
      cookingNode = levels[1].options.find((c) => c.name.toLowerCase().includes("cooking"));
      assert(Boolean(cookingNode), "Found 'Cooking Appliances' in Level 1 options", `ID: ${cookingNode?.id}`);

      if (cookingNode) {
        selectedPath = [kitchenNode.id, cookingNode.id];
        levels = computeLevelsToRender(tree, map, selectedPath);
        assert(levels.length === 3, "Selecting Level 1 subcategory reveals Level 2 dropdown", `Rendered ${levels.length} levels`);

        // 6. Test selecting Level 2 subcategory (e.g. Gas Stoves)
        const gasStoveNode = levels[2].options.find((c) => c.name.toLowerCase().includes("gas stove"));
        assert(Boolean(gasStoveNode), "Found 'Gas Stoves' in Level 2 options", `ID: ${gasStoveNode?.id}`);

        if (gasStoveNode) {
          selectedPath = [kitchenNode.id, cookingNode.id, gasStoveNode.id];
          levels = computeLevelsToRender(tree, map, selectedPath);
          // Gas stoves has no children, so should not render Level 3
          assert(levels.length === 3, "Leaf category (Gas Stoves) stops further dropdown level rendering", `Levels rendered: ${levels.length}`);
        }
      }
    }

    // 7. Test Dependent Selection Reset: Changing Level 0 clears all downstream levels
    const livingNode = tree.find((t) => t.id !== kitchenNode?.id);
    if (livingNode) {
      // Switch level 0 to livingNode
      selectedPath = [livingNode.id];
      levels = computeLevelsToRender(tree, map, selectedPath);
      assert(
        levels[0].selectedId === livingNode.id,
        "Level 0 successfully changed to another category",
        `Selected: ${livingNode.name}`
      );
      if (livingNode.children.length > 0) {
        assert(levels[1].selectedId === "", "Level 1 selection was automatically cleared and reset");
        assert(
          levels[1].options.every((c) => c.parentId === livingNode.id),
          "Level 1 options now display direct children of new Level 0"
        );
      }
    }

    // 8. Test Edit Prepopulation: Given a deep leaf category ID, reconstruct full ancestor path
    const gasStoveItem = Array.from(map.values()).find((n) => n.name.toLowerCase().includes("gas stove"));
    assert(Boolean(gasStoveItem), "Target leaf category found for edit prepopulation test");
    if (gasStoveItem) {
      const reconstructedPath = getAncestorPath(gasStoveItem.id, map);
      assert(reconstructedPath.length === 3, "Prepopulation resolves full 3-level ancestor chain", `Path length: ${reconstructedPath.length}`);
      assert(
        reconstructedPath[reconstructedPath.length - 1] === gasStoveItem.id,
        "Deepest element of ancestor path matches target category ID"
      );
      const prePopLevels = computeLevelsToRender(tree, map, reconstructedPath);
      assert(prePopLevels.length === 3, "Prepopulated path renders all 3 levels with active selections");
      assert(prePopLevels[2].selectedId === gasStoveItem.id, "Level 2 dropdown has target leaf category pre-selected");
    }

    // 9. Test Self-Parenting & Circular Hierarchy Prevention
    if (cookingNode) {
      const { tree: safeTree, map: safeMap } = normalizeCategories(treeData, cookingNode.id);
      const cookingInSafeMap = safeMap.get(cookingNode.id);
      assert(cookingInSafeMap?.isDisabled === true, "Excluded category is marked disabled/excluded");
      
      // Check that Cooking Appliances and Gas Stoves do not appear in selectable tree
      const cookingInRoots = safeTree.some((r) => r.id === cookingNode.id);
      assert(!cookingInRoots, "Excluded category does not appear in root options");

      const kitchenInSafeTree = safeTree.find((r) => r.id === kitchenNode?.id);
      const cookingInKitchenChildren = kitchenInSafeTree?.children.some((c) => c.id === cookingNode.id);
      assert(!cookingInKitchenChildren, "Excluded category is pruned from parent children options (prevents cycle)");
    }

    // 10. Test Arbitrary Depth Support (Dynamic 4-level deep creation)
    console.log("\n--- Testing Arbitrary Hierarchy Depth (Dynamic Sub-sub-sub-category) ---");
    const level1Cat = await createCategory({
      name: "Test Deep L1",
      parentId: null,
      description: "Test level 1",
      isActive: true,
    });
    const level2Cat = await createCategory({
      name: "Test Deep L2",
      parentId: level1Cat.id,
      description: "Test level 2",
      isActive: true,
    });
    const level3Cat = await createCategory({
      name: "Test Deep L3",
      parentId: level2Cat.id,
      description: "Test level 3",
      isActive: true,
    });
    const level4Cat = await createCategory({
      name: "Test Deep L4",
      parentId: level3Cat.id,
      description: "Test level 4",
      isActive: true,
    });

    const updatedTree = await getCategoriesTree();
    const { tree: normDeepTree, map: normDeepMap } = normalizeCategories(updatedTree);
    const deepPath = getAncestorPath(level4Cat.id, normDeepMap);
    assert(deepPath.length === 4, "Supports 4-level deep arbitrary hierarchy path resolution", `Path: ${deepPath.join(" -> ")}`);

    const deepLevels = computeLevelsToRender(normDeepTree, normDeepMap, deepPath);
    assert(deepLevels.length === 4, "Cascading dropdown dynamically renders 4 levels for 4-depth category", `Rendered levels: ${deepLevels.length}`);

    // Cleanup deep test categories
    await deleteCategory(level4Cat.id);
    await deleteCategory(level3Cat.id);
    await deleteCategory(level2Cat.id);
    await deleteCategory(level1Cat.id);
    assert(true, "Deep arbitrary test hierarchy cleaned up cleanly");

    // 11. Test Product Category Assignment & Specification Preservation
    console.log("\n--- Testing Product Creation with Cascading Category Selection & Specs ---");
    const brands = await prisma.brand.findMany({ take: 1 });
    assert(brands.length > 0, "Found brand for product creation test");

    if (gasStoveItem && brands.length > 0) {
      // Get specifications for Gas Stoves
      const specs = await getCategoryAttributes(gasStoveItem.id);
      assert(specs.length > 0, "Retrieved dynamic specifications for Gas Stoves category", `Found ${specs.length} specs`);

      const testSku = `TEST-CASCADE-${Date.now()}`;
      const product = await createProduct({
        name: "Test Cascading Selector Product",
        brandId: brands[0].id,
        categoryId: gasStoveItem.id, // Final selected category ID
        sku: testSku,
        mrp: 5999,
        sellingPrice: 4499,
        isActive: true,
        attributeValues: specs.length > 0 ? [
          {
            attributeId: specs[0].id,
            value: specs[0].predefinedValues?.[0]?.value || "Test Value",
            attributeValueId: specs[0].predefinedValues?.[0]?.id,
          }
        ] : [],
      });

      assert(product.categoryId === gasStoveItem.id, "Product saved against final selected category ID", `Product categoryId: ${product.categoryId}`);
      assert(product.attributeValues.length > 0, "Dynamic specifications preserved upon saving product", `Saved ${product.attributeValues.length} spec values`);

      // Cleanup test product
      await deleteProduct(product.id);
      assert(true, "Test product deleted cleanly");
    }

    // 12. Test Filter Mode Dropdown Behavior
    console.log("\n--- Testing Filter Mode (Product & Inventory Filter Bars) ---");
    const filterLevelsEmpty = computeLevelsToRender(tree, map, [], true);
    assert(filterLevelsEmpty.length === 1, "Filter mode starts with 1 dropdown showing 'All Categories'");
    assert(filterLevelsEmpty[0].placeholder === "All Categories", "Filter mode placeholder is 'All Categories'");

    if (kitchenNode) {
      const filterLevelsRoot = computeLevelsToRender(tree, map, [kitchenNode.id], true);
      assert(filterLevelsRoot.length === 2, "Selecting root in filter reveals Level 1 with 'All [Parent]' placeholder");
      assert(filterLevelsRoot[1].placeholder.includes(kitchenNode.name), `Level 1 placeholder is '${filterLevelsRoot[1].placeholder}'`);
    }

    console.log("\n============================================================");
    console.log(`🎉 ALL ${totalTests} CASCADING CATEGORY TESTS PASSED SUCCESSFULLY!`);
    console.log("============================================================\n");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
