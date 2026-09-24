"use client";

import Link from "next/link";
import { Menu, Shield, ArrowLeft, Home, Sparkles } from "lucide-react";

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  title?: string;
}

export function AdminHeader({ onToggleSidebar, title }: AdminHeaderProps) {
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
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Shop Owner View</span>
        </div>

        <div className="flex items-center gap-2.5 pl-2 border-l border-border/80">
          <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground">
            SA
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-foreground leading-tight">
              Store Owner
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              Super Admin
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
