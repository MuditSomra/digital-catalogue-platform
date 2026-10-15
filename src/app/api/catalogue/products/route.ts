import { NextRequest } from "next/server";
import { getCatalogueProducts, AttributeFilterParam } from "@/lib/catalogue-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { createTimingContext, runWithTiming, timeOperation } from "@/lib/perf-timing";

export const dynamic = "force-dynamic";

let isInitialInvocation = true;

export async function GET(request: NextRequest) {
  const isInitial = isInitialInvocation;
  isInitialInvocation = false;
  const collector = createTimingContext("catalogue/products", isInitial);

  return runWithTiming(collector, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;

      const {
        search,
        categoryId,
        brandIds,
        minPrice,
        maxPrice,
        inStockOnly,
        featuredOnly,
        sortBy,
        page,
        limit,
        attributeFilters,
      } = await timeOperation(
        "parse_params",
        () => {
          const s = searchParams.get("search") || undefined;
          const cId = searchParams.get("categoryId") || undefined;
          const brandIdsParam = searchParams.get("brandIds") || searchParams.get("brandId");
          const bIds = brandIdsParam ? brandIdsParam.split(",").filter(Boolean) : undefined;
          const minP = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
          const maxP = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
          const inStock = searchParams.get("inStockOnly") === "true";
          const featOnly = searchParams.get("featuredOnly") === "true";
          const sort = (searchParams.get("sortBy") as any) || "featured";
          const pg = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
          const lim = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 12;

          let attrs: AttributeFilterParam[] = [];
          const attrParam = searchParams.get("attributeFilters");
          if (attrParam) {
            try {
              attrs = JSON.parse(attrParam);
            } catch {
              attrs = [];
            }
          }

          return {
            search: s,
            categoryId: cId,
            brandIds: bIds,
            minPrice: minP,
            maxPrice: maxP,
            inStockOnly: inStock,
            featuredOnly: featOnly,
            sortBy: sort,
            page: pg,
            limit: lim,
            attributeFilters: attrs,
          };
        },
        "Parse Request Parameters"
      );

      const result = await timeOperation(
        "service_products",
        () =>
          getCatalogueProducts({
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
          }),
        "Catalogue Service Total"
      );

      const response = await timeOperation(
        "response_build",
        () => handleApiSuccess(result),
        "Serialize API Response"
      );

      collector.attachToResponse(response);
      return response;
    } catch (error) {
      const response = handleApiError(error);
      collector.attachToResponse(response);
      return response;
    }
  });
}
