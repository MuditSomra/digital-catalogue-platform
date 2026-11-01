"use client";

import React from "react";
import { Share, PlusSquare, X, Store } from "lucide-react";
import { usePwa } from "./PwaContext";

export function IosInstallPrompt() {
  const { showIosBanner, dismissIosBanner } = usePwa();

  if (!showIosBanner) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Install Somra on iPhone"
      className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="bg-slate-900/95 text-white backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 flex items-start gap-3 relative">
        {/* App Icon */}
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-inner">
          <Store className="w-5 h-5 text-white" />
        </div>

        {/* Instructions */}
        <div className="flex-1 min-w-0 pr-6 space-y-1">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>Install Somra on iPhone</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Tap <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" />{" "}
            <strong className="text-white">Share</strong> in Safari, then tap{" "}
            <strong className="text-white">Add to Home Screen</strong>{" "}
            <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" /> for full-screen app access.
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={dismissIosBanner}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          aria-label="Dismiss install instructions"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
