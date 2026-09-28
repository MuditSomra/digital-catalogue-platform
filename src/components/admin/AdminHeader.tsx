"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Home, Sparkles, LogOut, ShieldCheck } from "lucide-react";

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  title?: string;
}

export function AdminHeader({ onToggleSidebar, title }: AdminHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition"
          aria-label="Toggle navigation sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Title or Breadcrumb Indicator */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground transition flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-semibold text-foreground">
            {title || "Category & Specification Management"}
          </span>
        </div>
      </div>

      {/* Right User & Shop Owner Status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Link
          href="/"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 text-xs font-semibold text-primary transition shadow-2xs"
          title="Switch to Customer Showroom"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Customer Showroom</span>
        </Link>

        <div className="flex items-center gap-2 pl-2 border-l border-border/80">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            SO
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-foreground leading-tight">
              Store Owner
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
              Authenticated
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 text-muted-foreground transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          title="Log out of current device"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
}
