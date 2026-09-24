import { NextRequest } from "next/server";
import { updateLowStockThreshold } from "@/lib/inventory-service";
import { updateLowStockThresholdSchema } from "@/validations/inventory";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ productId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { productId } = await params;
    const body = await request.json();
    const validatedData = updateLowStockThresholdSchema.parse({
      ...body,
      productId,
    });
    const result = await updateLowStockThreshold(validatedData);

    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
