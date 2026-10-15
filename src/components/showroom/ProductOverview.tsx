"use client";

import React, { useMemo } from "react";
import { Sparkles, Package, FileText } from "lucide-react";
import {
  parseProductOverview,
  type ParsedProductOverview,
} from "@/lib/product-overview-parser";

interface ProductOverviewProps {
  description?: string | null;
  className?: string;
}

/**
 * ProductOverview
 *
 * Automatically renders product descriptions as:
 * 1. Two-column Specification Table (Specification | Details)
 * 2. Key Features bullet list (if Key Features: section present)
 * 3. Two-column Included Accessories Table (Accessory | Quantity)
 * 4. Graceful readable fallback for legacy unstructured prose descriptions
 */
export function ProductOverview({ description, className = "" }: ProductOverviewProps) {
  const overview: ParsedProductOverview = useMemo(
    () => parseProductOverview(description),
    [description]
  );

  if (!description || !description.trim()) {
    return null;
  }

  // Fallback for legacy free-form descriptions with no structured Label: Value pairs
  if (!overview.isStructured) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Product Overview
        </h3>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {overview.rawText}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Section Heading */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Product Overview
        </h3>
      </div>

      {/* Optional Leading Unstructured Paragraph */}
      {overview.introText && (
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
          {overview.introText}
        </p>
      )}

      {/* 1. Specification Table */}
      {overview.specifications.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th
                    scope="col"
                    className="py-2.5 px-3.5 sm:px-4 w-5/12 sm:w-1/3 font-semibold text-slate-600"
                  >
                    Specification
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-3.5 sm:px-4 w-7/12 sm:w-2/3 font-semibold text-slate-600"
                  >
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.specifications.map((row, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50/40 hover:bg-slate-50/80 transition-colors"
                    }
                  >
                    <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-700 align-top">
                      {row.label}
                    </td>
                    <td className="py-2.5 px-3.5 sm:px-4 text-slate-900 font-normal align-top break-words">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Key Features Bullet List */}
      {overview.keyFeatures.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Key Features
            </h4>
          </div>
          <ul className="space-y-1.5 pl-1 text-xs sm:text-sm text-slate-700">
            {overview.keyFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <span className="leading-relaxed">{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Included Accessories Table */}
      {overview.accessories.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Included Accessories
            </h4>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th
                      scope="col"
                      className="py-2.5 px-3.5 sm:px-4 w-8/12 sm:w-3/4 font-semibold text-slate-600"
                    >
                      Accessory
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 px-3.5 sm:px-4 w-4/12 sm:w-1/4 font-semibold text-slate-600 text-center sm:text-right"
                    >
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.accessories.map((acc, idx) => (
                    <tr
                      key={idx}
                      className={
                        idx % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/40 hover:bg-slate-50/80 transition-colors"
                      }
                    >
                      <td className="py-2.5 px-3.5 sm:px-4 font-medium text-slate-800 align-top">
                        {acc.accessory}
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 text-slate-700 font-semibold align-top text-center sm:text-right">
                        {acc.quantity ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Trailing Notes / Unstructured Lines */}
      {overview.trailingNotes && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 leading-relaxed whitespace-pre-line space-y-1">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Additional Notes</span>
          </div>
          <p>{overview.trailingNotes}</p>
        </div>
      )}
    </div>
  );
}
