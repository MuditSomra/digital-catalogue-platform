import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { changeAdminPassword, SESSION_COOKIE_NAME } from "@/lib/auth-service";
import { handleApiSuccess, handleApiError, handleApiUnauthorized } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long."),
  revokeOtherSessions: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth.isValid) {
      return handleApiUnauthorized(auth.message);
    }

    const body = await request.json();
    const { currentPassword, newPassword, revokeOtherSessions } = changePasswordSchema.parse(body);

    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    await changeAdminPassword({
      adminUserId: auth.user.id,
      currentPassword,
      newPassword,
      currentSessionToken: currentToken,
      revokeOtherSessions,
    });

    return handleApiSuccess({
      changed: true,
      message: revokeOtherSessions
        ? "Password changed successfully. All other device sessions have been logged out."
        : "Password changed successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
