import { NextRequest } from "next/server";
import {
  getCategoryAttributes,
  createCategoryAttribute,
} from "@/lib/attribute-service";
import { createCategoryAttributeSchema } from "@/validations/attribute";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const attributes = await getCategoryAttributes(id);
    return handleApiSuccess(attributes);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = createCategoryAttributeSchema.parse({
      ...body,
      categoryId: id,
    });
    const attribute = await createCategoryAttribute(validatedData);
    return handleApiSuccess(attribute, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
