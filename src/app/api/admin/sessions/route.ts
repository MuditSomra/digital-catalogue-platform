import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { getActiveSessionsForUser, SESSION_COOKIE_NAME } from "@/lib/auth-service";
import { handleApiSuccess, handleApiError, handleApiUnauthorized } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth.isValid) {
      return handleApiUnauthorized(auth.message);
    }

    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    const data = await getActiveSessionsForUser(auth.user.id, currentToken);

    return handleApiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
