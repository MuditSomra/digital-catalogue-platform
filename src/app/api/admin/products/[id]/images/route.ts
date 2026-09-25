import { NextRequest } from "next/server";
import {
  getProductImages,
  createProductImage,
  MediaServiceError,
} from "@/lib/media-service";
import { createProductImageSchema } from "@/validations/media";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/cloudinary";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const images = await getProductImages(id);
    return handleApiSuccess(images);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    const contentType = request.headers.get("content-type") || "";

    // Multipart Form Data (File Upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const altText = (formData.get("altText") as string) || undefined;
      const isPrimary = formData.get("isPrimary") === "true";

      if (!file) {
        throw new MediaServiceError("No image file was provided for upload.", 400);
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new MediaServiceError(
          `Invalid file format (${file.type}). Supported formats: JPG, JPEG, PNG, and WebP.`,
          400
        );
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new MediaServiceError(
          `Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 10MB.`,
          400
        );
      }

      if (!isCloudinaryConfigured()) {
        throw new MediaServiceError(
          "Cloudinary credentials are not configured on the server. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
          503
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadResult = await uploadImageToCloudinary(buffer, {
        folder: `kitchen-showroom/products/${productId}/images`,
      });

      const newImage = await createProductImage(productId, {
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        altText: altText || file.name.replace(/\.[^/.]+$/, ""),
        isPrimary,
      });

      return handleApiSuccess(newImage, 201);
    }

    // Direct JSON Payload (e.g. pre-uploaded or existing URL)
    const body = await request.json();
    const validatedData = createProductImageSchema.parse(body);
    const newImage = await createProductImage(productId, validatedData);

    return handleApiSuccess(newImage, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
