import { NextRequest } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { handleApiSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const result = await getAuthenticatedSession();

  if (!result.isValid) {
    return handleApiSuccess({
      authenticated: false,
      user: null,
      session: null,
    });
  }

  return handleApiSuccess({
    authenticated: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      isOwner: result.user.role === "OWNER" || result.user.role === "SUPER_ADMIN",
    },
    session: {
      id: result.session.id,
      isTrustedDevice: result.session.isTrustedDevice,
      deviceLabel: result.session.deviceLabel,
      lastActiveAt: result.session.lastActiveAt.toISOString(),
      expiresAt: result.session.expiresAt.toISOString(),
      createdAt: result.session.createdAt.toISOString(),
    },
  });
}
