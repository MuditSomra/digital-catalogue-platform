import { NextRequest } from "next/server";
import { verifyOwnerPin } from "@/lib/pin-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { getAuthenticatedSession, setAdminPinVerifiedCookie } from "@/lib/auth-server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pinVerifySchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits"),
  action: z.string().optional(), // e.g. "admin_access", "mode_switch", "exit_presentation"
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, action } = pinVerifySchema.parse(body);

    // 1. Verify owner PIN (checks lockout & failure thresholds)
    await verifyOwnerPin(pin);

    // 2. If called within an active session, set the admin PIN verified cookie
    const sessionResult = await getAuthenticatedSession();
    if (sessionResult.isValid) {
      await setAdminPinVerifiedCookie(sessionResult.session.id);
    }

    return handleApiSuccess({
      authorized: true,
      action: action || "admin_access",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

