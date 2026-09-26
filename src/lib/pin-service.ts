import crypto from "crypto";
import { prisma } from "./prisma";

const PIN_SETTING_KEY = "owner_pin_hash";
const PIN_ATTEMPTS_KEY = "owner_pin_attempts";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export class PinServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "PinServiceError";
  }
}

/**
 * Hashes a 4-digit PIN with a random 16-byte salt using scrypt.
 * Output format: "salt:hash"
 */
export function hashPin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) {
    throw new PinServiceError("PIN must be exactly 4 numeric digits.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(pin, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a PIN candidate against a stored "salt:hash" string using constant-time comparison.
 */
export function verifyPinHash(pin: string, storedSaltAndHash: string): boolean {
  if (!/^\d{4}$/.test(pin) || !storedSaltAndHash.includes(":")) {
    return false;
  }
  const [salt, storedHash] = storedSaltAndHash.split(":");
  if (!salt || !storedHash) return false;

  const derivedKey = crypto.scryptSync(pin, salt, 64);
  const storedKeyBuffer = Buffer.from(storedHash, "hex");
  const derivedKeyBuffer = derivedKey;

  if (storedKeyBuffer.length !== derivedKeyBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedKeyBuffer, derivedKeyBuffer);
}

/**
 * Checks if the owner PIN is configured in the system.
 */
export async function isOwnerPinConfigured(): Promise<boolean> {
  // Check in StoreSetting first
  const setting = await prisma.storeSetting.findUnique({
    where: { key: PIN_SETTING_KEY },
  });
  if (setting && setting.value.trim().length > 0) {
    return true;
  }

  // Check AdminUser table as fallback
  const adminWithPin = await prisma.adminUser.findFirst({
    where: { pinHash: { not: null } },
    select: { id: true },
  });
  return Boolean(adminWithPin);
}

/**
 * Retrieves lockout info if currently locked out due to repeated failed attempts.
 */
export async function getPinLockoutStatus(): Promise<{
  isLocked: boolean;
  remainingMinutes?: number;
  failedAttempts: number;
}> {
  const attemptsSetting = await prisma.storeSetting.findUnique({
    where: { key: PIN_ATTEMPTS_KEY },
  });

  if (!attemptsSetting) {
    return { isLocked: false, failedAttempts: 0 };
  }

  try {
    const data = JSON.parse(attemptsSetting.value);
    const count = data.count || 0;
    const lockedUntil = data.lockedUntil ? new Date(data.lockedUntil) : null;

    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      const remainingMs = lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      return { isLocked: true, remainingMinutes, failedAttempts: count };
    }

    // Lockout period has elapsed, reset counter if it was locked
    if (lockedUntil && lockedUntil.getTime() <= Date.now()) {
      await resetFailedAttempts();
      return { isLocked: false, failedAttempts: 0 };
    }

    return { isLocked: false, failedAttempts: count };
  } catch {
    return { isLocked: false, failedAttempts: 0 };
  }
}

/**
 * Records a failed PIN attempt and triggers temporary lockout if threshold is exceeded.
 */
async function recordFailedAttempt(): Promise<{ isLocked: boolean; remainingMinutes?: number }> {
  const attemptsSetting = await prisma.storeSetting.findUnique({
    where: { key: PIN_ATTEMPTS_KEY },
  });

  let count = 0;
  if (attemptsSetting) {
    try {
      const parsed = JSON.parse(attemptsSetting.value);
      count = parsed.count || 0;
    } catch {
      count = 0;
    }
  }

  count += 1;
  let lockedUntil: Date | null = null;
  let isLocked = false;
  let remainingMinutes: number | undefined;

  if (count >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    isLocked = true;
    remainingMinutes = LOCKOUT_MINUTES;
  }

  const payload = JSON.stringify({
    count,
    lastAttempt: new Date().toISOString(),
    lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
  });

  await prisma.storeSetting.upsert({
    where: { key: PIN_ATTEMPTS_KEY },
    create: { key: PIN_ATTEMPTS_KEY, value: payload },
    update: { value: payload },
  });

  return { isLocked, remainingMinutes };
}

/**
 * Resets failed attempts after a successful PIN verification.
 */
async function resetFailedAttempts(): Promise<void> {
  await prisma.storeSetting.upsert({
    where: { key: PIN_ATTEMPTS_KEY },
    create: {
      key: PIN_ATTEMPTS_KEY,
      value: JSON.stringify({ count: 0, lockedUntil: null }),
    },
    update: {
      value: JSON.stringify({ count: 0, lockedUntil: null }),
    },
  });
}

/**
 * Verifies the owner PIN with server-side rate limiting and temporary lockout.
 */
export async function verifyOwnerPin(candidatePin: string): Promise<boolean> {
  if (!candidatePin || !/^\d{4}$/.test(candidatePin)) {
    throw new PinServiceError("PIN must be a 4-digit number.");
  }

  // Check lockout status
  const lockout = await getPinLockoutStatus();
  if (lockout.isLocked) {
    throw new PinServiceError(
      `Too many incorrect attempts. PIN verification is locked for ${lockout.remainingMinutes} more minute(s).`,
      429
    );
  }

  // Retrieve stored hash
  let storedHash: string | null = null;

  const setting = await prisma.storeSetting.findUnique({
    where: { key: PIN_SETTING_KEY },
  });
  if (setting && setting.value) {
    storedHash = setting.value;
  } else {
    const adminWithPin = await prisma.adminUser.findFirst({
      where: { pinHash: { not: null } },
      select: { pinHash: true },
    });
    if (adminWithPin?.pinHash) {
      storedHash = adminWithPin.pinHash;
    }
  }

  if (!storedHash) {
    throw new PinServiceError(
      "Owner PIN is not configured yet. Please configure a 4-digit PIN in Admin Settings.",
      400
    );
  }

  const isValid = verifyPinHash(candidatePin, storedHash);

  if (!isValid) {
    const failed = await recordFailedAttempt();
    if (failed.isLocked) {
      throw new PinServiceError(
        `Incorrect PIN. You have exceeded maximum attempts. Locked for ${LOCKOUT_MINUTES} minutes.`,
        429
      );
    }
    const remainingAttempts = MAX_FAILED_ATTEMPTS - (lockout.failedAttempts + 1);
    throw new PinServiceError(
      `Incorrect PIN. ${remainingAttempts} attempt(s) remaining before temporary lockout.`,
      401
    );
  }

  // Reset failed attempts on success
  await resetFailedAttempts();
  return true;
}

/**
 * Sets or updates the 4-digit owner PIN.
 * If a PIN is already configured, currentPin must be provided and verified.
 */
export async function setOwnerPin(input: {
  newPin: string;
  currentPin?: string;
}): Promise<{ success: boolean; message: string }> {
  const { newPin, currentPin } = input;

  if (!/^\d{4}$/.test(newPin)) {
    throw new PinServiceError("New PIN must be exactly 4 numeric digits.");
  }

  const isConfigured = await isOwnerPinConfigured();

  if (isConfigured) {
    if (!currentPin) {
      throw new PinServiceError("Current PIN is required to set a new PIN.", 400);
    }
    // Verify current PIN (respects lockouts)
    await verifyOwnerPin(currentPin);
  }

  // Hash and save new PIN
  const saltAndHash = hashPin(newPin);

  await prisma.storeSetting.upsert({
    where: { key: PIN_SETTING_KEY },
    create: { key: PIN_SETTING_KEY, value: saltAndHash },
    update: { value: saltAndHash },
  });

  // Also sync to first AdminUser
  const firstAdmin = await prisma.adminUser.findFirst({
    select: { id: true },
  });
  if (firstAdmin) {
    await prisma.adminUser.update({
      where: { id: firstAdmin.id },
      data: { pinHash: saltAndHash },
    });
  }

  // Reset failed attempts
  await resetFailedAttempts();

  return {
    success: true,
    message: isConfigured
      ? "Owner PIN updated successfully."
      : "Owner PIN configured successfully.",
  };
}

/**
 * Resets the owner PIN securely (for authenticated admin who forgot the PIN).
 */
export async function resetOwnerPin(newPin: string): Promise<{ success: boolean; message: string }> {
  if (!/^\d{4}$/.test(newPin)) {
    throw new PinServiceError("New PIN must be exactly 4 numeric digits.");
  }

  const saltAndHash = hashPin(newPin);

  await prisma.storeSetting.upsert({
    where: { key: PIN_SETTING_KEY },
    create: { key: PIN_SETTING_KEY, value: saltAndHash },
    update: { value: saltAndHash },
  });

  const firstAdmin = await prisma.adminUser.findFirst({ select: { id: true } });
  if (firstAdmin) {
    await prisma.adminUser.update({
      where: { id: firstAdmin.id },
      data: { pinHash: saltAndHash },
    });
  }

  await resetFailedAttempts();

  return {
    success: true,
    message: "Owner PIN has been reset successfully.",
  };
}
