import { NextRequest } from "next/server";
import { getBrands } from "@/lib/product-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { createTimingContext, runWithTiming, timeOperation } from "@/lib/perf-timing";

export const dynamic = "force-dynamic";

let isInitialInvocation = true;

export async function GET(_request: NextRequest) {
  const isInitial = isInitialInvocation;
  isInitialInvocation = false;
  const collector = createTimingContext("catalogue/brands", isInitial);

  return runWithTiming(collector, async () => {
    try {
      const brands = await timeOperation(
        "db_brands",
        () => getBrands(),
        "Query Brands Database"
      );

      const response = await timeOperation(
        "response_build",
        () => handleApiSuccess(brands),
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
