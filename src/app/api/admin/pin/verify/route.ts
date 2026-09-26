import { NextRequest } from "next/server";
import { verifyOwnerPin } from "@/lib/pin-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pinVerifySchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits"),
  action: z.string().optional(), // e.g. "mode_switch", "exit_presentation", "mark_as_sold"
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, action } = pinVerifySchema.parse(body);

    await verifyOwnerPin(pin);

    return handleApiSuccess({
      authorized: true,
      action: action || "generic",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
