import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getCatalogueProducts, getCatalogueProductDetail } from "../src/lib/catalogue-service";
import { getOptimizedImageUrl } from "../src/lib/cloudinary";

async function runBenchmark() {
  const results: string[] = [];
  results.push("=================================================");
  results.push("      CATALOGUE PERFORMANCE REPORT (PHASE 1)    ");
  results.push("=================================================");

  // Warmup / First listing query
  const start1 = performance.now();
  const listResult1 = await getCatalogueProducts({ page: 1, limit: 12, sortBy: "featured" });
  const dur1 = performance.now() - start1;

  // Warm listing query
  const start2 = performance.now();
  const listResult2 = await getCatalogueProducts({ page: 1, limit: 12, sortBy: "featured" });
  const dur2 = performance.now() - start2;

  const listPayloadStr = JSON.stringify(listResult2);
  const listSizeBytes = Buffer.byteLength(listPayloadStr, "utf8");

  results.push("\n1. CATALOGUE PRODUCT LISTING (12 Products / Page 1)");
  results.push(`   - Returned Products: ${listResult2.products.length}`);
  results.push(`   - Cold DB Response Time: ${dur1.toFixed(2)} ms`);
  results.push(`   - Warm Query Response Time: ${dur2.toFixed(2)} ms`);
  results.push(`   - List Payload Size: ${(listSizeBytes / 1024).toFixed(2)} KB (${listSizeBytes} bytes)`);

  if (listResult2.products.length > 0) {
    const p = listResult2.products[0];
    results.push(`   - Per-Product Data Structure in List:`);
    results.push(`     * Primary Image: ${p.primaryImage ? "Yes (1 primary image)" : "None"}`);
    results.push(`     * Images Array Length: ${p.images.length}`);
    results.push(`     * Videos Array Length: ${p.videos.length} (Omitted from list payload)`);
    results.push(`     * Attributes count: ${p.attributeValues.length}`);
    results.push(`     * Raw Image URL: ${p.primaryImage?.url}`);
    if (p.primaryImage?.url) {
      results.push(`     * Optimized Image URL (500x375 auto): ${getOptimizedImageUrl(p.primaryImage.url, { width: 500, height: 375 })}`);
    }
  }

  // Search query
  const startSearch = performance.now();
  const searchResult = await getCatalogueProducts({ search: "Genial", page: 1, limit: 12 });
  const durSearch = performance.now() - startSearch;

  results.push("\n2. CATALOGUE SEARCH QUERY ('Genial')");
  results.push(`   - Matches Found: ${searchResult.products.length}`);
  results.push(`   - Search Query Response Time: ${durSearch.toFixed(2)} ms`);

  // Product detail query
  if (listResult2.products.length > 0) {
    const sampleId = listResult2.products[0].id;
    const startDetail = performance.now();
    const detail = await getCatalogueProductDetail(sampleId);
    const durDetail = performance.now() - startDetail;
    const detailSizeBytes = Buffer.byteLength(JSON.stringify(detail), "utf8");

    results.push(`\n3. PRODUCT DETAIL QUERY (${sampleId})`);
    results.push(`   - Product Name: ${detail?.name}`);
    results.push(`   - Detail Response Time: ${durDetail.toFixed(2)} ms`);
    results.push(`   - Detail Payload Size: ${(detailSizeBytes / 1024).toFixed(2)} KB (${detailSizeBytes} bytes)`);
    results.push(`   - Detail Images: ${detail?.images.length}`);
    results.push(`   - Detail Videos: ${detail?.videos.length}`);
    results.push(`   - Breadcrumb Trail: ${detail?.category?.breadcrumbs?.map(b => b.name).join(" > ")}`);
    results.push(`   - Similar Products: ${detail?.similarProducts?.length || 0}`);
  }

  results.push("\n=================================================");

  console.log(results.join("\n"));
  await prisma.$disconnect();
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
