import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (service worker)
     * - public files (.svg, .png, .jpg, .webp, .ico, .json, .webmanifest)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)",
  ],
};

const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/health",
  "/manifest.webmanifest",
  "/manifest.json",
  "/sw.js",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public auth & health endpoints
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // 2. Check for existence of session token cookie
  const sessionToken = request.cookies.get("shop_session")?.value;

  // 3. If unauthenticated
  if (!sessionToken || sessionToken.trim().length === 0) {
    // If requesting a protected API endpoint -> return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required. Please log in to access this resource.",
          },
        },
        { status: 401 }
      );
    }

    // If requesting a protected Page -> redirect to login with returnUrl
    const loginUrl = new URL("/login", request.url);
    const returnPath = pathname + request.nextUrl.search;
    if (returnPath !== "/") {
      loginUrl.searchParams.set("returnUrl", returnPath);
    }

    return NextResponse.redirect(loginUrl);
  }

  // 4. Authenticated request -> forward to route handler / server component for full DB session validation
  return NextResponse.next();
}
