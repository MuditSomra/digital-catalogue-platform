import { NextRequest } from "next/server";
import { reorderProductVideos } from "@/lib/media-service";
import { reorderMediaSchema } from "@/validations/media";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId } = await params;
    const body = await request.json();
    const validatedData = reorderMediaSchema.parse(body);

    const reordered = await reorderProductVideos(productId, validatedData.ids);
    return handleApiSuccess(reordered);
  } catch (error) {
    return handleApiError(error);
  }
}
