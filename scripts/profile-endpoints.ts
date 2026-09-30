import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getCatalogueProducts } from "../src/lib/catalogue-service";
import { getBrands } from "../src/lib/product-service";
import { getCatalogueCategoriesTree } from "../src/lib/category-service";
import {
  authenticateAdmin,
  validateSession,
  verifyPassword,
  hashPassword,
  checkLoginRateLimit,
  ensureAdminUserExists,
  generateSecureToken,
  hashToken,
} from "../src/lib/auth-service";

async function profileDatabaseLatency() {
  console.log("\n=======================================================");
  console.log("=== 0. SUPABASE DATABASE NETWORK LATENCY (ROUNDTRIP) ===");
  console.log("=======================================================");

  // Measure initial connection latency (cold connection initialization)
  const t0 = performance.now();
  await prisma.$queryRaw`SELECT 1 as ping`;
  const tColdPing = performance.now() - t0;
  console.log(`- Initial DB Connection / Ping (SELECT 1): ${tColdPing.toFixed(2)} ms`);

  // Measure 5 consecutive roundtrips (warm TCP/TLS connection)
  const pings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await prisma.$queryRaw`SELECT 1 as ping`;
    pings.push(performance.now() - t);
  }
  const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
  console.log(`- Consecutive Warm Pings: [${pings.map((p) => p.toFixed(1)).join(", ")}] ms`);
  console.log(`- Average Network Roundtrip per SQL Query: ${avgPing.toFixed(2)} ms`);
}

async function profileProducts() {
  console.log("\n=======================================================");
  console.log("=== 1. PROFILE: /api/catalogue/products ===");
  console.log("=======================================================");

  // Cold call
  console.log("\n[Cold Query]:");
  const t0 = performance.now();
  const resCold = await getCatalogueProducts({ page: 1, limit: 12, sortBy: "featured" });
  const tCold = performance.now() - t0;
  console.log(`- Cold getCatalogueProducts Total: ${tCold.toFixed(2)} ms`);

  // Warm call
  console.log("\n[Warm Query]:");
  const t1 = performance.now();
  const resWarm = await getCatalogueProducts({ page: 1, limit: 12, sortBy: "featured" });
  const tWarm = performance.now() - t1;
  console.log(`- Warm getCatalogueProducts Total: ${tWarm.toFixed(2)} ms`);

  // Search call
  console.log("\n[Search Query ('Genial')]:");
  const t2 = performance.now();
  const resSearch = await getCatalogueProducts({ search: "Genial", page: 1, limit: 12 });
  const tSearch = performance.now() - t2;
  console.log(`- Search getCatalogueProducts Total: ${tSearch.toFixed(2)} ms`);

  // Category filter call
  const allCats = await prisma.category.findMany({ take: 1 });
  const sampleCatId = allCats[0]?.id;
  if (sampleCatId) {
    console.log(`\n[Category Filter Query (${sampleCatId})]:`);
    const t3 = performance.now();
    await getCatalogueProducts({ categoryId: sampleCatId, page: 1, limit: 12 });
    const tCat = performance.now() - t3;
    console.log(`- Category Filter Total: ${tCat.toFixed(2)} ms`);
  }
}

async function profileBrands() {
  console.log("\n=======================================================");
  console.log("=== 2. PROFILE: /api/catalogue/brands ===");
  console.log("=======================================================");

  const t0 = performance.now();
  const brands = await getBrands();
  const tTotal = performance.now() - t0;
  console.log(`- Brands Returned: ${brands.length}`);
  console.log(`- Database Query Time: ${tTotal.toFixed(2)} ms`);
}

async function profileCategories() {
  console.log("\n=======================================================");
  console.log("=== 3. PROFILE: /api/catalogue/categories ===");
  console.log("=======================================================");

  const t0 = performance.now();
  const tree = await getCatalogueCategoriesTree();
  const tTotal = performance.now() - t0;
  console.log(`- Root Categories Returned: ${tree.length}`);
  console.log(`- Tree Generation Total: ${tTotal.toFixed(2)} ms`);
}

async function profileLoginAndSession() {
  console.log("\n=======================================================");
  console.log("=== 4. PROFILE: /api/auth/login & /api/auth/session ===");
  console.log("=======================================================");

  // 1. Measure CPU cost of crypto.scryptSync password hashing/verification
  const tScrypt0 = performance.now();
  const dummyHash = hashPassword("TestPassword123!");
  const tHashGen = performance.now() - tScrypt0;
  console.log(`- CPU Hashing (crypto.scryptSync hash): ${tHashGen.toFixed(2)} ms`);

  const tVerify0 = performance.now();
  verifyPassword("TestPassword123!", dummyHash);
  const tVerify = performance.now() - tVerify0;
  console.log(`- CPU Verification (crypto.scryptSync verify): ${tVerify.toFixed(2)} ms`);

  // 2. Measure individual DB operations during Login
  const existingUser = await prisma.adminUser.findFirst({ where: { isActive: true } });
  console.log(`\n[Login Sub-Operation Step-by-Step Timings]:`);

  // Step A: ensureAdminUserExists
  const tEnsure0 = performance.now();
  await ensureAdminUserExists();
  const tEnsure = performance.now() - tEnsure0;
  console.log(`- Step 1 (ensureAdminUserExists DB lookup): ${tEnsure.toFixed(2)} ms`);

  // Step B: checkLoginRateLimit
  const tRate0 = performance.now();
  await checkLoginRateLimit(existingUser?.email || "admin@example.com");
  const tRate = performance.now() - tRate0;
  console.log(`- Step 2 (checkLoginRateLimit DB lookup): ${tRate.toFixed(2)} ms`);

  // Step C: findUnique AdminUser
  const tUser0 = performance.now();
  const user = await prisma.adminUser.findUnique({
    where: { email: existingUser?.email || "admin@example.com" },
  });
  const tUser = performance.now() - tUser0;
  console.log(`- Step 3 (User DB lookup by email): ${tUser.toFixed(2)} ms`);

  // Step D: Password Verification
  const tPass0 = performance.now();
  if (user?.passwordHash) {
    verifyPassword("DummyPassword123!", user.passwordHash);
  }
  const tPass = performance.now() - tPass0;
  console.log(`- Step 4 (Password hash verification): ${tPass.toFixed(2)} ms`);

  // Step E: Session creation DB write
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 3600 * 1000);

  const tSessCreate0 = performance.now();
  let createdSession = null;
  if (user) {
    createdSession = await prisma.session.create({
      data: {
        sessionTokenHash: tokenHash,
        adminUserId: user.id,
        isTrustedDevice: false,
        deviceLabel: "Benchmark Browser",
        lastActiveAt: now,
        expiresAt,
        isRevoked: false,
      },
    });
  }
  const tSessCreate = performance.now() - tSessCreate0;
  console.log(`- Step 5 (Session DB write INSERT): ${tSessCreate.toFixed(2)} ms`);

  // Total sequential login operations sum
  const loginTotalEstimated = tEnsure + tRate + tUser + tPass + tSessCreate;
  console.log(`- Cumulative Sequential Login Execution Time: ${loginTotalEstimated.toFixed(2)} ms (5 sequential DB roundtrips + CPU hash)`);

  // 3. Profile Session Validation
  console.log(`\n[Session Validation Step-by-Step Timings]:`);
  const tSessLookup0 = performance.now();
  const sessValidation = await validateSession(token);
  const tSessLookup = performance.now() - tSessLookup0;
  console.log(`- validateSession DB lookup (findUnique with join): ${tSessLookup.toFixed(2)} ms`);
  console.log(`- Session Valid: ${sessValidation.isValid}`);

  // Clean up benchmark session
  if (createdSession) {
    await prisma.session.delete({ where: { id: createdSession.id } }).catch(() => {});
  }
}

async function runAll() {
  try {
    await profileDatabaseLatency();
    await profileProducts();
    await profileBrands();
    await profileCategories();
    await profileLoginAndSession();
  } catch (err) {
    console.error("Profiling error:", err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runAll();
