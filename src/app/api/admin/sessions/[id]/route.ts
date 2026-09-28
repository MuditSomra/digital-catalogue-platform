import { NextRequest } from "next/server";
import { getAuthenticatedSession, clearSessionCookies } from "@/lib/auth-server";
import { revokeSession } from "@/lib/auth-service";
import { handleApiSuccess, handleApiError, handleApiUnauthorized, handleApiNotFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function DELETE(
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
      return handleApiNotFound("Session ID is required.");
    }

    const isCurrent = auth.session.id === id;
    const revoked = await revokeSession(id, auth.user.id);

    if (!revoked) {
      return handleApiNotFound("Session not found or already revoked.");
    }

    if (isCurrent) {
      await clearSessionCookies();
    }

    return handleApiSuccess({
      revoked: true,
      sessionId: id,
      isCurrentSession: isCurrent,
      message: isCurrent
        ? "Your current session was revoked. You have been logged out."
        : "Session revoked successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
