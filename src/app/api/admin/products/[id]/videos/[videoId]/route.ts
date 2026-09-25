import { NextRequest } from "next/server";
import {
  updateProductVideo,
  deleteProductVideo,
} from "@/lib/media-service";
import { updateProductVideoSchema } from "@/validations/media";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; videoId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId, videoId } = await params;
    const body = await request.json();
    const validatedData = updateProductVideoSchema.parse(body);

    const updated = await updateProductVideo(productId, videoId, validatedData);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId, videoId } = await params;
    const result = await deleteProductVideo(productId, videoId);
    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
