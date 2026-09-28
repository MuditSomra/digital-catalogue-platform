"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Home, Sparkles, LogOut, ShieldCheck, Crown, User } from "lucide-react";

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  title?: string;
}

export function AdminHeader({ onToggleSidebar, title }: AdminHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userRole, setUserRole] = useState<string>("OWNER");
  const [userName, setUserName] = useState<string>("Store Owner");

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.user) {
            setUserRole(json.data.user.role);
            setUserName(json.data.user.name || (json.data.user.role === "OWNER" ? "Store Owner" : "Store Admin"));
          }
        }
      } catch {
        // keep defaults
      }
    }
    loadUser();
  }, []);

  const isOwner = userRole === "OWNER" || userRole === "SUPER_ADMIN";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || (isOwner ? "SO" : "SA");

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

  const handleExitToShowroom = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/admin/pin/lock", { method: "POST" });
    } catch {
      // Continue navigation
    }
    router.push("/");
    router.refresh();
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
            {title || "Retail Management"}
          </span>
        </div>
      </div>

      {/* Right User & Shop Owner Status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={handleExitToShowroom}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 text-xs font-semibold text-primary transition shadow-2xs cursor-pointer"
          title="Switch to Customer Showroom"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Customer Showroom</span>
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-border/80">
          <div
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
              isOwner
                ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                : "bg-primary/10 border-primary/20 text-primary"
            }`}
          >
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-foreground leading-tight flex items-center gap-1">
              <span>{userName}</span>
              {isOwner && <Crown className="w-3 h-3 text-amber-400" />}
            </div>
            <div className="text-[10px] font-medium leading-tight">
              {isOwner ? (
                <span className="text-amber-400">Owner Access</span>
              ) : (
                <span className="text-emerald-400">Admin Staff</span>
              )}
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
