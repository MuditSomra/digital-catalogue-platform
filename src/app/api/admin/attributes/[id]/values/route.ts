import { NextRequest } from "next/server";
import { createAttributeValue } from "@/lib/attribute-service";
import { createAttributeValueSchema } from "@/validations/attribute";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = createAttributeValueSchema.parse({
      ...body,
      attributeId: id,
    });
    const option = await createAttributeValue(validatedData);
    return handleApiSuccess(option, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
