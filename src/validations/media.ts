import { z } from "zod";
import { VideoType } from "@prisma/client";

/**
 * Extracts YouTube 11-character video ID from various YouTube URL formats.
 * Handles:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - https://m.youtube.com/watch?v=dQw4w9WgXcQ
 * - Direct 11-char ID: dQw4w9WgXcQ
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // If already an 11-character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex matching various YouTube URL patterns
  const match = trimmed.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );

  return match ? match[1] : null;
}

/**
 * Normalizes YouTube video URL to standard embed and watch URLs.
 */
export function normalizeYouTubeVideo(urlOrId: string) {
  const videoId = extractYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  return {
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

// ------------------------------------------------------------------------------
// IMAGE SCHEMAS
// ------------------------------------------------------------------------------

export const createProductImageSchema = z.object({
  url: z.string().trim().url("Please provide a valid image URL"),
  publicId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  altText: z
    .string()
    .trim()
    .max(255, "Alt text cannot exceed 255 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isPrimary: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional(),
});

export const updateProductImageSchema = z.object({
  altText: z
    .string()
    .trim()
    .max(255, "Alt text cannot exceed 255 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ------------------------------------------------------------------------------
// VIDEO SCHEMAS
// ------------------------------------------------------------------------------

export const createProductVideoSchema = z
  .object({
    videoType: z.nativeEnum(VideoType, {
      errorMap: () => ({ message: "Video type must be either CLOUDINARY or YOUTUBE" }),
    }),
    url: z.string().trim().min(1, "Video URL or Identifier is required"),
    title: z
      .string()
      .trim()
      .max(255, "Title cannot exceed 255 characters")
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (data) => {
      if (data.videoType === VideoType.YOUTUBE) {
        const id = extractYouTubeVideoId(data.url);
        return id !== null;
      }
      return true;
    },
    {
      message: "Please enter a valid YouTube video URL or 11-character video ID.",
      path: ["url"],
    }
  );

export const updateProductVideoSchema = z
  .object({
    videoType: z.nativeEnum(VideoType).optional(),
    url: z.string().trim().min(1, "Video URL is required").optional(),
    title: z
      .string()
      .trim()
      .max(255, "Title cannot exceed 255 characters")
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (data) => {
      if (data.url && data.videoType === VideoType.YOUTUBE) {
        const id = extractYouTubeVideoId(data.url);
        return id !== null;
      }
      return true;
    },
    {
      message: "Please enter a valid YouTube video URL or 11-character video ID.",
      path: ["url"],
    }
  );

// ------------------------------------------------------------------------------
// REORDER SCHEMA
// ------------------------------------------------------------------------------

export const reorderMediaSchema = z.object({
  ids: z
    .array(z.string().trim().min(1, "Invalid media ID"))
    .min(1, "At least one media ID is required for reordering"),
});

export type CreateProductImageInput = z.input<typeof createProductImageSchema>;
export type UpdateProductImageInput = z.input<typeof updateProductImageSchema>;
export type CreateProductVideoInput = z.input<typeof createProductVideoSchema>;
export type UpdateProductVideoInput = z.input<typeof updateProductVideoSchema>;
export type ReorderMediaInput = z.input<typeof reorderMediaSchema>;
