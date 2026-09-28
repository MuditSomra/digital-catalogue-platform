import { NextRequest } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { revokeTrustedDevice } from "@/lib/auth-service";
import { handleApiSuccess, handleApiError, handleApiUnauthorized, handleApiNotFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth.isValid) {
      return handleApiUnauthorized(auth.message);
    }

    const { id } = await params;
    if (!id) {
      return handleApiNotFound("Trusted device ID is required.");
    }

    const success = await revokeTrustedDevice(id, auth.user.id);
    if (!success) {
      return handleApiNotFound("Trusted device not found or already revoked.");
    }

    return handleApiSuccess({
      revoked: true,
      deviceId: id,
      message: "Trusted device revoked. Any sessions associated with this device have been terminated.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
