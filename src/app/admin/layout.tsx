import React from "react";
import { requireAuth } from "@/lib/auth-server";
import { AdminLayoutShell } from "@/components/admin/AdminLayoutShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication guard for entire /admin tree
  await requireAuth("/admin");

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
