import { NextRequest } from "next/server";
import { clearSessionCookies } from "@/lib/auth-server";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await clearSessionCookies();
    return handleApiSuccess({
      loggedOut: true,
      redirectUrl: "/login",
      message: "Session terminated successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
