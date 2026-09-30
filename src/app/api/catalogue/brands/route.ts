import { NextRequest } from "next/server";
import { getBrands } from "@/lib/product-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const brands = await getBrands();
    return handleApiSuccess(brands);
  } catch (error) {
    return handleApiError(error);
  }
}
