import { NextRequest } from "next/server";
import { setPrimaryProductImage } from "@/lib/media-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; imageId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId, imageId } = await params;
    const updated = await setPrimaryProductImage(productId, imageId);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
