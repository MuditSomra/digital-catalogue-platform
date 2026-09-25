import { NextRequest } from "next/server";
import {
  getProductVideos,
  createProductVideo,
  MediaServiceError,
} from "@/lib/media-service";
import { createProductVideoSchema } from "@/validations/media";
import { isCloudinaryConfigured, uploadVideoToCloudinary } from "@/lib/cloudinary";
import { VideoType } from "@prisma/client";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB for short demo clips

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const videos = await getProductVideos(id);
    return handleApiSuccess(videos);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    const contentType = request.headers.get("content-type") || "";

    // Multipart Form Data (Video File Upload to Cloudinary)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const title = (formData.get("title") as string) || undefined;

      if (!file) {
        throw new MediaServiceError("No video file was provided for upload.", 400);
      }

      if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
        throw new MediaServiceError(
          `Invalid video format (${file.type}). Supported formats: MP4, WebM, and MOV.`,
          400
        );
      }

      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        throw new MediaServiceError(
          `Video file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size for direct uploads is 50MB. For larger videos, please use a YouTube video link.`,
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

      const uploadResult = await uploadVideoToCloudinary(buffer, {
        folder: `kitchen-showroom/products/${productId}/videos`,
      });

      const newVideo = await createProductVideo(productId, {
        videoType: VideoType.CLOUDINARY,
        url: uploadResult.secureUrl,
        title: title || file.name.replace(/\.[^/.]+$/, ""),
      });

      return handleApiSuccess(newVideo, 201);
    }

    // Direct JSON Payload (YouTube URL or Cloudinary URL)
    const body = await request.json();
    const validatedData = createProductVideoSchema.parse(body);
    const newVideo = await createProductVideo(productId, validatedData);

    return handleApiSuccess(newVideo, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
