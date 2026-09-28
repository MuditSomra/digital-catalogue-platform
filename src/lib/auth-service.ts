import crypto from "crypto";
import { prisma } from "./prisma";
import type { AdminUser, Session, TrustedDevice } from "@prisma/client";

// ==============================================================================
// CONSTANTS & CONFIGURATION
// ==============================================================================

export const SESSION_COOKIE_NAME = "shop_session";
export const DEVICE_COOKIE_NAME = "shop_device_token";

// Trusted Main Shop Device: 90 days total max lifetime, 30 days inactivity limit
export const MAIN_DEVICE_MAX_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
export const MAIN_DEVICE_INACTIVITY_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
export const MAIN_DEVICE_COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60; // 7,776,000 seconds

// Other Devices: 8 hours max lifetime
export const OTHER_DEVICE_MAX_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const OTHER_DEVICE_COOKIE_MAX_AGE_SEC = 8 * 60 * 60; // 28,800 seconds

// Brute-force protection
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;
const LOGIN_ATTEMPTS_PREFIX = "login_attempts_";

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 400, public code: string = "AUTH_ERROR") {
    super(message);
    this.name = "AuthError";
  }
}

// ==============================================================================
// CRYPTOGRAPHY & HASHING HELPERS
// ==============================================================================

/**
 * Hashes a password with a cryptographically secure random 16-byte salt using scrypt.
 * Output format: "salt:hash"
 */
export function hashPassword(password: string): string {
  if (!password || password.length < 6) {
    throw new AuthError("Password must be at least 6 characters long.", 400, "WEAK_PASSWORD");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a candidate password against a stored "salt:hash" string using constant-time comparison.
 */
export function verifyPassword(password: string, storedSaltAndHash: string): boolean {
  if (!password || !storedSaltAndHash || !storedSaltAndHash.includes(":")) {
    return false;
  }
  const [salt, storedHash] = storedSaltAndHash.split(":");
  if (!salt || !storedHash) return false;

  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedKeyBuffer = Buffer.from(storedHash, "hex");
    if (storedKeyBuffer.length !== derivedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(storedKeyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generates a 256-bit cryptographically secure random hex token.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes a SHA-256 hash of a token for safe storage in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ==============================================================================
// RATE LIMITING & BRUTE FORCE PROTECTION
// ==============================================================================

export async function checkLoginRateLimit(identifier: string): Promise<{
  isLocked: boolean;
  remainingMinutes?: number;
  failedAttempts: number;
}> {
  const key = `${LOGIN_ATTEMPTS_PREFIX}${identifier.toLowerCase().trim()}`;
  const setting = await prisma.storeSetting.findUnique({
    where: { key },
  });

  if (!setting) {
    return { isLocked: false, failedAttempts: 0 };
  }

  try {
    const data = JSON.parse(setting.value);
    const now = Date.now();
    const lockoutUntil = data.lockoutUntil || 0;

    if (now < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil - now) / 60000);
      return { isLocked: true, remainingMinutes, failedAttempts: data.attempts || MAX_LOGIN_ATTEMPTS };
    }

    // Lockout expired - clean up if it was previously locked
    if (lockoutUntil > 0) {
      await prisma.storeSetting.deleteMany({ where: { key } });
      return { isLocked: false, failedAttempts: 0 };
    }

    return { isLocked: false, failedAttempts: data.attempts || 0 };
  } catch {
    return { isLocked: false, failedAttempts: 0 };
  }
}

export async function recordFailedLoginAttempt(identifier: string): Promise<{
  isLocked: boolean;
  remainingMinutes?: number;
  failedAttempts: number;
}> {
  const key = `${LOGIN_ATTEMPTS_PREFIX}${identifier.toLowerCase().trim()}`;
  const setting = await prisma.storeSetting.findUnique({
    where: { key },
  });

  const now = Date.now();
  let attempts = 1;
  let lockoutUntil = 0;

  if (setting) {
    try {
      const data = JSON.parse(setting.value);
      // If previous attempt was over 15 minutes ago, reset counter
      if (now - (data.lastAttempt || 0) > LOGIN_LOCKOUT_MINUTES * 60000) {
        attempts = 1;
      } else {
        attempts = (data.attempts || 0) + 1;
      }
    } catch {
      attempts = 1;
    }
  }

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    lockoutUntil = now + LOGIN_LOCKOUT_MINUTES * 60000;
  }

  const payload = JSON.stringify({
    attempts,
    lastAttempt: now,
    lockoutUntil,
  });

  await prisma.storeSetting.upsert({
    where: { key },
    create: { key, value: payload },
    update: { value: payload },
  });

  const isLocked = attempts >= MAX_LOGIN_ATTEMPTS;
  const remainingMinutes = isLocked ? Math.ceil((lockoutUntil - now) / 60000) : undefined;

  return { isLocked, remainingMinutes, failedAttempts: attempts };
}

export async function resetLoginAttempts(identifier: string): Promise<void> {
  const key = `${LOGIN_ATTEMPTS_PREFIX}${identifier.toLowerCase().trim()}`;
  await prisma.storeSetting.deleteMany({ where: { key } });
}

// ==============================================================================
// DEFAULT ADMIN PROVISIONING
// ==============================================================================

export const DEFAULT_ADMIN_EMAIL = "admin@kitchenshowroom.local";
export const DEFAULT_ADMIN_PASSWORD = "Admin@Showroom2026!";

/**
 * Ensures at least one admin user with a valid password hash exists in the database.
 */
export async function ensureAdminUserExists(): Promise<AdminUser> {
  const existingAdmin = await prisma.adminUser.findFirst({
    where: { isActive: true },
  });

  if (existingAdmin && existingAdmin.passwordHash) {
    return existingAdmin;
  }

  if (existingAdmin && !existingAdmin.passwordHash) {
    // Populate default password hash for existing admin user
    const updated = await prisma.adminUser.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      },
    });
    return updated;
  }

  // Create default admin user
  const newAdmin = await prisma.adminUser.create({
    data: {
      email: DEFAULT_ADMIN_EMAIL,
      name: "Store Owner",
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  return newAdmin;
}

// ==============================================================================
// AUTHENTICATION & LOGIN
// ==============================================================================

export interface AuthenticateResult {
  user: AdminUser;
  sessionToken: string;
  session: Session;
  isTrustedDevice: boolean;
  deviceToken?: string;
  cookieMaxAgeSec: number;
}

export async function authenticateAdmin(options: {
  email: string;
  password: string;
  trustThisDevice?: boolean;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  existingDeviceToken?: string;
}): Promise<AuthenticateResult> {
  const { email, password, trustThisDevice = false, deviceName, userAgent, ipAddress, existingDeviceToken } = options;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Ensure admin user exists in DB
  await ensureAdminUserExists();

  // 2. Check brute force rate limit
  const rateLimitStatus = await checkLoginRateLimit(normalizedEmail);
  if (rateLimitStatus.isLocked) {
    throw new AuthError(
      `Too many failed login attempts. Verification locked for approximately ${rateLimitStatus.remainingMinutes} more minute(s).`,
      429,
      "ACCOUNT_LOCKED"
    );
  }

  // 3. Find user
  const user = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    await recordFailedLoginAttempt(normalizedEmail);
    throw new AuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  // 4. Verify password
  const isPasswordValid = verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    const failedStatus = await recordFailedLoginAttempt(normalizedEmail);
    if (failedStatus.isLocked) {
      throw new AuthError(
        `Invalid password. Account is now locked for ${LOGIN_LOCKOUT_MINUTES} minutes due to repeated failed attempts.`,
        429,
        "ACCOUNT_LOCKED"
      );
    }
    const remaining = MAX_LOGIN_ATTEMPTS - failedStatus.failedAttempts;
    throw new AuthError(
      `Invalid email or password. ${remaining} attempt(s) remaining before temporary lockout.`,
      401,
      "INVALID_CREDENTIALS"
    );
  }

  // 5. Successful password - reset rate limit
  await resetLoginAttempts(normalizedEmail);

  // 6. Handle Trusted Device Registration if requested
  let trustedDeviceRecord: TrustedDevice | null = null;
  let deviceTokenToReturn: string | undefined = undefined;

  if (trustThisDevice) {
    let deviceToken = existingDeviceToken;
    if (deviceToken) {
      const hashedToken = hashToken(deviceToken);
      trustedDeviceRecord = await prisma.trustedDevice.findFirst({
        where: {
          adminUserId: user.id,
          deviceTokenHash: hashedToken,
          isRevoked: false,
        },
      });
    }

    if (!trustedDeviceRecord) {
      deviceToken = generateSecureToken();
      deviceTokenToReturn = deviceToken;
      const deviceTokenHash = hashToken(deviceToken);
      const label = deviceName?.trim() || parseDeviceNameFromUserAgent(userAgent) || "Main Shop Device";

      trustedDeviceRecord = await prisma.trustedDevice.create({
        data: {
          adminUserId: user.id,
          deviceTokenHash,
          deviceName: label,
          lastUsedAt: new Date(),
        },
      });
    } else {
      deviceTokenToReturn = deviceToken;
      await prisma.trustedDevice.update({
        where: { id: trustedDeviceRecord.id },
        data: { lastUsedAt: new Date() },
      });
    }
  }

  // 7. Create Session
  const isTrusted = Boolean(trustThisDevice && trustedDeviceRecord);
  const sessionToken = generateSecureToken();
  const sessionTokenHash = hashToken(sessionToken);
  const now = new Date();

  const maxLifetimeMs = isTrusted ? MAIN_DEVICE_MAX_LIFETIME_MS : OTHER_DEVICE_MAX_LIFETIME_MS;
  const expiresAt = new Date(now.getTime() + maxLifetimeMs);
  const cookieMaxAgeSec = isTrusted ? MAIN_DEVICE_COOKIE_MAX_AGE_SEC : OTHER_DEVICE_COOKIE_MAX_AGE_SEC;

  const deviceLabel =
    deviceName?.trim() ||
    (isTrusted ? trustedDeviceRecord?.deviceName : parseDeviceNameFromUserAgent(userAgent)) ||
    "Showroom Browser";

  const session = await prisma.session.create({
    data: {
      sessionTokenHash,
      adminUserId: user.id,
      isTrustedDevice: isTrusted,
      trustedDeviceId: trustedDeviceRecord?.id || null,
      deviceLabel,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      ipAddress: ipAddress || null,
      lastActiveAt: now,
      expiresAt,
      isRevoked: false,
    },
  });

  return {
    user,
    sessionToken,
    session,
    isTrustedDevice: isTrusted,
    deviceToken: deviceTokenToReturn,
    cookieMaxAgeSec,
  };
}

// ==============================================================================
// SESSION VALIDATION
// ==============================================================================

export interface SessionValidationSuccess {
  isValid: true;
  session: Session;
  user: AdminUser;
  isTrustedDevice: boolean;
}

export interface SessionValidationFailure {
  isValid: false;
  reason: "MISSING_TOKEN" | "SESSION_NOT_FOUND" | "SESSION_REVOKED" | "SESSION_EXPIRED" | "INACTIVITY_TIMEOUT" | "USER_INACTIVE";
  message: string;
}

export type SessionValidationResult = SessionValidationSuccess | SessionValidationFailure;

/**
 * Validates a raw session token against the database, enforcing:
 * 1. Non-revoked status
 * 2. Active user status
 * 3. 90-day max lifetime & 30-day inactivity for trusted main shop devices
 * 4. 8-hour max lifetime for other devices
 * 5. Updates lastActiveAt (throttled to once per minute)
 */
export async function validateSession(rawSessionToken: string | undefined | null): Promise<SessionValidationResult> {
  if (!rawSessionToken || typeof rawSessionToken !== "string" || rawSessionToken.trim().length === 0) {
    return {
      isValid: false,
      reason: "MISSING_TOKEN",
      message: "No session token provided.",
    };
  }

  const tokenHash = hashToken(rawSessionToken.trim());
  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
    include: {
      adminUser: true,
      trustedDevice: true,
    },
  });

  if (!session) {
    return {
      isValid: false,
      reason: "SESSION_NOT_FOUND",
      message: "Session does not exist or has been removed.",
    };
  }

  if (session.isRevoked) {
    return {
      isValid: false,
      reason: "SESSION_REVOKED",
      message: "Session has been revoked.",
    };
  }

  if (!session.adminUser || !session.adminUser.isActive) {
    return {
      isValid: false,
      reason: "USER_INACTIVE",
      message: "Admin account is deactivated.",
    };
  }

  // If session was linked to a trusted device that got revoked, invalidate session
  if (session.trustedDeviceId && session.trustedDevice?.isRevoked) {
    await prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    }).catch(() => {});

    return {
      isValid: false,
      reason: "SESSION_REVOKED",
      message: "Trusted device has been revoked.",
    };
  }

  const now = new Date();

  // Check 1: Max Total Lifetime (90 days for trusted, 8 hours for standard)
  if (now > session.expiresAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    }).catch(() => {});

    return {
      isValid: false,
      reason: "SESSION_EXPIRED",
      message: session.isTrustedDevice
        ? "Main shop device session reached maximum 90-day lifetime. Please log in again."
        : "Standard session expired after 8 hours. Please log in again.",
    };
  }

  // Check 2: Inactivity Timeout for Trusted Devices (30 days of inactivity)
  if (session.isTrustedDevice) {
    const timeSinceLastActive = now.getTime() - session.lastActiveAt.getTime();
    if (timeSinceLastActive > MAIN_DEVICE_INACTIVITY_TIMEOUT_MS) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      }).catch(() => {});

      return {
        isValid: false,
        reason: "INACTIVITY_TIMEOUT",
        message: "Main shop device session expired after 30 days of inactivity. Please log in again.",
      };
    }
  }

  // Session is fully valid!
  // Throttle updating lastActiveAt to once every 60 seconds
  const msSinceLastUpdate = now.getTime() - session.lastActiveAt.getTime();
  if (msSinceLastUpdate > 60_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: now },
    }).catch(() => {});
  }

  return {
    isValid: true,
    session,
    user: session.adminUser,
    isTrustedDevice: session.isTrustedDevice,
  };
}

// ==============================================================================
// SESSION REVOCATION & LOGOUT
// ==============================================================================

/**
 * Revokes a session by ID.
 */
export async function revokeSession(sessionId: string, adminUserId?: string): Promise<boolean> {
  const where: { id: string; adminUserId?: string } = { id: sessionId };
  if (adminUserId) {
    where.adminUserId = adminUserId;
  }

  const session = await prisma.session.findFirst({ where });
  if (!session) return false;

  await prisma.session.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });

  return true;
}

/**
 * Revokes a session by raw session token (used during explicit logout).
 */
export async function revokeSessionByToken(rawSessionToken: string): Promise<boolean> {
  if (!rawSessionToken) return false;
  const tokenHash = hashToken(rawSessionToken.trim());
  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
  });

  if (!session) return false;

  await prisma.session.update({
    where: { id: session.id },
    data: { isRevoked: true },
  });

  return true;
}

/**
 * Revokes all active sessions for an admin user except the currently active session.
 */
export async function revokeAllOtherSessions(currentSessionToken: string, adminUserId: string): Promise<number> {
  const currentHash = hashToken(currentSessionToken.trim());

  const result = await prisma.session.updateMany({
    where: {
      adminUserId,
      sessionTokenHash: { not: currentHash },
      isRevoked: false,
    },
    data: {
      isRevoked: true,
    },
  });

  return result.count;
}

// ==============================================================================
// ADMIN SESSION MANAGEMENT (SETTINGS UI)
// ==============================================================================

export interface ActiveSessionItem {
  id: string;
  deviceLabel: string;
  isCurrent: boolean;
  isTrustedDevice: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  deviceName?: string;
}

/**
 * Retrieves all active sessions for an admin user with current session indicator.
 */
export async function getActiveSessionsForUser(
  adminUserId: string,
  currentRawToken?: string
): Promise<{
  currentSession: ActiveSessionItem | null;
  otherSessions: ActiveSessionItem[];
  totalActiveCount: number;
}> {
  const currentHash = currentRawToken ? hashToken(currentRawToken.trim()) : null;
  const now = new Date();

  const sessions = await prisma.session.findMany({
    where: {
      adminUserId,
      isRevoked: false,
      expiresAt: { gt: now },
    },
    include: {
      trustedDevice: true,
    },
    orderBy: {
      lastActiveAt: "desc",
    },
  });

  let currentSessionItem: ActiveSessionItem | null = null;
  const otherSessions: ActiveSessionItem[] = [];

  for (const s of sessions) {
    const isCurrent = currentHash !== null && s.sessionTokenHash === currentHash;
    const item: ActiveSessionItem = {
      id: s.id,
      deviceLabel: s.deviceLabel || (s.isTrustedDevice ? "Main Shop Device" : "Showroom Device"),
      isCurrent,
      isTrustedDevice: s.isTrustedDevice,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      deviceName: s.trustedDevice?.deviceName,
    };

    if (isCurrent) {
      currentSessionItem = item;
    } else {
      otherSessions.push(item);
    }
  }

  return {
    currentSession: currentSessionItem,
    otherSessions,
    totalActiveCount: sessions.length,
  };
}

// ==============================================================================
// TRUSTED DEVICE MANAGEMENT
// ==============================================================================

/**
 * Revokes a trusted device by ID and revokes all active sessions linked to it.
 */
export async function revokeTrustedDevice(trustedDeviceId: string, adminUserId: string): Promise<boolean> {
  const device = await prisma.trustedDevice.findFirst({
    where: { id: trustedDeviceId, adminUserId },
  });

  if (!device) return false;

  await prisma.$transaction([
    prisma.trustedDevice.update({
      where: { id: trustedDeviceId },
      data: { isRevoked: true },
    }),
    prisma.session.updateMany({
      where: { trustedDeviceId, isRevoked: false },
      data: { isRevoked: true },
    }),
  ]);

  return true;
}

/**
 * Changes the admin password and optionally revokes all other sessions.
 */
export async function changeAdminPassword(options: {
  adminUserId: string;
  currentPassword: string;
  newPassword: string;
  currentSessionToken?: string;
  revokeOtherSessions?: boolean;
}): Promise<void> {
  const { adminUserId, currentPassword, newPassword, currentSessionToken, revokeOtherSessions = true } = options;

  const user = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
  });

  if (!user || !user.passwordHash) {
    throw new AuthError("Admin user not found.", 404, "USER_NOT_FOUND");
  }

  const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new AuthError("Incorrect current password.", 400, "INVALID_CURRENT_PASSWORD");
  }

  if (newPassword.length < 8) {
    throw new AuthError("New password must be at least 8 characters long.", 400, "WEAK_PASSWORD");
  }

  const newHash = hashPassword(newPassword);

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { passwordHash: newHash },
  });

  if (revokeOtherSessions && currentSessionToken) {
    await revokeAllOtherSessions(currentSessionToken, adminUserId);
  }
}

// ==============================================================================
// USER-AGENT UTILITY
// ==============================================================================

function parseDeviceNameFromUserAgent(ua?: string): string {
  if (!ua) return "Web Browser";

  let os = "Device";
  if (ua.includes("Windows NT 10.0")) os = "Windows PC";
  else if (ua.includes("Mac OS X")) os = "Mac";
  else if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("iPad")) os = "iPad";
  else if (ua.includes("Android")) os = "Android Tablet/Phone";
  else if (ua.includes("Linux")) os = "Linux";

  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Firefox";

  return `${browser} on ${os}`;
}
