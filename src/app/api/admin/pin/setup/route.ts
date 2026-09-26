import { NextRequest } from "next/server";
import { setOwnerPin, PinServiceError } from "@/lib/pin-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pinSetupSchema = z.object({
  newPin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits"),
  currentPin: z.string().regex(/^\d{4}$/, "Current PIN must be 4 digits").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = pinSetupSchema.parse(body);

    const result = await setOwnerPin(validated);
    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
