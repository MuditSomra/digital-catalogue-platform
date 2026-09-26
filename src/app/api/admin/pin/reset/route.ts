import { NextRequest } from "next/server";
import { resetOwnerPin } from "@/lib/pin-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pinResetSchema = z.object({
  newPin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = pinResetSchema.parse(body);

    const result = await resetOwnerPin(validated.newPin);
    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
