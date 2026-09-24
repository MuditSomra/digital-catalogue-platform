import { NextRequest } from "next/server";
import { getInventoryList } from "@/lib/inventory-service";
import { inventoryFilterQuerySchema } from "@/validations/inventory";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = {
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      brandId: searchParams.get("brandId") || undefined,
      stockStatus: searchParams.get("stockStatus") || undefined,
    };

    const validatedQuery = inventoryFilterQuerySchema.parse(query);
    const result = await getInventoryList(validatedQuery);

    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
