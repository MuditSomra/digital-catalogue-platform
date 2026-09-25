import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

/**
 * Checks if all required Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured(): boolean {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Initializes and configures the Cloudinary SDK.
 */
export function getCloudinaryClient() {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  duration?: number;
}

/**
 * Uploads an image buffer or base64 string to Cloudinary.
 */
export async function uploadImageToCloudinary(
  fileBuffer: Buffer | string,
  options: {
    folder?: string;
    publicId?: string;
    tags?: string[];
  } = {}
): Promise<CloudinaryUploadResult> {
  const client = getCloudinaryClient();
  const folder = options.folder || "kitchen-showroom/products/images";

  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder,
        public_id: options.publicId,
        resource_type: "image",
        tags: options.tags || ["product_image"],
        transformation: [
          { quality: "auto:good", fetch_format: "auto" },
        ],
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          return reject(
            new Error(error?.message || "Failed to upload image to Cloudinary.")
          );
        }

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    if (Buffer.isBuffer(fileBuffer)) {
      uploadStream.end(fileBuffer);
    } else {
      // If base64 or data URI string
      client.uploader
        .upload(fileBuffer, {
          folder,
          public_id: options.publicId,
          resource_type: "image",
          tags: options.tags || ["product_image"],
          transformation: [{ quality: "auto:good", fetch_format: "auto" }],
        })
        .then((result) => {
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        })
        .catch((err) => {
          reject(new Error(err?.message || "Failed to upload image to Cloudinary."));
        });
    }
  });
}

/**
 * Uploads a video buffer or base64 string to Cloudinary for short demo clips.
 */
export async function uploadVideoToCloudinary(
  fileBuffer: Buffer | string,
  options: {
    folder?: string;
    publicId?: string;
    tags?: string[];
  } = {}
): Promise<CloudinaryUploadResult> {
  const client = getCloudinaryClient();
  const folder = options.folder || "kitchen-showroom/products/videos";

  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder,
        public_id: options.publicId,
        resource_type: "video",
        tags: options.tags || ["product_video"],
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          return reject(
            new Error(error?.message || "Failed to upload video to Cloudinary.")
          );
        }

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          duration: result.duration,
        });
      }
    );

    if (Buffer.isBuffer(fileBuffer)) {
      uploadStream.end(fileBuffer);
    } else {
      client.uploader
        .upload(fileBuffer, {
          folder,
          public_id: options.publicId,
          resource_type: "video",
          tags: options.tags || ["product_video"],
        })
        .then((result) => {
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            duration: result.duration,
          });
        })
        .catch((err) => {
          reject(new Error(err?.message || "Failed to upload video to Cloudinary."));
        });
    }
  });
}

/**
 * Deletes an asset (image or video) from Cloudinary.
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<boolean> {
  if (!isCloudinaryConfigured()) return true;

  try {
    const client = getCloudinaryClient();
    const result = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result.result === "ok" || result.result === "not found";
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    return false;
  }
}

/**
 * Generates an optimized Cloudinary delivery URL with specified dimensions and quality.
 */
export function getOptimizedImageUrl(
  urlOrPublicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: "fill" | "fit" | "limit" | "thumb" | "scale";
    quality?: "auto" | "auto:good" | "auto:eco" | number;
    format?: "auto" | "webp" | "avif" | "jpg";
  } = {}
): string {
  if (!urlOrPublicId) return "";

  // If already full remote URL
  if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://")) {
    if (!urlOrPublicId.includes("res.cloudinary.com")) {
      return urlOrPublicId;
    }
  }

  const {
    width = 600,
    height = 600,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options;

  if (isCloudinaryConfigured()) {
    try {
      const client = getCloudinaryClient();
      return client.url(urlOrPublicId, {
        transformation: [
          { width, height, crop },
          { quality, fetch_format: format },
        ],
        secure: true,
      });
    } catch {
      return urlOrPublicId;
    }
  }

  return urlOrPublicId;
}
