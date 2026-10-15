import { NextRequest } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-server";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { createTimingContext, runWithTiming, timeOperation } from "@/lib/perf-timing";

export const dynamic = "force-dynamic";

let isInitialInvocation = true;

export async function GET(_request: NextRequest) {
  const isInitial = isInitialInvocation;
  isInitialInvocation = false;
  const collector = createTimingContext("auth/session", isInitial);

  return runWithTiming(collector, async () => {
    try {
      const result = await timeOperation(
        "service_session",
        () => getAuthenticatedSession(),
        "Session Validation Service"
      );

      const response = await timeOperation(
        "response_build",
        () => {
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
        },
        "Serialize API Response"
      );

      collector.attachToResponse(response);
      return response;
    } catch (error) {
      const response = handleApiError(error);
      collector.attachToResponse(response);
      return response;
    }
  });
}
