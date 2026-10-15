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
        minSellingPrice,
        maxSellingPrice,
        minPriceCode,
        maxPriceCode,
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
          const minSellingParam = searchParams.get("minSellingPrice") || searchParams.get("minPrice");
          const maxSellingParam = searchParams.get("maxSellingPrice") || searchParams.get("maxPrice");
          const minCodeParam = searchParams.get("minPriceCode");
          const maxCodeParam = searchParams.get("maxPriceCode");

          const minCode = minCodeParam !== null && minCodeParam !== "" && !isNaN(Number(minCodeParam)) ? Number(minCodeParam) : undefined;
          const maxCode = maxCodeParam !== null && maxCodeParam !== "" && !isNaN(Number(maxCodeParam)) ? Number(maxCodeParam) : undefined;
          const isPriceCode = minCode !== undefined || maxCode !== undefined;

          const minSelling = !isPriceCode && minSellingParam !== null && minSellingParam !== "" && !isNaN(Number(minSellingParam)) ? Number(minSellingParam) : undefined;
          const maxSelling = !isPriceCode && maxSellingParam !== null && maxSellingParam !== "" && !isNaN(Number(maxSellingParam)) ? Number(maxSellingParam) : undefined;

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
            minSellingPrice: minSelling,
            maxSellingPrice: maxSelling,
            minPriceCode: isPriceCode ? minCode : undefined,
            maxPriceCode: isPriceCode ? maxCode : undefined,
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
            minSellingPrice,
            maxSellingPrice,
            minPriceCode,
            maxPriceCode,
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
