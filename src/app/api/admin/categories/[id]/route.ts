import { NextRequest } from "next/server";
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/lib/category-service";
import { updateCategorySchema } from "@/validations/category";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const category = await getCategoryById(id);
    return handleApiSuccess(category);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);
    const updated = await updateCategory(id, validatedData);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteCategory(id);
    return handleApiSuccess({ message: "Category deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
