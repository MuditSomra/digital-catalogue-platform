import { NextRequest } from "next/server";
import { getCatalogueProductDetail } from "@/lib/catalogue-service";
import { handleApiSuccess, handleApiError, ApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getCatalogueProductDetail(id);

    if (!product) {
      throw new ApiError(404, "Product not found or currently unavailable.");
    }

    return handleApiSuccess(product);
  } catch (error) {
    return handleApiError(error);
  }
}
