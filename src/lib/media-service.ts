import { prisma } from "./prisma";
import { VideoType } from "@prisma/client";
import {
  extractYouTubeVideoId,
  normalizeYouTubeVideo,
  CreateProductImageInput,
  UpdateProductImageInput,
  CreateProductVideoInput,
  UpdateProductVideoInput,
} from "../validations/media";
import { deleteFromCloudinary } from "./cloudinary";
import type { ProductImageItem, ProductVideoItem } from "../types";

/**
 * Custom error for media management operations.
 */
export class MediaServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "MediaServiceError";
  }
}

/**
 * Ensures the target product exists in database.
 */
async function ensureProductExists(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new MediaServiceError("The specified product was not found.", 404);
  }

  return product;
}

// ==============================================================================
// 1. PRODUCT IMAGES
// ==============================================================================

/**
 * Retrieves all images for a product in display order.
 */
export async function getProductImages(productId: string): Promise<ProductImageItem[]> {
  await ensureProductExists(productId);

  return prisma.productImage.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Adds an image to a product.
 * Automatically marks as primary if it is the first image for the product.
 */
export async function createProductImage(
  productId: string,
  input: CreateProductImageInput
): Promise<ProductImageItem> {
  await ensureProductExists(productId);

  const existingImages = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "desc" },
  });

  const isFirstImage = existingImages.length === 0;
  const shouldBePrimary = isFirstImage || Boolean(input.isPrimary);
  const nextSortOrder =
    input.sortOrder !== undefined
      ? input.sortOrder
      : existingImages.length > 0
      ? existingImages[0].sortOrder + 1
      : 0;

  return prisma.$transaction(async (tx) => {
    // If setting as primary, demote existing primary images
    if (shouldBePrimary) {
      await tx.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const created = await tx.productImage.create({
      data: {
        productId,
        url: input.url,
        publicId: input.publicId || null,
        altText: input.altText || null,
        sortOrder: nextSortOrder,
        isPrimary: shouldBePrimary,
      },
    });

    return created;
  });
}

/**
 * Updates an image's metadata (alt text, primary flag).
 */
export async function updateProductImage(
  productId: string,
  imageId: string,
  input: UpdateProductImageInput
): Promise<ProductImageItem> {
  await ensureProductExists(productId);

  const existingImage = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!existingImage) {
    throw new MediaServiceError("Product image not found.", 404);
  }

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary === true) {
      await tx.productImage.updateMany({
        where: { productId, isPrimary: true, id: { not: imageId } },
        data: { isPrimary: false },
      });
    }

    const updated = await tx.productImage.update({
      where: { id: imageId },
      data: {
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    return updated;
  });
}

/**
 * Sets an image as the primary image for a product.
 */
export async function setPrimaryProductImage(
  productId: string,
  imageId: string
): Promise<ProductImageItem> {
  return updateProductImage(productId, imageId, { isPrimary: true });
}

/**
 * Reorders product images based on an array of image IDs in desired order.
 */
export async function reorderProductImages(
  productId: string,
  imageIds: string[]
): Promise<ProductImageItem[]> {
  await ensureProductExists(productId);

  const currentImages = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
  });

  const currentIdSet = new Set(currentImages.map((img) => img.id));
  for (const id of imageIds) {
    if (!currentIdSet.has(id)) {
      throw new MediaServiceError(
        `Image with ID "${id}" does not belong to this product.`,
        400
      );
    }
  }

  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return getProductImages(productId);
}

/**
 * Deletes an image from a product and Cloudinary.
 * If the deleted image was primary, automatically promotes the next image in sequence.
 */
export async function deleteProductImage(
  productId: string,
  imageId: string
): Promise<{ success: boolean; deletedImageId: string; promotedPrimaryId?: string }> {
  await ensureProductExists(productId);

  const imageToDelete = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!imageToDelete) {
    throw new MediaServiceError("Product image not found.", 404);
  }

  // Delete from database in transaction
  let promotedPrimaryId: string | undefined;

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({
      where: { id: imageId },
    });

    // If deleted image was primary, promote next available image
    if (imageToDelete.isPrimary) {
      const nextImage = await tx.productImage.findFirst({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      if (nextImage) {
        await tx.productImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
        promotedPrimaryId = nextImage.id;
      }
    }
  });

  // Attempt Cloudinary cleanup in background (fail-safe)
  if (imageToDelete.publicId) {
    deleteFromCloudinary(imageToDelete.publicId, "image").catch((err) => {
      console.warn(`Failed to delete asset ${imageToDelete.publicId} from Cloudinary:`, err);
    });
  }

  return { success: true, deletedImageId: imageId, promotedPrimaryId };
}

// ==============================================================================
// 2. PRODUCT VIDEOS (Cloudinary & YouTube)
// ==============================================================================

/**
 * Formats a raw Prisma ProductVideo record with computed properties.
 */
function formatVideoItem(video: {
  id: string;
  productId: string;
  videoType: VideoType;
  url: string;
  title: string | null;
  sortOrder: number;
  createdAt: Date;
}): ProductVideoItem {
  let thumbnailUrl: string | undefined;
  let youtubeVideoId: string | null = null;

  if (video.videoType === VideoType.YOUTUBE) {
    youtubeVideoId = extractYouTubeVideoId(video.url);
    if (youtubeVideoId) {
      thumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
    }
  }

  return {
    ...video,
    thumbnailUrl,
    youtubeVideoId,
  };
}

/**
 * Retrieves all videos for a product in display order.
 */
export async function getProductVideos(productId: string): Promise<ProductVideoItem[]> {
  await ensureProductExists(productId);

  const rawVideos = await prisma.productVideo.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rawVideos.map(formatVideoItem);
}

/**
 * Creates a new video record (YouTube URL or Cloudinary clip).
 */
export async function createProductVideo(
  productId: string,
  input: CreateProductVideoInput
): Promise<ProductVideoItem> {
  await ensureProductExists(productId);

  let finalUrl = input.url.trim();

  if (input.videoType === VideoType.YOUTUBE) {
    const normalized = normalizeYouTubeVideo(input.url);
    if (!normalized) {
      throw new MediaServiceError(
        "Please enter a valid YouTube video URL or 11-character video ID.",
        400
      );
    }
    finalUrl = normalized.watchUrl;
  }

  const existingVideos = await prisma.productVideo.findMany({
    where: { productId },
    orderBy: { sortOrder: "desc" },
  });

  const nextSortOrder =
    input.sortOrder !== undefined
      ? input.sortOrder
      : existingVideos.length > 0
      ? existingVideos[0].sortOrder + 1
      : 0;

  const created = await prisma.productVideo.create({
    data: {
      productId,
      videoType: input.videoType,
      url: finalUrl,
      title: input.title || null,
      sortOrder: nextSortOrder,
    },
  });

  return formatVideoItem(created);
}

/**
 * Updates a video's metadata (title, URL, videoType).
 */
export async function updateProductVideo(
  productId: string,
  videoId: string,
  input: UpdateProductVideoInput
): Promise<ProductVideoItem> {
  await ensureProductExists(productId);

  const existingVideo = await prisma.productVideo.findFirst({
    where: { id: videoId, productId },
  });

  if (!existingVideo) {
    throw new MediaServiceError("Product video not found.", 404);
  }

  let finalUrl = input.url !== undefined ? input.url.trim() : existingVideo.url;
  const finalType = input.videoType || existingVideo.videoType;

  if (finalType === VideoType.YOUTUBE && input.url !== undefined) {
    const normalized = normalizeYouTubeVideo(finalUrl);
    if (!normalized) {
      throw new MediaServiceError(
        "Please enter a valid YouTube video URL or 11-character video ID.",
        400
      );
    }
    finalUrl = normalized.watchUrl;
  }

  const updated = await prisma.productVideo.update({
    where: { id: videoId },
    data: {
      ...(input.videoType !== undefined ? { videoType: input.videoType } : {}),
      ...(input.url !== undefined ? { url: finalUrl } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  return formatVideoItem(updated);
}

/**
 * Reorders product videos based on an array of video IDs in desired order.
 */
export async function reorderProductVideos(
  productId: string,
  videoIds: string[]
): Promise<ProductVideoItem[]> {
  await ensureProductExists(productId);

  const currentVideos = await prisma.productVideo.findMany({
    where: { productId },
    select: { id: true },
  });

  const currentIdSet = new Set(currentVideos.map((v) => v.id));
  for (const id of videoIds) {
    if (!currentIdSet.has(id)) {
      throw new MediaServiceError(
        `Video with ID "${id}" does not belong to this product.`,
        400
      );
    }
  }

  await prisma.$transaction(
    videoIds.map((id, index) =>
      prisma.productVideo.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return getProductVideos(productId);
}

/**
 * Deletes a video from a product.
 */
export async function deleteProductVideo(
  productId: string,
  videoId: string
): Promise<{ success: boolean; deletedVideoId: string }> {
  await ensureProductExists(productId);

  const videoToDelete = await prisma.productVideo.findFirst({
    where: { id: videoId, productId },
  });

  if (!videoToDelete) {
    throw new MediaServiceError("Product video not found.", 404);
  }

  await prisma.productVideo.delete({
    where: { id: videoId },
  });

  return { success: true, deletedVideoId: videoId };
}
