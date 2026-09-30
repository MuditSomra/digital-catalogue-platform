/**
 * Client-safe Cloudinary URL Optimization Utilities.
 * Contains pure URL transformation functions with zero Node.js / fs dependencies,
 * making it 100% safe to use in both Server Components and Client Components ("use client").
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "thumb" | "scale" | "pad";
  quality?: "auto" | "auto:good" | "auto:eco" | "auto:best" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
}

/**
 * Generates an optimized Cloudinary delivery URL with specified dimensions and quality.
 * Transforms remote Cloudinary URLs or public IDs on the fly.
 */
export function getOptimizedImageUrl(
  urlOrPublicId: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!urlOrPublicId) return "";

  const {
    width = 600,
    height = 600,
    crop = "fill",
    quality = "auto:good",
    format = "auto",
  } = options;

  const transformParts: string[] = [];
  if (crop) transformParts.push(`c_${crop}`);
  if (width) transformParts.push(`w_${width}`);
  if (height) transformParts.push(`h_${height}`);
  if (quality) transformParts.push(`q_${quality}`);
  if (format) transformParts.push(`f_${format}`);
  const transformSegment = transformParts.join(",");

  // 1. If already a full Cloudinary URL
  if (urlOrPublicId.includes("res.cloudinary.com")) {
    const uploadIndex = urlOrPublicId.indexOf("/image/upload/");
    if (uploadIndex !== -1) {
      const prefix = urlOrPublicId.substring(0, uploadIndex + "/image/upload/".length);
      const rest = urlOrPublicId.substring(uploadIndex + "/image/upload/".length);

      // Check if `rest` starts with existing transformation params (e.g. "w_...,h_.../")
      const slashIndex = rest.indexOf("/");
      if (slashIndex !== -1) {
        const firstSegment = rest.substring(0, slashIndex);
        if (/^[a-z]_[a-zA-Z0-9_:,]+/.test(firstSegment) && !/^v\d+$/.test(firstSegment)) {
          const remainder = rest.substring(slashIndex + 1);
          return `${prefix}${transformSegment}/${remainder}`;
        }
      }

      return `${prefix}${transformSegment}/${rest}`;
    }
    return urlOrPublicId;
  }

  // 2. If it's a non-Cloudinary remote URL
  if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://")) {
    return urlOrPublicId;
  }

  // 3. If it's a Cloudinary publicId
  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    "qcxiqaao";

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformSegment}/${urlOrPublicId}`;
}
