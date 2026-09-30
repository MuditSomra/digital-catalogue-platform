import { NextRequest } from "next/server";
import { getCatalogueCategoriesTree } from "@/lib/category-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const tree = await getCatalogueCategoriesTree();
    return handleApiSuccess(tree);
  } catch (error) {
    return handleApiError(error);
  }
}
