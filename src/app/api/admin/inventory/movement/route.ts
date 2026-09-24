import { NextRequest } from "next/server";
import { recordStockMovement } from "@/lib/inventory-service";
import { stockMovementInputSchema } from "@/validations/inventory";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = stockMovementInputSchema.parse(body);
    const result = await recordStockMovement(validatedData);

    return handleApiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
