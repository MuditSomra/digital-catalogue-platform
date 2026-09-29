"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Store,
  LayoutDashboard,
  Search,
  Scale,
  LogOut,
  ShieldCheck,
  User,
  Lock,
} from "lucide-react";
import { PinModal } from "@/components/ui/PinModal";

interface ShowroomHeaderProps {
  comparedCount?: number;
  onOpenCompare?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export function ShowroomHeader({
  comparedCount = 0,
  onOpenCompare,
  searchQuery = "",
  onSearchChange,
}: ShowroomHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.user?.isOwner) {
            setIsOwner(true);
          }
        }
      } catch {
        // keep defaults
      }
    }
    checkSession();
  }, []);

  // Auto-open PIN modal if redirected from /admin due to direct navigation attempt
  useEffect(() => {
    if (searchParams.get("pin") === "required") {
      setIsPinModalOpen(true);
    }
  }, [searchParams]);

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

  const handleAdminClick = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
    router.push("/admin");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Store Branding */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                Somra Home Products
              </div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight">
                Digital Catalogue & Live Inventory
              </div>
            </div>
          </Link>

          {/* Center Search bar on tablet/desktop */}
          {onSearchChange && (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search gas stoves, chimneys, hobs, brands..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                />
              </div>
            </div>
          )}

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compare Badge Button */}
            {comparedCount > 0 && (
              <Link
                href="/compare"
                className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition"
              >
                <Scale className="w-4 h-4" />
                <span className="hidden sm:inline">Compare</span>
                <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                  {comparedCount}
                </span>
              </Link>
            )}

            {/* Mode Switch: PIN Protected Dashboard Switch */}
            <button
              type="button"
              onClick={handleAdminClick}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer"
              title={isOwner ? "Return to Owner Dashboard (PIN Required)" : "Return to Admin Panel (PIN Required)"}
            >
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden xs:inline">{isOwner ? "Owner Dashboard" : "Admin Panel"}</span>
              <span className="xs:hidden">{isOwner ? "Owner" : "Admin"}</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Log out of current device"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mode Verification PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        title={isOwner ? "Owner Dashboard Access PIN" : "Admin Access PIN"}
        description={isOwner ? "Enter your 4-digit PIN to return to the Owner Dashboard." : "Enter your 4-digit PIN to unlock the Admin Panel."}
        action="admin_access"
      />
    </>
  );
}

