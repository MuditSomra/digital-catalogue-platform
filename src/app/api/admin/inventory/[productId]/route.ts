import { NextRequest } from "next/server";
import { getInventoryByProductId } from "@/lib/inventory-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ productId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { productId } = await params;
    const details = await getInventoryByProductId(productId);
    return handleApiSuccess(details);
  } catch (error) {
    return handleApiError(error);
  }
}
