import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin, AuthError } from "@/lib/auth-service";
import { setSessionCookies, getClientMetadata } from "@/lib/auth-server";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { createTimingContext, runWithTiming, timeOperation } from "@/lib/perf-timing";
import { z } from "zod";

export const dynamic = "force-dynamic";

let isInitialInvocation = true;

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  trustThisDevice: z.boolean().optional().default(false),
  deviceName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const isInitial = isInitialInvocation;
  isInitialInvocation = false;
  const collector = createTimingContext("auth/login", isInitial);

  return runWithTiming(collector, async () => {
    try {
      const { email, password, trustThisDevice, deviceName } = await timeOperation(
        "body_validation",
        async () => {
          const body = await request.json();
          return loginSchema.parse(body);
        },
        "Parse & Validate Request Body"
      );

      const { ipAddress, userAgent, deviceToken } = await timeOperation(
        "client_metadata",
        () => getClientMetadata(),
        "Extract Client Metadata"
      );

      const authResult = await timeOperation(
        "service_authenticate",
        () =>
          authenticateAdmin({
            email,
            password,
            trustThisDevice,
            deviceName,
            userAgent,
            ipAddress,
            existingDeviceToken: deviceToken,
          }),
        "Authenticate Admin Service Total"
      );

      // Set secure HTTP-only cookies
      await timeOperation(
        "set_cookies",
        () =>
          setSessionCookies({
            sessionToken: authResult.sessionToken,
            isTrustedDevice: authResult.isTrustedDevice,
            deviceToken: authResult.deviceToken,
          }),
        "Set Session Cookies"
      );

      const response = await timeOperation(
        "response_build",
        () =>
          handleApiSuccess({
            user: {
              id: authResult.user.id,
              email: authResult.user.email,
              name: authResult.user.name,
              role: authResult.user.role,
            },
            isTrustedDevice: authResult.isTrustedDevice,
            expiresAt: authResult.session.expiresAt.toISOString(),
            redirectUrl: "/",
            message: authResult.isTrustedDevice
              ? "Logged in securely as Main Shop Device (90-day persistent session)."
              : "Logged in securely (8-hour standard session).",
          }),
        "Serialize API Response"
      );

      collector.attachToResponse(response);
      return response;
    } catch (error) {
      let response: NextResponse;
      if (error instanceof AuthError) {
        response = NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: error.statusCode }
        );
      } else {
        response = handleApiError(error);
      }

      collector.attachToResponse(response);
      return response;
    }
  });
}
