import { clearAdminPinVerifiedCookie } from "@/lib/auth-server";
import { handleApiSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAdminPinVerifiedCookie();
  return handleApiSuccess({
    locked: true,
    message: "Admin dashboard locked. PIN required for next entry.",
  });
}
