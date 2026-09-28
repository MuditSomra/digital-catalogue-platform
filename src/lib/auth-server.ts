import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import {
  SESSION_COOKIE_NAME,
  DEVICE_COOKIE_NAME,
  MAIN_DEVICE_COOKIE_MAX_AGE_SEC,
  OTHER_DEVICE_COOKIE_MAX_AGE_SEC,
  validateSession,
  revokeSessionByToken,
  type SessionValidationResult,
  type SessionValidationSuccess,
} from "./auth-service";
import { isOwnerPinConfigured } from "./pin-service";
import type { AdminUser, Session } from "@prisma/client";

export const ADMIN_PIN_COOKIE_NAME = "shop_admin_unlocked";

/**
 * Creates an HMAC-signed token for Admin PIN verification bound to the session ID.
 */
function createAdminPinToken(sessionId: string): string {
  const secret = process.env.SESSION_SECRET || "showroom-admin-secret-2026";
  const timestamp = Date.now().toString();
  const payload = `${sessionId}:${timestamp}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

/**
 * Verifies if the admin PIN has been verified in the current session.
 */
export async function isAdminPinVerified(sessionId?: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_PIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [cookieSessionId, timestampStr, signature] = parts;

  if (sessionId && cookieSessionId !== sessionId) {
    return false;
  }

  const secret = process.env.SESSION_SECRET || "showroom-admin-secret-2026";
  const payload = `${cookieSessionId}:${timestampStr}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  if (signature !== expectedSig) {
    return false;
  }

  // 8-hour maximum PIN verification validity per unlock
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 8 * 60 * 60 * 1000) {
    return false;
  }

  return true;
}

/**
 * Sets the admin PIN verified cookie upon successful owner PIN verification.
 */
export async function setAdminPinVerifiedCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = createAdminPinToken(sessionId);
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(ADMIN_PIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours
  });
}

/**
 * Clears the admin PIN verified cookie (e.g. on exit to showroom or logout).
 */
export async function clearAdminPinVerifiedCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_PIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Reads the session token from the incoming request cookies and validates it against the database.
 */
export async function getAuthenticatedSession(): Promise<SessionValidationResult> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return {
      isValid: false,
      reason: "MISSING_TOKEN",
      message: "No authentication session cookie found.",
    };
  }

  return await validateSession(rawToken);
}

/**
 * Server-side route / page guard.
 * If session is valid, returns the user and session.
 * If unauthenticated or expired, immediately redirects to /login.
 */
export async function requireAuth(returnUrl?: string): Promise<{
  user: AdminUser;
  session: Session;
  isTrustedDevice: boolean;
}> {
  const result = await getAuthenticatedSession();

  if (!result.isValid) {
    const target = returnUrl
      ? `/login?returnUrl=${encodeURIComponent(returnUrl)}&error=${encodeURIComponent(result.reason.toLowerCase())}`
      : `/login?error=${encodeURIComponent(result.reason.toLowerCase())}`;
    redirect(target);
  }

  return {
    user: (result as SessionValidationSuccess).user,
    session: (result as SessionValidationSuccess).session,
    isTrustedDevice: (result as SessionValidationSuccess).isTrustedDevice,
  };
}

/**
 * Server-side route guard for the Admin dashboard.
 * Requires both a valid shop session AND verified owner PIN.
 * If unauthenticated -> redirects to /login.
 * If authenticated but PIN not verified -> redirects to /?pin=required (back to showroom).
 */
export async function requireAdminAuth(returnUrl?: string): Promise<{
  user: AdminUser;
  session: Session;
  isTrustedDevice: boolean;
}> {
  const auth = await requireAuth(returnUrl || "/admin");

  const pinConfigured = await isOwnerPinConfigured();
  if (pinConfigured) {
    const isPinValid = await isAdminPinVerified(auth.session.id);
    if (!isPinValid) {
      redirect("/?pin=required");
    }
  }

  return auth;
}

/**
 * API route guard.
 * Returns the authenticated user or throws/returns null.
 */
export async function getApiAuth(): Promise<SessionValidationSuccess | null> {
  const result = await getAuthenticatedSession();
  if (!result.isValid) return null;
  return result;
}

/**
 * Sets the session cookie on response headers / cookies store.
 */
export async function setSessionCookies(options: {
  sessionToken: string;
  isTrustedDevice: boolean;
  deviceToken?: string;
}): Promise<void> {
  const { sessionToken, isTrustedDevice, deviceToken } = options;
  const cookieStore = await cookies();

  const isProduction = process.env.NODE_ENV === "production";
  const maxAge = isTrustedDevice ? MAIN_DEVICE_COOKIE_MAX_AGE_SEC : OTHER_DEVICE_COOKIE_MAX_AGE_SEC;

  // Set Session Cookie
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  // If Trusted Device Token generated, store long-term device token cookie (365 days)
  if (deviceToken && isTrustedDevice) {
    cookieStore.set(DEVICE_COOKIE_NAME, deviceToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });
  }
}

/**
 * Clears the session cookie and invalidates the session in the database.
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await revokeSessionByToken(rawToken);
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  await clearAdminPinVerifiedCookie();
}

/**
 * Helper to extract client IP and user-agent from headers.
 */
export async function getClientMetadata(): Promise<{ ipAddress?: string; userAgent?: string; deviceToken?: string }> {
  const headersList = await headers();
  const cookieStore = await cookies();

  const forwardedFor = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || undefined;
  const userAgent = headersList.get("user-agent") || undefined;
  const deviceToken = cookieStore.get(DEVICE_COOKIE_NAME)?.value || undefined;

  return { ipAddress, userAgent, deviceToken };
}

