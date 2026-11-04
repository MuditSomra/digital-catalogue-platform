/**
 * Initialize Category SKU Prefixes and Sequence Counters
 * 
 * Safety & Invariants:
 * - Idempotent: Can be run multiple times safely.
 * - Non-destructive: Does NOT modify any product records or existing SKUs.
 * - Dynamically verifies maximum existing sequence numbers directly from the database.
 * - Sets skuPrefix and skuLastNumber on the 14 approved Level 2 categories.
 * 
 * Usage:
 *   npx tsx scripts/init-category-sku-counters.ts            # DRY RUN
 *   npx tsx scripts/init-category-sku-counters.ts --execute  # Execute
 */

import { PrismaClient } from "@prisma/client";
import { CATEGORY_PREFIX_MAPPING } from "./migrate-product-skus";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

export async function initCategorySkuCounters(isExecute: boolean = false) {
  console.log("================================================================================");
  console.log(` INITIALIZE CATEGORY SKU COUNTERS - ${isExecute ? "EXECUTE MODE" : "DRY RUN MODE"}`);
  console.log("================================================================================\n");

  // 1. Fetch all categories to build parent/ancestor maps
  const allCategories = await prisma.category.findMany();
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  function getLevel2AncestorId(categoryId: string): string | null {
    const chain = [];
    let curr = categoryMap.get(categoryId);
    while (curr) {
      chain.unshift(curr);
      if (!curr.parentId) break;
      curr = categoryMap.get(curr.parentId);
    }
    return chain.length >= 2 ? chain[1].id : null;
  }

  // 2. Fetch all products to inspect current maximum sequence numbers
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, sku: true, categoryId: true },
  });

  console.log(`Total existing products in database: ${allProducts.length}`);

  // Group existing products by their Level 2 category
  const productsByLevel2 = new Map<string, typeof allProducts>();
  for (const p of allProducts) {
    const l2Id = getLevel2AncestorId(p.categoryId);
    if (!l2Id) continue;
    if (!productsByLevel2.has(l2Id)) {
      productsByLevel2.set(l2Id, []);
    }
    productsByLevel2.get(l2Id)!.push(p);
  }

  // 3. Calculate actual max sequence number per Level 2 category
  const plannedUpdates: Array<{
    categoryId: string;
    categoryName: string;
    prefix: string;
    currentLastNumber: number;
    maxExistingNumber: number;
    proposedLastNumber: number;
    productCount: number;
  }> = [];

  for (const [catId, conf] of Object.entries(CATEGORY_PREFIX_MAPPING)) {
    const dbCat = categoryMap.get(catId);
    if (!dbCat) {
      console.warn(`Warning: Category ${conf.name} (${catId}) not found in database.`);
      continue;
    }

    const currentLastNumber = dbCat.skuLastNumber ?? 0;
    const catProducts = productsByLevel2.get(catId) || [];

    let maxNum = 0;
    for (const p of catProducts) {
      const parts = p.sku.split("-");
      if (parts.length === 2 && parts[0] === conf.prefix) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    // Keep the highest number so running multiple times is strictly safe
    const proposedLastNumber = Math.max(currentLastNumber, maxNum);

    plannedUpdates.push({
      categoryId: catId,
      categoryName: conf.name,
      prefix: conf.prefix,
      currentLastNumber,
      maxExistingNumber: maxNum,
      proposedLastNumber,
      productCount: catProducts.length,
    });
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log("CATEGORY COUNTERS TO INITIALIZE:");
  console.log("--------------------------------------------------------------------------------");
  for (const u of plannedUpdates) {
    console.log(
      ` - ${u.categoryName.padEnd(20)} [${u.prefix}] : Max in DB = ${String(u.maxExistingNumber).padEnd(2)} | Current Counter = ${String(u.currentLastNumber).padEnd(2)} -> New Counter = ${String(u.proposedLastNumber).padEnd(2)} (Products: ${u.productCount})`
    );
  }
  console.log("--------------------------------------------------------------------------------\n");

  if (!isExecute) {
    console.log("DRY RUN ONLY: No database changes were made. Run with --execute to commit.");
    return plannedUpdates;
  }

  console.log("Applying category SKU configuration within transaction...");
  await prisma.$transaction(async (tx) => {
    for (const u of plannedUpdates) {
      await tx.category.update({
        where: { id: u.categoryId },
        data: {
          skuPrefix: u.prefix,
          skuLastNumber: u.proposedLastNumber,
        },
      });
    }
  });

  console.log(`SUCCESS: Initialized ${plannedUpdates.length} categories with SKU prefixes and sequence counters.\n`);
  return plannedUpdates;
}

async function main() {
  const isExecute = process.argv.includes("--execute");
  await initCategorySkuCounters(isExecute);
}

if (process.argv[1]?.includes("init-category-sku-counters")) {
  main()
    .catch((e) => {
      console.error("Initialization error:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
