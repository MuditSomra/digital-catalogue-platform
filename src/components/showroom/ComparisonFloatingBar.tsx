"use client";

import React from "react";
import Link from "next/link";
import { Scale, X, ArrowRight, Trash2 } from "lucide-react";
import type { CatalogueProductItem } from "@/types";

interface ComparisonFloatingBarProps {
  comparedProducts: CatalogueProductItem[];
  onRemoveProduct: (productId: string) => void;
  onClearAll: () => void;
}

export function ComparisonFloatingBar({
  comparedProducts,
  onRemoveProduct,
  onClearAll,
}: ComparisonFloatingBarProps) {
  if (comparedProducts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Compared Items Thumbnails */}
        <div className="flex items-center gap-2.5 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-slate-700">
            <Scale className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold whitespace-nowrap">
              Compare ({comparedProducts.length}/3)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {comparedProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 pr-1.5 shrink-0 group"
              >
                {p.primaryImage ? (
                  <img
                    src={p.primaryImage.url}
                    alt={p.name}
                    className="w-6 h-6 object-contain rounded"
                  />
                ) : (
                  <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-[10px]">
                    📦
                  </div>
                )}
                <div className="text-left max-w-[100px] sm:max-w-[130px] truncate">
                  <div className="text-[11px] font-semibold text-white truncate">
                    {p.name}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {p.brand.name} &bull; ₹{(p.sellingPrice ?? p.mrp).toLocaleString("en-IN")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveProduct(p.id)}
                  className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition"
                  title="Remove from comparison"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClearAll}
            className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition"
          >
            Clear
          </button>

          <Link
            href={`/compare?ids=${comparedProducts.map((p) => p.id).join(",")}`}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm flex items-center gap-1.5"
          >
            <span>Compare Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
