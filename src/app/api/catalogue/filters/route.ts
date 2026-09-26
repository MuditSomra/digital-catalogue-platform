import { NextRequest } from "next/server";
import { getCategoryDynamicFilters } from "@/lib/catalogue-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get("categoryId") || undefined;
    const filters = await getCategoryDynamicFilters(categoryId);
    return handleApiSuccess(filters);
  } catch (error) {
    return handleApiError(error);
  }
}
