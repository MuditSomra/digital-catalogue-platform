import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin, AuthError } from "@/lib/auth-service";
import { setSessionCookies, getClientMetadata } from "@/lib/auth-server";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  trustThisDevice: z.boolean().optional().default(false),
  deviceName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const t0 = performance.now();
  try {
    const tVal0 = performance.now();
    const body = await request.json();
    const { email, password, trustThisDevice, deviceName } = loginSchema.parse(body);
    const tVal = performance.now() - tVal0;

    const tMeta0 = performance.now();
    const { ipAddress, userAgent, deviceToken } = await getClientMetadata();
    const tMeta = performance.now() - tMeta0;

    const tAuth0 = performance.now();
    const authResult = await authenticateAdmin({
      email,
      password,
      trustThisDevice,
      deviceName,
      userAgent,
      ipAddress,
      existingDeviceToken: deviceToken,
    });
    const tAuth = performance.now() - tAuth0;

    // Set secure HTTP-only cookies
    const tCookie0 = performance.now();
    await setSessionCookies({
      sessionToken: authResult.sessionToken,
      isTrustedDevice: authResult.isTrustedDevice,
      deviceToken: authResult.deviceToken,
    });
    const tCookie = performance.now() - tCookie0;

    const tResp0 = performance.now();
    const response = handleApiSuccess({
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
    });
    const tResp = performance.now() - tResp0;
    const tTotal = performance.now() - t0;

    console.log(
      `[PERF][auth/login] validation=${tVal.toFixed(1)}ms metadata=${tMeta.toFixed(1)}ms authService=${tAuth.toFixed(1)}ms cookies=${tCookie.toFixed(1)}ms response=${tResp.toFixed(1)}ms total=${tTotal.toFixed(1)}ms`
    );

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }
    return handleApiError(error);
  }
}
