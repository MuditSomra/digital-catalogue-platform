import { PrismaClient } from "@prisma/client";
import { getCategoriesTree } from "../src/lib/category-service";

const prisma = new PrismaClient();

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
    if (detail) console.log(`     ${detail}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`     ${detail}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// Mirror normalization & state synchronization logic
const EMPTY_ARRAY: any[] = [];
const EMPTY_MAP = new Map<string, any>();

function normalizeCategories(
  items: any[] | undefined,
  excludeId?: string | null
): {
  tree: any[];
  map: Map<string, any>;
} {
  if (!items || items.length === 0) {
    return { tree: EMPTY_ARRAY, map: EMPTY_MAP };
  }

  const map = new Map<string, any>();

  function collectNodes(nodes: any[]) {
    for (const node of nodes) {
      if (!node || !node.id) continue;
      if (!map.has(node.id)) {
        map.set(node.id, {
          id: node.id,
          name: node.name,
          parentId: node.parentId || null,
          children: [],
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
  }

  for (const node of map.values()) {
    node.children = [];
  }

  const rootTree: any[] = [];
  for (const node of map.values()) {
    if (excludedIds.has(node.id)) continue;
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      rootTree.push(node);
    }
  }

  return { tree: rootTree, map };
}

function getAncestorPath(
  targetId: string | null | undefined,
  map: Map<string, any>
): string[] {
  if (!targetId || !map.has(targetId)) return EMPTY_ARRAY;
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

// Simulated React State Hook Cycle
function simulateEffectCycle(
  initialValue: string | null,
  categoriesData: any[] | undefined,
  simulatedRenders: number
): { renderCount: number; stateUpdateCount: number; finalPath: string[] } {
  let selectedPath: string[] = [];
  let stateUpdateCount = 0;

  // Initial render normalization
  const rawData = categoriesData !== undefined ? categoriesData : EMPTY_ARRAY;
  const { map } = normalizeCategories(rawData);
  selectedPath = getAncestorPath(initialValue, map);

  // Simulated renders
  for (let r = 0; r < simulatedRenders; r++) {
    const currentRaw = categoriesData !== undefined ? categoriesData : EMPTY_ARRAY;
    const { map: currentMap } = normalizeCategories(currentRaw);

    // Simulated useEffect
    if (!initialValue) {
      const prev = selectedPath;
      const next = prev.length === 0 ? prev : EMPTY_ARRAY;
      if (!Object.is(prev, next)) {
        selectedPath = next;
        stateUpdateCount++;
      }
    } else if (currentMap.has(initialValue)) {
      const targetPath = getAncestorPath(initialValue, currentMap);
      const prev = selectedPath;
      let next = prev;
      if (
        !(
          prev.length === targetPath.length &&
          prev.every((id, idx) => id === targetPath[idx])
        )
      ) {
        next = targetPath;
        stateUpdateCount++;
      }
      selectedPath = next;
    }
  }

  return { renderCount: simulatedRenders, stateUpdateCount, finalPath: selectedPath };
}

async function runRegressionTests() {
  console.log("============================================================");
  console.log("REGRESSION SUITE: CascadingCategorySelect & Navigation Stability");
  console.log("============================================================\n");

  try {
    // 1. Test empty value with empty categories ([] from initial page state)
    console.log("--- 1. Testing Empty State Stability with Empty Categories prop ---");
    const result1 = simulateEffectCycle("", [], 100);
    assert(result1.stateUpdateCount === 0, "No state updates triggered on empty initial value and empty categories", `State updates: ${result1.stateUpdateCount} over ${result1.renderCount} renders`);
    assert(result1.finalPath.length === 0, "Final path is empty array", `Final path length: ${result1.finalPath.length}`);

    // 2. Test empty value with populated categories
    console.log("\n--- 2. Testing Empty State Stability with Populated Categories ---");
    const tree = await getCategoriesTree();
    const result2 = simulateEffectCycle("", tree, 100);
    assert(result2.stateUpdateCount === 0, "No state updates triggered on empty filter value over 100 renders", `State updates: ${result2.stateUpdateCount}`);

    // 3. Test prepopulated category value (Edit mode)
    console.log("\n--- 3. Testing Edit Mode Prepopulation Stability ---");
    const allCategories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
    if (allCategories.length > 0) {
      const targetCat = allCategories.find((c) => c.parentId !== null) || allCategories[0];
      const result3 = simulateEffectCycle(targetCat.id, tree, 100);
      assert(result3.stateUpdateCount === 0, `No state updates triggered once prepopulated path matches target category (${targetCat.name})`, `State updates: ${result3.stateUpdateCount}`);
      assert(result3.finalPath[result3.finalPath.length - 1] === targetCat.id, "Final path ends with target category ID");
    }

    // 4. Test normalizeCategories reference stability
    console.log("\n--- 4. Testing Normalization Reference Stability ---");
    const norm1 = normalizeCategories(undefined);
    const norm2 = normalizeCategories([]);
    assert(norm1.tree === norm2.tree, "normalizeCategories returns identical EMPTY_ARRAY reference for undefined and []");
    assert(norm1.map === norm2.map, "normalizeCategories returns identical EMPTY_MAP reference for undefined and []");

    // 5. Test Ancestor Path Resolution
    console.log("\n--- 5. Testing getAncestorPath Helper ---");
    assert(getAncestorPath(null, EMPTY_MAP) === EMPTY_ARRAY, "getAncestorPath with null returns EMPTY_ARRAY reference");
    assert(getAncestorPath("", EMPTY_MAP) === EMPTY_ARRAY, "getAncestorPath with empty string returns EMPTY_ARRAY reference");

    console.log("\n============================================================");
    console.log(`🎉 ALL ${totalTests} REGRESSION TESTS PASSED!`);
    console.log("============================================================\n");
  } catch (err) {
    console.error("Regression tests failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRegressionTests();
