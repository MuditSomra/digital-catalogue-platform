import { NextRequest } from "next/server";
import { getCatalogueCategoriesTree } from "@/lib/category-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const t0 = performance.now();
  try {
    const tTree0 = performance.now();
    const tree = await getCatalogueCategoriesTree();
    const tTree = performance.now() - tTree0;

    const tResp0 = performance.now();
    const resp = handleApiSuccess(tree);
    const tResp = performance.now() - tResp0;
    const tTotal = performance.now() - t0;

    console.log(
      `[PERF][catalogue/categories] treeService=${tTree.toFixed(1)}ms response=${tResp.toFixed(1)}ms total=${tTotal.toFixed(1)}ms`
    );

    return resp;
  } catch (error) {
    return handleApiError(error);
  }
}
