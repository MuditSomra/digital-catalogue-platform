import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { revokeAllOtherSessions, SESSION_COOKIE_NAME } from "@/lib/auth-service";
import { handleApiSuccess, handleApiError, handleApiUnauthorized } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth.isValid) {
      return handleApiUnauthorized(auth.message);
    }

    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!currentToken) {
      return handleApiUnauthorized("Current session token missing.");
    }

    const revokedCount = await revokeAllOtherSessions(currentToken, auth.user.id);

    return handleApiSuccess({
      revokedCount,
      message: `Successfully logged out of ${revokedCount} other device session(s).`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
