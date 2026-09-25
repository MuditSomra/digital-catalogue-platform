import { prisma } from "../src/lib/prisma";
import {
  getProductImages,
  createProductImage,
  updateProductImage,
  setPrimaryProductImage,
  reorderProductImages,
  deleteProductImage,
  getProductVideos,
  createProductVideo,
  updateProductVideo,
  reorderProductVideos,
  deleteProductVideo,
  MediaServiceError,
} from "../src/lib/media-service";
import {
  extractYouTubeVideoId,
  normalizeYouTubeVideo,
  createProductImageSchema,
  createProductVideoSchema,
} from "../src/validations/media";
import { getProductById, getProducts } from "../src/lib/product-service";
import { VideoType } from "@prisma/client";

async function runPhase5Tests() {
  console.log("============================================================");
  console.log("🧪 RUNNING PHASE 5 AUTOMATED TESTS: PRODUCT MEDIA MANAGEMENT");
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

  // ------------------------------------------------------------
  // UNIT TESTS: YouTube URL extraction & normalization
  // ------------------------------------------------------------
  const standardWatchId = extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const shortUrlId = extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=10");
  const embedUrlId = extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ");
  const shortsUrlId = extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ");
  const directId = extractYouTubeVideoId("dQw4w9WgXcQ");
  const invalidUrl = extractYouTubeVideoId("https://example.com/not-youtube");

  assert(
    standardWatchId === "dQw4w9WgXcQ" &&
      shortUrlId === "dQw4w9WgXcQ" &&
      embedUrlId === "dQw4w9WgXcQ" &&
      shortsUrlId === "dQw4w9WgXcQ" &&
      directId === "dQw4w9WgXcQ" &&
      invalidUrl === null,
    "YouTube URL Regex & ID Extraction",
    "Successfully extracts 11-char ID from watch, short, embed, shorts, and raw ID formats"
  );

  const norm = normalizeYouTubeVideo("https://youtu.be/dQw4w9WgXcQ");
  assert(
    norm !== null &&
      norm.videoId === "dQw4w9WgXcQ" &&
      norm.watchUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ" &&
      norm.thumbnailUrl === "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    "YouTube URL Normalization & Thumbnail Generation",
    `Normalized: ${norm?.watchUrl}, Thumbnail: ${norm?.thumbnailUrl}`
  );

  // ------------------------------------------------------------
  // SETUP: Find or Create Test Product
  // ------------------------------------------------------------
  const brand = await prisma.brand.findFirst();
  if (!brand) throw new Error("Brand not found");

  const category = await prisma.category.findFirst({ where: { name: "Gas Stoves" } });
  if (!category) throw new Error("Gas Stoves category not found");

  const testSku = `TEST-MEDIA-${Date.now()}`;
  const testProduct = await prisma.product.create({
    data: {
      name: "Phase 5 Media Test Cooktop",
      slug: `phase5-media-test-${Date.now()}`,
      sku: testSku,
      modelNumber: "MED-101",
      mrp: 9500,
      sellingPrice: 7999,
      brandId: brand.id,
      categoryId: category.id,
      isActive: true,
    },
  });

  // ------------------------------------------------------------
  // 1. Initial Media State
  // ------------------------------------------------------------
  const initialImages = await getProductImages(testProduct.id);
  const initialVideos = await getProductVideos(testProduct.id);
  assert(
    initialImages.length === 0 && initialVideos.length === 0,
    "Initial Media State Empty",
    "Product initialized with 0 images and 0 videos"
  );

  // ------------------------------------------------------------
  // 2. Add First Image (Auto-Primary)
  // ------------------------------------------------------------
  const img1 = await createProductImage(testProduct.id, {
    url: "https://res.cloudinary.com/demo/image/upload/v1/cooktop-front.jpg",
    publicId: "cooktop-front",
    altText: "Front view of Cooktop",
  });
  assert(
    img1.productId === testProduct.id && img1.isPrimary === true && img1.sortOrder === 0,
    "First Image Automatically Set as Primary",
    `Image ID: ${img1.id}, isPrimary: true, sortOrder: 0`
  );

  // ------------------------------------------------------------
  // 3. Add Second Image (isPrimary = false)
  // ------------------------------------------------------------
  const img2 = await createProductImage(testProduct.id, {
    url: "https://res.cloudinary.com/demo/image/upload/v1/cooktop-angle.jpg",
    publicId: "cooktop-angle",
    altText: "Angled view showing stainless steel burners",
    isPrimary: false,
  });
  assert(
    img2.isPrimary === false && img2.sortOrder === 1,
    "Second Image Added with isPrimary=false",
    `Image 2 ID: ${img2.id}, isPrimary: false, sortOrder: 1`
  );

  // Verify img1 is still primary
  const imagesAfterSecond = await getProductImages(testProduct.id);
  const currentPrimary = imagesAfterSecond.find((img) => img.isPrimary);
  assert(
    currentPrimary?.id === img1.id,
    "Primary Image Unchanged when adding non-primary image",
    `Primary image remains img1 (${img1.id})`
  );

  // ------------------------------------------------------------
  // 4. Add Third Image with isPrimary = true (Demotes img1)
  // ------------------------------------------------------------
  const img3 = await createProductImage(testProduct.id, {
    url: "https://res.cloudinary.com/demo/image/upload/v1/cooktop-top.jpg",
    publicId: "cooktop-top",
    altText: "Top down view",
    isPrimary: true,
  });
  const imagesAfterThird = await getProductImages(testProduct.id);
  const primaryAfterThird = imagesAfterThird.find((img) => img.isPrimary);
  const img1AfterThird = imagesAfterThird.find((img) => img.id === img1.id);
  assert(
    primaryAfterThird?.id === img3.id && img1AfterThird?.isPrimary === false,
    "New Primary Image Automatically Demotes Previous Primary",
    `Primary is now img3 (${img3.id}), img1 isPrimary: false`
  );

  // ------------------------------------------------------------
  // 5. Explicitly Set Primary Image (setPrimaryProductImage)
  // ------------------------------------------------------------
  await setPrimaryProductImage(testProduct.id, img2.id);
  const imagesAfterSetPrimary = await getProductImages(testProduct.id);
  const activePrimary = imagesAfterSetPrimary.find((img) => img.isPrimary);
  assert(
    activePrimary?.id === img2.id,
    "Explicit Set Primary Image",
    `Primary successfully changed to img2 (${img2.id})`
  );

  // ------------------------------------------------------------
  // 6. Image Reordering
  // ------------------------------------------------------------
  // Current order: img1 (0), img2 (1), img3 (2)
  // Reorder to: [img3.id, img1.id, img2.id]
  const reorderedImages = await reorderProductImages(testProduct.id, [
    img3.id,
    img1.id,
    img2.id,
  ]);
  assert(
    reorderedImages[0].id === img3.id &&
      reorderedImages[1].id === img1.id &&
      reorderedImages[2].id === img2.id &&
      reorderedImages[0].sortOrder === 0 &&
      reorderedImages[1].sortOrder === 1 &&
      reorderedImages[2].sortOrder === 2,
    "Image Reordering Preserves Requested Sequence",
    `New order: [img3 (0), img1 (1), img2 (2)]`
  );

  // ------------------------------------------------------------
  // 7. Update Image Metadata (altText)
  // ------------------------------------------------------------
  const updatedImg = await updateProductImage(testProduct.id, img1.id, {
    altText: "Updated high-resolution burner close-up",
  });
  assert(
    updatedImg.altText === "Updated high-resolution burner close-up",
    "Update Image Alt Text Metadata",
    `Alt text updated: "${updatedImg.altText}"`
  );

  // ------------------------------------------------------------
  // 8. Delete Non-Primary Image
  // ------------------------------------------------------------
  const delNonPrimaryResult = await deleteProductImage(testProduct.id, img1.id);
  const imagesAfterDel = await getProductImages(testProduct.id);
  assert(
    delNonPrimaryResult.success &&
      imagesAfterDel.length === 2 &&
      !imagesAfterDel.some((img) => img.id === img1.id),
    "Delete Non-Primary Image",
    `Deleted img1. Remaining count: ${imagesAfterDel.length}`
  );

  // ------------------------------------------------------------
  // 9. Delete Primary Image (Auto-promotes Next Image to Primary)
  // ------------------------------------------------------------
  // Current images: img3 (sortOrder 0, isPrimary false), img2 (sortOrder 2, isPrimary true)
  const delPrimaryResult = await deleteProductImage(testProduct.id, img2.id);
  const imagesAfterPrimaryDel = await getProductImages(testProduct.id);
  assert(
    delPrimaryResult.success &&
      imagesAfterPrimaryDel.length === 1 &&
      imagesAfterPrimaryDel[0].id === img3.id &&
      imagesAfterPrimaryDel[0].isPrimary === true,
    "Delete Primary Image Automatically Promotes Remaining Image",
    `Deleted primary img2. img3 promoted to primary (isPrimary: true)`
  );

  // ------------------------------------------------------------
  // 10. Product Videos: Add YouTube Video
  // ------------------------------------------------------------
  const ytVideo = await createProductVideo(testProduct.id, {
    videoType: VideoType.YOUTUBE,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Product Unboxing & Flame Test",
  });
  assert(
    ytVideo.videoType === VideoType.YOUTUBE &&
      ytVideo.youtubeVideoId === "dQw4w9WgXcQ" &&
      ytVideo.thumbnailUrl === "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" &&
      ytVideo.title === "Product Unboxing & Flame Test",
    "Add YouTube Video with Live Thumbnail",
    `YouTube Video ID: ${ytVideo.youtubeVideoId}, Title: ${ytVideo.title}`
  );

  // ------------------------------------------------------------
  // 11. Product Videos: Add Cloudinary Video Clip
  // ------------------------------------------------------------
  const cloudVideo = await createProductVideo(testProduct.id, {
    videoType: VideoType.CLOUDINARY,
    url: "https://res.cloudinary.com/demo/video/upload/v1/cooktop-clip.mp4",
    title: "15-Second Brass Burner Demo",
  });
  assert(
    cloudVideo.videoType === VideoType.CLOUDINARY &&
      cloudVideo.url.includes("cooktop-clip.mp4") &&
      cloudVideo.title === "15-Second Brass Burner Demo",
    "Add Cloudinary Video Clip",
    `Cloudinary Clip: ${cloudVideo.title}`
  );

  // ------------------------------------------------------------
  // 12. Video Reordering & Listing
  // ------------------------------------------------------------
  const allVideos = await getProductVideos(testProduct.id);
  assert(
    allVideos.length === 2 && allVideos[0].id === ytVideo.id && allVideos[1].id === cloudVideo.id,
    "List Product Videos in Sort Order",
    `Found ${allVideos.length} videos: 1 YouTube, 1 Cloudinary`
  );

  const reorderedVideos = await reorderProductVideos(testProduct.id, [
    cloudVideo.id,
    ytVideo.id,
  ]);
  assert(
    reorderedVideos[0].id === cloudVideo.id && reorderedVideos[1].id === ytVideo.id,
    "Video Reordering",
    `Swapped order: [Cloudinary Clip (0), YouTube Video (1)]`
  );

  // ------------------------------------------------------------
  // 13. Video Metadata Update
  // ------------------------------------------------------------
  const updatedVideo = await updateProductVideo(testProduct.id, ytVideo.id, {
    title: "Official 4K Installation Guide",
  });
  assert(
    updatedVideo.title === "Official 4K Installation Guide",
    "Update Video Title",
    `Updated title: "${updatedVideo.title}"`
  );

  // ------------------------------------------------------------
  // 14. Delete Video
  // ------------------------------------------------------------
  const delVideoResult = await deleteProductVideo(testProduct.id, cloudVideo.id);
  const videosAfterDel = await getProductVideos(testProduct.id);
  assert(
    delVideoResult.success &&
      videosAfterDel.length === 1 &&
      videosAfterDel[0].id === ytVideo.id,
    "Delete Product Video",
    `Deleted Cloudinary clip. Remaining videos: ${videosAfterDel.length}`
  );

  // ------------------------------------------------------------
  // 15. Invalid Input & Error Handling
  // ------------------------------------------------------------
  let invalidProductCaught = false;
  try {
    await getProductImages("non-existent-product-id-12345");
  } catch (err) {
    if (err instanceof MediaServiceError && err.statusCode === 404) {
      invalidProductCaught = true;
    }
  }
  assert(
    invalidProductCaught,
    "Invalid Product ID Returns 404",
    "Request for non-existent product correctly rejected with 404"
  );

  let invalidYtCaught = false;
  try {
    createProductVideoSchema.parse({
      videoType: VideoType.YOUTUBE,
      url: "https://vimeo.com/123456",
      title: "Invalid provider",
    });
  } catch (err) {
    invalidYtCaught = true;
  }
  assert(
    invalidYtCaught,
    "Invalid YouTube URL Rejected by Zod Schema",
    "Non-YouTube URL rejected for YOUTUBE videoType"
  );

  let foreignImageReorderCaught = false;
  try {
    await reorderProductImages(testProduct.id, ["foreign-image-id-999"]);
  } catch (err) {
    if (err instanceof MediaServiceError) {
      foreignImageReorderCaught = true;
    }
  }
  assert(
    foreignImageReorderCaught,
    "Foreign Media in Reorder Rejected",
    "Reorder attempt with media belonging to another product safely rejected"
  );

  // ------------------------------------------------------------
  // 16. Integration: getProductById Includes Media
  // ------------------------------------------------------------
  const productDetail = await getProductById(testProduct.id);
  assert(
    productDetail.images.length === 1 &&
      productDetail.videos.length === 1 &&
      productDetail.images[0].isPrimary === true &&
      productDetail.videos[0].youtubeVideoId === "dQw4w9WgXcQ",
    "getProductById Delivers Complete Media Details",
    `Returned ${productDetail.images.length} images and ${productDetail.videos.length} videos`
  );

  // ------------------------------------------------------------
  // 17. Integration: getProducts Includes Primary Image & Counts
  // ------------------------------------------------------------
  const productList = await getProducts({ search: testSku });
  assert(
    productList.products.length === 1 &&
      productList.products[0].primaryImage !== null &&
      Boolean(productList.products[0].primaryImage?.url.includes("cooktop-top.jpg")) &&
      productList.products[0].imagesCount === 1 &&
      productList.products[0].videosCount === 1,
    "getProducts Includes Primary Thumbnail & Media Counts",
    `Product item has primaryImage thumbnail, imagesCount: 1, videosCount: 1`
  );

  // ------------------------------------------------------------
  // 18. Cleanup Test Product
  // ------------------------------------------------------------
  await prisma.productVideo.deleteMany({ where: { productId: testProduct.id } });
  await prisma.productImage.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  assert(true, "Safe Cleanup of Test Product & Media Records", "Cleaned up test data cleanly");

  // ------------------------------------------------------------
  // 19. Multi-attribute filter regression test (Phase 1 Baseline)
  // ------------------------------------------------------------
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
  console.log(`🎉 ALL ${passCount} PHASE 5 TESTS PASSED SUCCESSFULLY! (100% Pass Rate)`);
  console.log("============================================================\n");
}

runPhase5Tests()
  .catch((err) => {
    console.error("Phase 5 tests failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
