import { NextRequest } from "next/server";
import {
  updateProductImage,
  deleteProductImage,
} from "@/lib/media-service";
import { updateProductImageSchema } from "@/validations/media";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; imageId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId, imageId } = await params;
    const body = await request.json();
    const validatedData = updateProductImageSchema.parse(body);

    const updated = await updateProductImage(productId, imageId, validatedData);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: productId, imageId } = await params;
    const result = await deleteProductImage(productId, imageId);
    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
