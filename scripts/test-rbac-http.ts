import { prisma } from "../src/lib/prisma";
import { authenticateAdmin, SESSION_COOKIE_NAME } from "../src/lib/auth-service";
import { ADMIN_PIN_COOKIE_NAME } from "../src/lib/auth-server";

async function testRbacHttp() {
  console.log("================================================================================");
  console.log("TESTING HTTP ROUTE & API RBAC AUTHORIZATION");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  try {
    // 1. HTTP Login as Owner
    const ownerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@kitchenshowroom.local",
        password: "Owner@Showroom2026!",
      }),
    });
    const ownerCookie = ownerLoginRes.headers.get("set-cookie");
    assert(ownerLoginRes.ok && Boolean(ownerCookie), "Owner HTTP login succeeds with session cookie");

    // 2. HTTP Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@kitchenshowroom.local",
        password: "Admin@Showroom2026!",
      }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie");
    assert(adminLoginRes.ok && Boolean(adminCookie), "Admin HTTP login succeeds with session cookie");

    // TEST 1: Unauthenticated request to /api/admin/purchasing/quotations -> 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/admin/purchasing/quotations`);
    assert(
      unauthRes.status === 401,
      "Unauthenticated request to Purchasing API is rejected with 401 Unauthorized",
      `Actual status: ${unauthRes.status}`
    );

    // TEST 2: Admin user request to /api/admin/purchasing/quotations -> 403 Forbidden
    const adminRes = await fetch(`${baseUrl}/api/admin/purchasing/quotations`, {
      headers: {
        Cookie: adminCookie || "",
      },
    });
    assert(
      adminRes.status === 403,
      "Admin user request to Purchasing API is rejected with 403 Forbidden",
      `Actual status: ${adminRes.status}`
    );

    const adminBody = await adminRes.json();
    assert(
      adminBody.error?.code === "FORBIDDEN",
      "Forbidden error payload returned to Admin user",
      JSON.stringify(adminBody)
    );

    // TEST 3: Admin user request to /api/admin/purchasing/products -> 403 Forbidden
    const adminPostRes = await fetch(`${baseUrl}/api/admin/purchasing/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie || "",
      },
      body: JSON.stringify({ name: "Unauthorized Attempt" }),
    });
    assert(
      adminPostRes.status === 403,
      "Admin user attempting to create product from Purchasing is rejected with 403 Forbidden",
      `Actual status: ${adminPostRes.status}`
    );

    // TEST 4: Owner user request to /api/admin/purchasing/quotations -> 200 OK
    const ownerRes = await fetch(`${baseUrl}/api/admin/purchasing/quotations`, {
      headers: {
        Cookie: ownerCookie || "",
      },
    });
    assert(
      ownerRes.status === 200,
      "Owner user request to Purchasing API succeeds with 200 OK",
      `Actual status: ${ownerRes.status}`
    );

    const ownerBody = await ownerRes.json();
    assert(
      ownerBody.success === true && Array.isArray(ownerBody.data?.groups),
      "Owner receives full product quotations comparison dataset",
      `Groups count: ${ownerBody.data?.groups?.length}`
    );

    // TEST 5: Session API returns isOwner flag correctly
    const ownerSessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: {
        Cookie: ownerCookie || "",
      },
    });
    const ownerSessionData = await ownerSessionRes.json();
    assert(
      ownerSessionData.data?.user?.isOwner === true,
      "Owner session returns isOwner: true"
    );

    const adminSessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: {
        Cookie: adminCookie || "",
      },
    });
    const adminSessionData = await adminSessionRes.json();
    assert(
      adminSessionData.data?.user?.isOwner === false,
      "Admin session returns isOwner: false"
    );

    console.log("\n================================================================================");
    console.log(`HTTP RBAC SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error("RBAC HTTP test failed with error:", error);
    process.exit(1);
  }
}

testRbacHttp();
