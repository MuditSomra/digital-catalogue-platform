"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Package,
  Boxes,
  Image as ImageIcon,
  Settings,
  ChevronRight,
  Store,
  SlidersHorizontal,
} from "lucide-react";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    active: false,
    badge: null,
  },
  {
    name: "Categories",
    href: "/admin/categories",
    icon: Layers,
    description: "Structure & Specifications",
    active: true,
    badge: "Phase 2",
  },
  {
    name: "Products",
    href: "/admin/products",
    icon: Package,
    description: "Showroom Catalogue",
    active: true,
    badge: "Phase 3",
  },
  {
    name: "Inventory",
    href: "/admin/inventory",
    icon: Boxes,
    description: "Stock & Movements",
    active: true,
    badge: "Phase 4",
  },
  {
    name: "Media Gallery",
    href: "/admin/media",
    icon: ImageIcon,
    description: "Product Photos & Videos",
    active: true,
    badge: "Phase 5",
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "PIN & Security",
    active: true,
    badge: "Phase 6",
  },
];

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-3 group"
            onClick={onClose}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground tracking-tight">
                Kitchen Appliances
              </div>
              <div className="text-xs text-muted-foreground">Retail Management</div>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Catalogue Management
          </div>

          {navItems.map((item) => {
            const isCurrent =
              item.href !== "#" &&
              (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition group ${
                  isCurrent
                    ? "bg-primary/10 text-primary border border-primary/25 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <div className="truncate">
                    <span>{item.name}</span>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                      isCurrent
                        ? "bg-primary/15 text-primary border-primary/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Showroom Mode Switcher */}
        <div className="p-3 border-t border-border bg-muted/40 m-3 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Mode Switch</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Admin Active
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Switch to the customer showroom view for client demonstrations.
          </p>
          <Link
            href="/"
            className="w-full py-2 px-3 rounded-xl bg-background hover:bg-card border border-border text-foreground hover:text-primary text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
          >
            <Store className="w-3.5 h-3.5 text-primary" />
            <span>Customer Showroom &rarr;</span>
          </Link>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Showroom System</span>
          </div>
          <Link
            href="/admin/settings"
            className="text-xs text-primary hover:underline"
          >
            PIN Security
          </Link>
        </div>
      </aside>
    </>
  );
}
