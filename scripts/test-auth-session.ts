import { prisma } from "../src/lib/prisma";
import {
  authenticateAdmin,
  validateSession,
  revokeSession,
  revokeAllOtherSessions,
  changeAdminPassword,
  ensureAdminUserExists,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  hashPassword,
  verifyPassword,
  MAIN_DEVICE_MAX_LIFETIME_MS,
  MAIN_DEVICE_INACTIVITY_TIMEOUT_MS,
  OTHER_DEVICE_MAX_LIFETIME_MS,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
} from "../src/lib/auth-service";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 RUNNING AUTOMATED AUTH & SESSION MANAGEMENT TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || "Assertion failed"}`);
      failed++;
    }
  }

  try {
    // 0. Setup: Ensure admin exists
    const adminUser = await ensureAdminUserExists();
    assert(Boolean(adminUser && adminUser.id), "Admin user exists and is initialized in database");

    // Reset rate limit key before tests
    await resetLoginAttempts(DEFAULT_ADMIN_EMAIL);

    // =========================================================================
    // Test 1: Unauthenticated validation fails
    // =========================================================================
    console.log("\n--- Scenario 1: Unauthenticated Access Protection ---");
    const emptyValidation = await validateSession(null);
    assert(!emptyValidation.isValid && emptyValidation.reason === "MISSING_TOKEN", "Null token rejected as MISSING_TOKEN");

    const invalidValidation = await validateSession("non_existent_fake_token_123456789");
    assert(!invalidValidation.isValid && invalidValidation.reason === "SESSION_NOT_FOUND", "Bogus token rejected as SESSION_NOT_FOUND");

    // =========================================================================
    // Test 2: Brute-Force Rate Limiting
    // =========================================================================
    console.log("\n--- Scenario 2: Brute-Force Rate Limiting ---");
    const testIdentifier = "test-rate-limit@showroom.local";
    await resetLoginAttempts(testIdentifier);

    for (let i = 1; i <= 4; i++) {
      const res = await recordFailedLoginAttempt(testIdentifier);
      assert(!res.isLocked && res.failedAttempts === i, `Failed attempt ${i}/5 correctly increments without locking`);
    }

    const lockedRes = await recordFailedLoginAttempt(testIdentifier);
    assert(lockedRes.isLocked && lockedRes.failedAttempts === 5 && lockedRes.remainingMinutes! > 0, "5th failed attempt triggers 15-minute temporary lockout");

    const checkLock = await checkLoginRateLimit(testIdentifier);
    assert(checkLock.isLocked, "Rate limiter persists locked state in database");
    await resetLoginAttempts(testIdentifier);

    // =========================================================================
    // Test 3: Main Shop Device Authentication (90-day lifetime, 30-day inactivity)
    // =========================================================================
    console.log("\n--- Scenario 3 & 4: Trusted Main Shop Device Session ---");
    const mainAuth = await authenticateAdmin({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      trustThisDevice: true,
      deviceName: "Main Billing Terminal PC",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      ipAddress: "192.168.1.10",
    });

    assert(mainAuth.isTrustedDevice === true, "Main shop device marked as isTrustedDevice = true");
    assert(mainAuth.cookieMaxAgeSec === 90 * 24 * 60 * 60, "Cookie maxAge set to 90 days (7,776,000s)");

    const mainSessionDurationMs = mainAuth.session.expiresAt.getTime() - mainAuth.session.createdAt.getTime();
    assert(
      Math.abs(mainSessionDurationMs - MAIN_DEVICE_MAX_LIFETIME_MS) < 5000,
      "Main device session expiresAt scheduled for 90 days in future"
    );

    const mainValidation = await validateSession(mainAuth.sessionToken);
    assert(mainValidation.isValid === true, "Main shop device session validates successfully");

    // =========================================================================
    // Test 4: Other / Temporary Device Authentication (8-hour lifetime)
    // =========================================================================
    console.log("\n--- Scenario 6: Other / Standard Device Session (8 Hours) ---");
    const otherAuth = await authenticateAdmin({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      trustThisDevice: false,
      deviceName: "Floor Sales Tablet",
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/605.1.15",
      ipAddress: "192.168.1.55",
    });

    assert(otherAuth.isTrustedDevice === false, "Other device marked as isTrustedDevice = false");
    assert(otherAuth.cookieMaxAgeSec === 8 * 60 * 60, "Other device cookie maxAge set to 8 hours (28,800s)");

    const otherSessionDurationMs = otherAuth.session.expiresAt.getTime() - otherAuth.session.createdAt.getTime();
    assert(
      Math.abs(otherSessionDurationMs - OTHER_DEVICE_MAX_LIFETIME_MS) < 5000,
      "Other device session expiresAt scheduled for exactly 8 hours"
    );

    const otherValidation = await validateSession(otherAuth.sessionToken);
    assert(otherValidation.isValid === true, "Other device session validates successfully");

    // =========================================================================
    // Test 5: Multi-Device Concurrency (Logging in on Device B does NOT log out Device A)
    // =========================================================================
    console.log("\n--- Scenario 7: Multi-Device Concurrency ---");
    const mainStillValid = await validateSession(mainAuth.sessionToken);
    assert(mainStillValid.isValid === true, "Main device session remains active after secondary device logs in");

    // =========================================================================
    // Test 6: Inactivity Timeout Enforcement for Main Shop Device (30 Days)
    // =========================================================================
    console.log("\n--- Scenario 5: Main Device Inactivity & Max Lifetime Expiration ---");
    // Simulate 31 days of inactivity on a trusted device session
    const thirtyOneDaysAgo = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000));
    await prisma.session.update({
      where: { id: mainAuth.session.id },
      data: { lastActiveAt: thirtyOneDaysAgo },
    });

    const inactiveValidation = await validateSession(mainAuth.sessionToken);
    assert(
      !inactiveValidation.isValid && inactiveValidation.reason === "INACTIVITY_TIMEOUT",
      "Main device session invalidates after 30+ days of inactivity"
    );

    // Reset lastActiveAt to now for further testing
    await prisma.session.update({
      where: { id: mainAuth.session.id },
      data: { lastActiveAt: new Date(), isRevoked: false },
    });

    // =========================================================================
    // Test 7: Standard Device 8-Hour Expiration Enforcement
    // =========================================================================
    console.log("\n--- Standard Device 8-Hour Cutoff Enforcement ---");
    // Simulate 9 hours passed on standard device
    const nineHoursAgo = new Date(Date.now() - (9 * 60 * 60 * 1000));
    await prisma.session.update({
      where: { id: otherAuth.session.id },
      data: { expiresAt: nineHoursAgo },
    });

    const expiredOtherValidation = await validateSession(otherAuth.sessionToken);
    assert(
      !expiredOtherValidation.isValid && expiredOtherValidation.reason === "SESSION_EXPIRED",
      "Standard device session invalidates after 8 hours"
    );

    // =========================================================================
    // Test 8: Independent Session Revocation (Logging out on B does not log out A)
    // =========================================================================
    console.log("\n--- Scenario 8: Independent Session Revocation ---");
    // Create new Device B and Device C
    const devB = await authenticateAdmin({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      trustThisDevice: false,
      deviceName: "Tablet B",
    });
    const devC = await authenticateAdmin({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      trustThisDevice: false,
      deviceName: "Phone C",
    });

    // Revoke Device B
    const revokedB = await revokeSession(devB.session.id, adminUser.id);
    assert(revokedB === true, "Device B session revoked successfully");

    const checkDevB = await validateSession(devB.sessionToken);
    assert(!checkDevB.isValid && checkDevB.reason === "SESSION_REVOKED", "Device B cannot access protected resources");

    const checkDevC = await validateSession(devC.sessionToken);
    assert(checkDevC.isValid === true, "Device C session remains fully active after Device B was revoked");

    // =========================================================================
    // Test 9: Revoke All Other Sessions Action
    // =========================================================================
    console.log("\n--- Scenario 9: Revoke All Other Sessions ---");
    const countRevoked = await revokeAllOtherSessions(devC.sessionToken, adminUser.id);
    assert(countRevoked >= 1, `Revoke-others successfully revoked ${countRevoked} other sessions`);

    const checkDevCAfterBulk = await validateSession(devC.sessionToken);
    assert(checkDevCAfterBulk.isValid === true, "Current device (Device C) remains active after revoking others");

    // =========================================================================
    // Test 10: Existing Shop & Catalogue Features Working
    // =========================================================================
    console.log("\n--- Scenario 10: Existing Features Continuity ---");
    const categoryCount = await prisma.category.count();
    const productCount = await prisma.product.count();
    const inventoryCount = await prisma.inventory.count();

    assert(categoryCount > 0, `Category management data intact (${categoryCount} categories found)`);
    assert(productCount > 0, `Product catalogue data intact (${productCount} products found)`);
    assert(inventoryCount > 0, `Inventory management data intact (${inventoryCount} inventory records found)`);

  } catch (error) {
    console.error("❌ Unexpected test exception:", error);
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
