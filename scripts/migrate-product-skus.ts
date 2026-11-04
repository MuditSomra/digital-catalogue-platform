/**
 * Migration Script: Standardize Product SKUs using Category-Based Sequential SKUs
 * 
 * Hierarchy Rules:
 * - Level 1: Main category (e.g. Kitchen Appliances)
 * - Level 2: Product category (e.g. Gas Stoves, Chimney, Mixer Grinder)
 * - Products belong to Level 2 (or subcategories rolling up to Level 2).
 * - Sequential SKUs are generated independently per Level 2 category.
 * 
 * Safety:
 * - Defaults to DRY RUN mode.
 * - Does NOT modify database records unless --execute flag is passed.
 * - Preserves product IDs, model numbers, and all relational data.
 * 
 * Usage:
 *   npx tsx scripts/migrate-product-skus.ts            # DRY RUN (Default)
 *   npx tsx scripts/migrate-product-skus.ts --execute  # Execute migration
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// 1. Explicit Category-to-Prefix Mapping (Level 2 Category IDs)
// ============================================================================
export const CATEGORY_PREFIX_MAPPING: Record<
  string,
  { name: string; prefix: string; description: string }
> = {
  // Active Level 2 Categories with products
  cmvfhj9g50001l008n7hk9sfm: {
    name: "Gas Stoves",
    prefix: "GAS",
    description: "Gas Stoves, Hobs, and Cooktops",
  },
  cmvfm32of000bl508iz396pb7: {
    name: "Chimney",
    prefix: "CHM",
    description: "Kitchen Chimneys and Cooker Hoods",
  },
  cmvflywqs0005l508f7rsidr5: {
    name: "Air Fryer",
    prefix: "AFR",
    description: "Air Fryers and Digital Fryers",
  },
  cmvfkw2rw0003js083tiigh88: {
    name: "Juicer",
    prefix: "JCR",
    description: "Centrifugal, Cold Press, and Electric Juicers",
  },
  cmvfkweux0005js08ag8ynups: {
    name: "Mixer Grinder",
    prefix: "MIX",
    description: "Mixer Grinders and Multi-jar Grinders",
  },
  cmvfm0sgz0007l5084kmltk5y: {
    name: "Micro",
    prefix: "MIC",
    description: "Microwave Ovens (Solo, Grill, Convection)",
  },
  cmvflsvcy0003l508lfmwxi6c: {
    name: "Hand Blender",
    prefix: "HBL",
    description: "Hand Blenders and Portable Blenders",
  },
  cmvflnwhf0001l508fsml2a2k: {
    name: "JMG",
    prefix: "JMG",
    description: "Juicer Mixer Grinders",
  },
  cmvfm1g910009l508abzfiwfm: {
    name: "Oven (OTG)",
    prefix: "OTG",
    description: "Oven Toaster Grillers",
  },
  cmumct4bk000hufm02m7lpq21: {
    name: "Water Appliances",
    prefix: "WAT",
    description: "Water Appliances (Electric Kettles, Water Purifiers, Dispensers)",
  },

  // Active / Ready Level 2 Categories currently with 0 products
  cmvfkvlhp0001js08f3dddwtt: {
    name: "Electric Stove",
    prefix: "EST",
    description: "Induction and Infrared Cooktops",
  },
  cmvfm3evk000dl5083lrnoa5z: {
    name: "RO",
    prefix: "ROX",
    description: "Reverse Osmosis Water Purification Systems",
  },
  cmumct3vk000bufm0l0dg5ze5: {
    name: "Cooking Appliances",
    prefix: "CKA",
    description: "General Cooking Appliances Umbrella",
  },
  cmumct466000fufm0qhiyzy8g: {
    name: "Food Preparation",
    prefix: "FDP",
    description: "General Food Preparation Umbrella",
  },
};

export interface ProductSkuPlan {
  id: string;
  name: string;
  brand: string;
  modelNumber: string;
  level1Name: string;
  level1Id: string;
  level2Name: string;
  level2Id: string;
  directCategoryName: string;
  directCategoryId: string;
  lineage: string;
  oldSku: string;
  proposedSku: string;
  sequenceNumber: number;
  prefix: string;
}

export async function planSkuMigration() {
  // 1. Fetch all categories
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Helper to trace category ancestors up to root
  function getAncestorChain(catId: string) {
    const chain = [];
    let curr = categoryMap.get(catId);
    while (curr) {
      chain.unshift(curr);
      if (!curr.parentId) break;
      curr = categoryMap.get(curr.parentId);
    }
    return chain;
  }

  // 2. Fetch all products ordered deterministically by createdAt, then id
  const products = await prisma.product.findMany({
    include: {
      brand: true,
      category: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const unmappedProducts: Array<{
    id: string;
    name: string;
    directCategory: string;
    lineage: string;
    reason: string;
  }> = [];

  // Group products by their resolved Level 2 category
  const productsByLevel2 = new Map<string, typeof products>();

  for (const product of products) {
    const chain = getAncestorChain(product.categoryId);

    if (chain.length < 2) {
      unmappedProducts.push({
        id: product.id,
        name: product.name,
        directCategory: product.category.name,
        lineage: chain.map((c) => c.name).join(" > "),
        reason: `Product category hierarchy has depth ${chain.length} (needs at least Level 1 Root and Level 2 Category)`,
      });
      continue;
    }

    const level2 = chain[1]; // Level 2 product category
    const mapping = CATEGORY_PREFIX_MAPPING[level2.id];

    if (!mapping) {
      unmappedProducts.push({
        id: product.id,
        name: product.name,
        directCategory: product.category.name,
        lineage: chain.map((c) => c.name).join(" > "),
        reason: `Level 2 category '${level2.name}' (ID: ${level2.id}) is not defined in CATEGORY_PREFIX_MAPPING`,
      });
      continue;
    }

    if (!productsByLevel2.has(level2.id)) {
      productsByLevel2.set(level2.id, []);
    }
    productsByLevel2.get(level2.id)!.push(product);
  }

  // 3. Generate planned SKUs per Level 2 category
  const plan: ProductSkuPlan[] = [];
  const sequenceCounters: Record<string, { categoryId: string; categoryName: string; prefix: string; lastAssigned: number }> = {};

  // Initialize sequence tracker for all known categories in mapping
  for (const [catId, conf] of Object.entries(CATEGORY_PREFIX_MAPPING)) {
    sequenceCounters[catId] = {
      categoryId: catId,
      categoryName: conf.name,
      prefix: conf.prefix,
      lastAssigned: 0,
    };
  }

  for (const [level2Id, prods] of productsByLevel2.entries()) {
    const conf = CATEGORY_PREFIX_MAPPING[level2Id];
    let seq = 0;

    for (const p of prods) {
      seq++;
      const chain = getAncestorChain(p.categoryId);
      const level1 = chain[0];
      const level2 = chain[1];
      const paddedSeq = String(seq).padStart(3, "0");
      const proposedSku = `${conf.prefix}-${paddedSeq}`;

      plan.push({
        id: p.id,
        name: p.name,
        brand: p.brand.name,
        modelNumber: p.modelNumber || "N/A",
        level1Name: level1.name,
        level1Id: level1.id,
        level2Name: level2.name,
        level2Id: level2.id,
        directCategoryName: p.category.name,
        directCategoryId: p.category.id,
        lineage: chain.map((c) => c.name).join(" > "),
        oldSku: p.sku,
        proposedSku,
        sequenceNumber: seq,
        prefix: conf.prefix,
      });
    }

    sequenceCounters[level2Id].lastAssigned = seq;
  }

  // 4. Validate prefix and SKU uniqueness
  const prefixSet = new Set<string>();
  const duplicatePrefixes: string[] = [];
  for (const conf of Object.values(CATEGORY_PREFIX_MAPPING)) {
    if (prefixSet.has(conf.prefix)) {
      duplicatePrefixes.push(conf.prefix);
    }
    prefixSet.add(conf.prefix);
  }

  const skuSet = new Set<string>();
  const duplicateSkus: string[] = [];
  for (const item of plan) {
    if (skuSet.has(item.proposedSku)) {
      duplicateSkus.push(item.proposedSku);
    }
    skuSet.add(item.proposedSku);
  }

  return {
    totalProducts: products.length,
    plannedProducts: plan.length,
    plan,
    unmappedProducts,
    sequenceCounters,
    duplicatePrefixes,
    duplicateSkus,
  };
}

async function main() {
  const isExecute = process.argv.includes("--execute");

  console.log("================================================================================");
  console.log(` SOMRA SKU STANDARDIZATION MIGRATION - ${isExecute ? "EXECUTION MODE" : "DRY RUN MODE"}`);
  console.log("================================================================================\n");

  const results = await planSkuMigration();

  console.log(`Total Products in Database: ${results.totalProducts}`);
  console.log(`Successfully Planned SKUs : ${results.plannedProducts}`);
  console.log(`Unmapped / Error Products : ${results.unmappedProducts.length}\n`);

  if (results.duplicatePrefixes.length > 0) {
    console.error(`FATAL: Duplicate prefixes detected in CATEGORY_PREFIX_MAPPING: ${results.duplicatePrefixes.join(", ")}`);
    process.exit(1);
  }

  if (results.duplicateSkus.length > 0) {
    console.error(`FATAL: Duplicate SKUs generated: ${results.duplicateSkus.join(", ")}`);
    process.exit(1);
  }

  if (results.unmappedProducts.length > 0) {
    console.warn("WARNING: The following products could not be mapped to a Level 2 category prefix:");
    for (const u of results.unmappedProducts) {
      console.warn(` - [${u.id}] ${u.name} | Cat: ${u.directCategory} | Lineage: ${u.lineage} | Reason: ${u.reason}`);
    }
    if (isExecute) {
      console.error("\nExecution aborted because there are unmapped products. Please resolve them first.");
      process.exit(1);
    }
  }

  console.log("--------------------------------------------------------------------------------");
  console.log("CATEGORY SEQUENCES AND LAST ASSIGNED NUMBERS (SkuSequence Initial States):");
  console.log("--------------------------------------------------------------------------------");
  for (const counter of Object.values(results.sequenceCounters)) {
    if (counter.lastAssigned > 0) {
      console.log(` - ${counter.categoryName.padEnd(20)} [${counter.prefix}] : Last Assigned = ${counter.lastAssigned} (ID: ${counter.categoryId})`);
    } else {
      console.log(` - ${counter.categoryName.padEnd(20)} [${counter.prefix}] : Last Assigned = 0 (Ready for future products)`);
    }
  }
  console.log("\n");

  console.log("--------------------------------------------------------------------------------");
  console.log("COMPLETE PRODUCT SKU MAPPING TABLE:");
  console.log("--------------------------------------------------------------------------------");
  const sortedPlan = [...results.plan].sort((a, b) => {
    if (a.level2Name !== b.level2Name) {
      return a.level2Name.localeCompare(b.level2Name);
    }
    return a.sequenceNumber - b.sequenceNumber;
  });

  console.log("| # | Product Name | Category | Old SKU | Proposed SKU |");
  console.log("|---|---|---|---|---|");
  for (const [idx, p] of sortedPlan.entries()) {
    console.log(`| ${idx + 1} | ${p.name.replace(/\|/g, "/")} | ${p.level2Name} (${p.lineage}) | \`${p.oldSku}\` | **\`${p.proposedSku}\`** |`);
  }
  console.log("--------------------------------------------------------------------------------\n");

  if (!isExecute) {
    console.log("================================================================================");
    console.log(" DRY RUN COMPLETED SUCCESSFULLY - NO DATABASE RECORDS WERE MODIFIED");
    console.log("================================================================================");
    console.log("To apply these changes, review the mapping and run with --execute.");
    return;
  }

  // Execution flow (Only run when explicitly passed --execute)
  console.log("Applying SKU changes to database within a single transaction...");
  await prisma.$transaction(
    async (tx) => {
      // Step 1: Temporary prefix to avoid unique constraint collisions during batch update
      // Strictly modifies ONLY the `sku` column
      for (const item of results.plan) {
        await tx.product.update({
          where: { id: item.id },
          data: { sku: `TEMP_${item.id}_${Date.now()}` },
        });
      }

      // Step 2: Assign proposed standardized SKUs
      // Strictly modifies ONLY the `sku` column
      for (const item of results.plan) {
        await tx.product.update({
          where: { id: item.id },
          data: { sku: item.proposedSku },
        });
      }
    },
    {
      maxWait: 15000, // 15 seconds to acquire a connection from the pool
      timeout: 60000, // 60 seconds total execution timeout for 124 sequential updates
    }
  );

  console.log("================================================================================");
  console.log(` SUCCESS: ${results.plan.length} products updated with standardized SKUs.`);
  console.log("================================================================================");
}

if (process.argv[1]?.includes("migrate-product-skus")) {
  main()
    .catch((e) => {
      console.error("Migration error:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
