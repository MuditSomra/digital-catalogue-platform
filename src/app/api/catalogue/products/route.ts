import { NextRequest } from "next/server";
import { getCatalogueProducts, AttributeFilterParam } from "@/lib/catalogue-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get("search") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const brandIdsParam = searchParams.get("brandIds") || searchParams.get("brandId");
    const brandIds = brandIdsParam ? brandIdsParam.split(",").filter(Boolean) : undefined;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const inStockOnly = searchParams.get("inStockOnly") === "true";
    const featuredOnly = searchParams.get("featuredOnly") === "true";
    const sortBy = (searchParams.get("sortBy") as any) || "featured";
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 12;

    // Parse attributeFilters if provided as JSON string
    let attributeFilters: AttributeFilterParam[] = [];
    const attrParam = searchParams.get("attributeFilters");
    if (attrParam) {
      try {
        attributeFilters = JSON.parse(attrParam);
      } catch {
        attributeFilters = [];
      }
    }

    const result = await getCatalogueProducts({
      search,
      categoryId,
      brandIds,
      minPrice,
      maxPrice,
      inStockOnly,
      featuredOnly,
      attributeFilters,
      sortBy,
      page,
      limit,
    });

    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
