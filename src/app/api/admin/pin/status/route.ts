import { NextRequest } from "next/server";
import { isOwnerPinConfigured, getPinLockoutStatus } from "@/lib/pin-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const isConfigured = await isOwnerPinConfigured();
    const lockout = await getPinLockoutStatus();

    return handleApiSuccess({
      isConfigured,
      isLocked: lockout.isLocked,
      remainingMinutes: lockout.remainingMinutes,
      failedAttempts: lockout.failedAttempts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
