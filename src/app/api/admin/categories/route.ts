import { NextRequest } from "next/server";
import {
  getCategoriesTree,
  getFlatCategoryOptions,
  createCategory,
} from "@/lib/category-service";
import { createCategorySchema } from "@/validations/category";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format");
    const excludeId = searchParams.get("excludeId") || undefined;

    if (format === "flat") {
      const flat = await getFlatCategoryOptions(excludeId);
      return handleApiSuccess(flat);
    }

    const [tree, flat] = await Promise.all([
      getCategoriesTree(),
      getFlatCategoryOptions(excludeId),
    ]);

    return handleApiSuccess({
      tree,
      flat,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);
    const category = await createCategory(validatedData);
    return handleApiSuccess(category, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
