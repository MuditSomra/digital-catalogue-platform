import { NextRequest } from "next/server";
import { requireApiOwnerAuth } from "@/lib/auth-server";
import { getCategoriesTree } from "@/lib/category-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Enforce Owner-only RBAC
    const auth = await requireApiOwnerAuth();
    if (!auth.isValid) {
      return auth.response;
    }

    const categories = await getCategoriesTree();

    return handleApiSuccess(categories);
  } catch (error) {
    return handleApiError(error);
  }
}
