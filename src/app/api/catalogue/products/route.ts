import { NextRequest } from "next/server";
import { getCatalogueProducts, AttributeFilterParam } from "@/lib/catalogue-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t0 = performance.now();
  try {
    const tParse0 = performance.now();
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
    const tParse = performance.now() - tParse0;

    const tService0 = performance.now();
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
    const tService = performance.now() - tService0;

    const tResp0 = performance.now();
    const response = handleApiSuccess(result);
    const tResp = performance.now() - tResp0;
    const tTotal = performance.now() - t0;

    console.log(
      `[PERF][api/catalogue/products] parse=${tParse.toFixed(1)}ms service=${tService.toFixed(1)}ms responseBuild=${tResp.toFixed(1)}ms total=${tTotal.toFixed(1)}ms`
    );

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
