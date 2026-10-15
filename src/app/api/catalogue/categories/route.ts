import { NextRequest } from "next/server";
import { getCatalogueCategoriesTree } from "@/lib/category-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { createTimingContext, runWithTiming, timeOperation } from "@/lib/perf-timing";

export const dynamic = "force-dynamic";

let isInitialInvocation = true;

export async function GET(_request: NextRequest) {
  const isInitial = isInitialInvocation;
  isInitialInvocation = false;
  const collector = createTimingContext("catalogue/categories", isInitial);

  return runWithTiming(collector, async () => {
    try {
      const tree = await timeOperation(
        "service_categories",
        () => getCatalogueCategoriesTree(),
        "Category Tree Service Total"
      );

      const response = await timeOperation(
        "response_build",
        () => handleApiSuccess(tree),
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
