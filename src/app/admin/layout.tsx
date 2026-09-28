import React from "react";
import { requireAdminAuth } from "@/lib/auth-server";
import { AdminLayoutShell } from "@/components/admin/AdminLayoutShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication & PIN verification guard for entire /admin tree
  await requireAdminAuth("/admin");

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}

