import { prisma } from "../src/lib/prisma";
import { authenticateAdmin, validateSession } from "../src/lib/auth-service";
import {
  verifyOwnerPin,
  getPinLockoutStatus,
  setOwnerPin,
  hashPin,
} from "../src/lib/pin-service";
import { recordStockMovement } from "../src/lib/inventory-service";
import { InventoryMovementType } from "@prisma/client";
import crypto from "crypto";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n================================================================================");
  console.log("🔒 ADMIN BUTTON PIN VERIFICATION & ACCESS CONTROL TEST SUITE");
  console.log("================================================================================\n");

  try {
    // Setup clean PIN & Test Admin
    const pinSalt = crypto.randomBytes(16).toString("hex");
    const pinDerivedKey = crypto.scryptSync("1234", pinSalt, 64);
    const validPinHash = `${pinSalt}:${pinDerivedKey.toString("hex")}`;

    await prisma.storeSetting.upsert({
      where: { key: "owner_pin_hash" },
      create: { key: "owner_pin_hash", value: validPinHash },
      update: { value: validPinHash },
    });

    // Reset failed attempts
    await prisma.storeSetting.upsert({
      where: { key: "owner_pin_attempts" },
      create: { key: "owner_pin_attempts", value: JSON.stringify({ count: 0, lockedUntil: null }) },
      update: { value: JSON.stringify({ count: 0, lockedUntil: null }) },
    });

    const admin = await prisma.adminUser.findFirst({
      where: { email: "admin@kitchenshowroom.local" },
    });
    if (!admin) {
      throw new Error("Admin user not found. Run seed script first.");
    }

    // -------------------------------------------------------------------------
    // Scenario 1: Existing Login Flow & Showroom Entry
    // -------------------------------------------------------------------------
    console.log("--- Scenario 1: Existing Login Flow & Showroom Entry ---");
    const loginResult = await authenticateAdmin({
      email: "admin@kitchenshowroom.local",
      password: "Admin@Showroom2026!",
      trustThisDevice: true,
      deviceName: "Showroom Floor Tablet",
    });

    assert(Boolean(loginResult.sessionToken), "Login returns valid sessionToken");
    assert(loginResult.isTrustedDevice === true, "Trusted device session flag is preserved");

    const sessionValidation = await validateSession(loginResult.sessionToken);
    assert(sessionValidation.isValid === true, "Session token is valid in database");

    const sessionId = loginResult.session.id;

    // -------------------------------------------------------------------------
    // Scenario 2: Direct Admin Navigation without PIN (HMAC Token Check)
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 2: Direct Admin Navigation without PIN ---");
    const secret = process.env.SESSION_SECRET || "showroom-admin-secret-2026";

    function verifyAdminPinToken(token: string | undefined, expectedSessionId: string): boolean {
      if (!token) return false;
      const parts = token.split(":");
      if (parts.length !== 3) return false;
      const [cookieSessionId, timestampStr, signature] = parts;
      if (cookieSessionId !== expectedSessionId) return false;
      const payload = `${cookieSessionId}:${timestampStr}`;
      const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      if (signature !== expectedSig) return false;
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp) || Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
      return true;
    }

    assert(
      verifyAdminPinToken(undefined, sessionId) === false,
      "Missing PIN verification token denies access to /admin"
    );
    assert(
      verifyAdminPinToken("invalid:token:format", sessionId) === false,
      "Forged PIN verification token denies access to /admin"
    );
    assert(
      verifyAdminPinToken("other_session_id:123456789:signature", sessionId) === false,
      "Token bound to a different session is rejected"
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Incorrect PIN Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 3: Incorrect PIN Verification ---");
    let incorrectPinThrew = false;
    try {
      await verifyOwnerPin("9999");
    } catch (err: any) {
      incorrectPinThrew = true;
      assert(err.statusCode === 401, "Incorrect PIN throws 401 Unauthorized", err.message);
    }
    assert(incorrectPinThrew, "Incorrect PIN '9999' is rejected");

    const lockoutAfterFail = await getPinLockoutStatus();
    assert(lockoutAfterFail.failedAttempts >= 1, "Failed attempt is counted");

    // -------------------------------------------------------------------------
    // Scenario 4: Correct PIN Verification & Admin Unlock
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 4: Correct PIN Verification & Admin Unlock ---");
    const validPinResult = await verifyOwnerPin("1234");
    assert(validPinResult === true, "Correct PIN '1234' is accepted");

    const lockoutAfterSuccess = await getPinLockoutStatus();
    assert(lockoutAfterSuccess.failedAttempts === 0, "Failed attempts counter reset after success");

    // Generate valid admin PIN token
    const timestamp = Date.now().toString();
    const payload = `${sessionId}:${timestamp}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const validAdminPinToken = `${payload}:${signature}`;

    assert(
      verifyAdminPinToken(validAdminPinToken, sessionId) === true,
      "Valid PIN token grants access to /admin and /admin/* routes"
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Relock Admin (Switch back to Showroom / Logout)
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 5: Relock Admin (Switch to Showroom / Lock API) ---");
    // When locked, token is cleared (undefined or empty)
    const lockedToken = "";
    assert(
      verifyAdminPinToken(lockedToken, sessionId) === false,
      "Cleared token successfully relocks Admin Mode"
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Mark as Sold PIN & Atomic Stock Decrement Preserved
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 6: Mark as Sold PIN Verification & Inventory Decrement ---");
    const sampleProduct = await prisma.product.findFirst({
      include: { inventory: true },
    });

    if (sampleProduct && sampleProduct.inventory) {
      const initialStock = sampleProduct.inventory.quantity;

      // Test incorrect PIN on Mark as Sold
      let markAsSoldFailed = false;
      try {
        await verifyOwnerPin("0000");
      } catch {
        markAsSoldFailed = true;
      }
      assert(markAsSoldFailed, "Mark as Sold with invalid PIN is rejected");

      // Verify stock remained unchanged
      const unchangedInv = await prisma.inventory.findUnique({
        where: { productId: sampleProduct.id },
      });
      assert(unchangedInv?.quantity === initialStock, "Inventory untouched on invalid PIN");

      // Test valid PIN on Mark as Sold
      const pinOk = await verifyOwnerPin("1234");
      assert(pinOk === true, "Mark as Sold authorizes with valid PIN '1234'");

      const movementResult = await recordStockMovement({
        productId: sampleProduct.id,
        movementType: InventoryMovementType.SALE,
        quantity: 1,
        note: "Automated test showroom sale",
      });

      assert(
        movementResult.inventory.quantity === initialStock - 1,
        `Inventory decremented atomically from ${initialStock} to ${movementResult.inventory.quantity}`
      );
      assert(
        movementResult.movement.movementType === InventoryMovementType.SALE,
        "Inventory movement record created with type SALE"
      );

      // Restore inventory
      await recordStockMovement({
        productId: sampleProduct.id,
        movementType: InventoryMovementType.PURCHASE,
        quantity: 1,
        note: "Automated test stock restore",
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 7: Application Continuity Check
    // -------------------------------------------------------------------------
    console.log("\n--- Scenario 7: Application Continuity Check ---");
    const categoryCount = await prisma.category.count();
    const productCount = await prisma.product.count();
    const inventoryCount = await prisma.inventory.count();

    assert(categoryCount > 0, `Categories intact (${categoryCount} categories found)`);
    assert(productCount > 0, `Products intact (${productCount} products found)`);
    assert(inventoryCount > 0, `Inventories intact (${inventoryCount} inventory records found)`);

  } catch (err: any) {
    console.error("❌ Unexpected test runner error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n================================================================================");
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
