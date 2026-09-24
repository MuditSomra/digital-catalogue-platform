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
    href: "#",
    icon: ImageIcon,
    disabled: true,
    badge: "Phase 5",
  },
  {
    name: "Settings",
    href: "#",
    icon: Settings,
    disabled: true,
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
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
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

            if (item.disabled) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground/50 cursor-not-allowed select-none"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground/70 border border-border/50">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition group ${
                  isCurrent
                    ? "bg-primary/15 text-primary border border-primary/25 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
                        ? "bg-primary/20 text-primary border-primary/30"
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

        {/* Quick System Helper & Shop Info */}
        <div className="p-4 border-t border-border bg-muted/20 m-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>Dynamic Catalogue</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Create categories and custom specifications for your kitchen appliance showroom.
          </p>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Phase 2 System</span>
          </div>
          <Link
            href="/"
            className="text-xs text-primary hover:underline"
            target="_blank"
          >
            Overview &rarr;
          </Link>
        </div>
      </aside>
    </>
  );
}
