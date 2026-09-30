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
  try {
    const body = await request.json();
    const { email, password, trustThisDevice, deviceName } = loginSchema.parse(body);

    const { ipAddress, userAgent, deviceToken } = await getClientMetadata();

    const authResult = await authenticateAdmin({
      email,
      password,
      trustThisDevice,
      deviceName,
      userAgent,
      ipAddress,
      existingDeviceToken: deviceToken,
    });

    // Set secure HTTP-only cookies
    await setSessionCookies({
      sessionToken: authResult.sessionToken,
      isTrustedDevice: authResult.isTrustedDevice,
      deviceToken: authResult.deviceToken,
    });

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
