"use client";

import React from "react";
import { Download } from "lucide-react";
import { usePwa } from "./PwaContext";

interface InstallPwaButtonProps {
  className?: string;
  variant?: "header" | "sidebar" | "banner";
}

export function InstallPwaButton({
  className = "",
  variant = "header",
}: InstallPwaButtonProps) {
  const { isInstallable, installApp } = usePwa();

  // If the browser does not provide an installation opportunity or app is installed, render nothing
  if (!isInstallable) {
    return null;
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={installApp}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600/10 text-blue-700 hover:bg-blue-600/20 border border-blue-500/20 transition cursor-pointer ${className}`}
        title="Install Somra as an App on your phone"
      >
        <Download className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="truncate">Install Somra App</span>
      </button>
    );
  }

  // Default header variant: sleek, compact, matching existing header buttons
  return (
    <button
      type="button"
      onClick={installApp}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition shadow-2xs cursor-pointer ${className}`}
      title="Install Somra as an App on your phone"
    >
      <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      <span>Install App</span>
    </button>
  );
}
