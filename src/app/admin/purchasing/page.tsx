import React from "react";
import { requireOwnerAuth } from "@/lib/auth-server";
import { PurchasingClient } from "./PurchasingClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchasing & Supplier Comparison | Kitchen Showroom",
  description: "Private purchasing portal for category-based supplier quotation comparison and margin analysis.",
};

export default async function AdminPurchasingPage() {
  // Enforce server-side Owner authentication. If user role is not OWNER or SUPER_ADMIN,
  // this immediately redirects to /admin?error=forbidden.
  await requireOwnerAuth("/admin/purchasing");

  return <PurchasingClient />;
}
