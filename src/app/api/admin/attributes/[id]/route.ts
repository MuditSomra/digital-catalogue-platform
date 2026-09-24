import { NextRequest } from "next/server";
import {
  getCategoryAttributeById,
  updateCategoryAttribute,
  deleteCategoryAttribute,
} from "@/lib/attribute-service";
import { updateCategoryAttributeSchema } from "@/validations/attribute";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const attribute = await getCategoryAttributeById(id);
    return handleApiSuccess(attribute);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCategoryAttributeSchema.parse(body);
    const updated = await updateCategoryAttribute(id, validatedData);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteCategoryAttribute(id);
    return handleApiSuccess({ message: "Specification deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
