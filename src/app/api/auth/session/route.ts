import { NextRequest } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { handleApiSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t0 = performance.now();
  const tExtract0 = performance.now();
  const result = await getAuthenticatedSession();
  const tExtract = performance.now() - tExtract0;

  const tResp0 = performance.now();
  let response;
  if (!result.isValid) {
    response = handleApiSuccess({
      authenticated: false,
      user: null,
      session: null,
    });
  } else {
    response = handleApiSuccess({
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
  const tResp = performance.now() - tResp0;
  const tTotal = performance.now() - t0;

  console.log(
    `[PERF][auth/session] sessionValidation=${tExtract.toFixed(1)}ms responseBuild=${tResp.toFixed(1)}ms total=${tTotal.toFixed(1)}ms`
  );

  return response;
}
