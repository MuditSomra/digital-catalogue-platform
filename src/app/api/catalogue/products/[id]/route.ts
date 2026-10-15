import { NextRequest } from "next/server";
import { getCatalogueProductDetail } from "@/lib/catalogue-service";
import { handleApiSuccess, handleApiError, ApiError } from "@/lib/api-response";
import { createTimingContext, runWithTiming, timeOperation } from "@/lib/perf-timing";

export const dynamic = "force-dynamic";

let isInitialInvocation = true;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isInitial = isInitialInvocation;
  isInitialInvocation = false;
  const collector = createTimingContext("catalogue/products/[id]", isInitial);

  return runWithTiming(collector, async () => {
    try {
      const { id } = await timeOperation(
        "parse_params",
        () => params,
        "Await Route Parameters"
      );

      const product = await timeOperation(
        "service_product_detail",
        () => getCatalogueProductDetail(id),
        "Product Detail Service Total"
      );

      if (!product) {
        throw new ApiError(404, "Product not found or currently unavailable.");
      }

      const response = await timeOperation(
        "response_build",
        () => handleApiSuccess(product),
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
