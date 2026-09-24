import { NextRequest } from "next/server";
import {
  updateAttributeValue,
  deleteAttributeValue,
} from "@/lib/attribute-service";
import { updateAttributeValueSchema } from "@/validations/attribute";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAttributeValueSchema.parse(body);
    const updated = await updateAttributeValue(id, validatedData);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteAttributeValue(id);
    return handleApiSuccess({ message: "Option deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
