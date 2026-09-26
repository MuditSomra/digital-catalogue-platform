"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Scale,
  Eye,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { CatalogueProductItem } from "@/types";

interface ProductCardProps {
  product: CatalogueProductItem;
  isCompared?: boolean;
  onToggleCompare?: (product: CatalogueProductItem) => void;
  canCompare?: boolean;
}

export function ProductCard({
  product,
  isCompared = false,
  onToggleCompare,
  canCompare = true,
}: ProductCardProps) {
  const isOutOfStock = product.inventory.stockStatus === "OUT_OF_STOCK";
  const isLowStock = product.inventory.stockStatus === "LOW_STOCK";

  const [imageError, setImageError] = React.useState(false);

  // Pick top 2-3 specifications to showcase as preview chips
  const highlightSpecs = product.attributeValues.slice(0, 3);

  return (
    <div
      className={`group relative bg-white border rounded-2xl overflow-hidden transition duration-200 flex flex-col h-full ${
        isCompared
          ? "border-blue-500 ring-2 ring-blue-100 shadow-md"
          : "border-slate-200 hover:border-slate-300 hover:shadow-lg shadow-2xs"
      }`}
    >
      {/* Top Image Container - Strictly Enforced 4:3 Aspect Ratio Wrapper */}
      <div
        className="relative w-full aspect-[4/3] bg-slate-50/90 overflow-hidden border-b border-slate-100 shrink-0 select-none"
        style={{ aspectRatio: "4 / 3", width: "100%" }}
      >
        {product.primaryImage && !imageError ? (
          <img
            src={product.primaryImage.url}
            alt={product.primaryImage.altText || product.name}
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-contain p-3 sm:p-4 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-1.5 p-3">
            <Package className="w-12 h-12 stroke-[1.2] text-slate-300" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              No Image
            </span>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          {/* Brand Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/95 backdrop-blur-xs text-slate-800 border border-slate-200/80 shadow-2xs">
            {product.brand.name}
          </span>

          {/* Stock Status Badge */}
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              <XCircle className="w-3 h-3" />
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              <AlertTriangle className="w-3 h-3" />
              Low Stock ({product.inventory.quantity})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-3 h-3" />
              In Stock
            </span>
          )}
        </div>

        {/* Compare Checkbox Button */}
        {onToggleCompare && (
          <div className="absolute bottom-3 right-3 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleCompare(product);
              }}
              disabled={!isCompared && !canCompare}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                isCompared
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : canCompare
                  ? "bg-white/90 hover:bg-white text-slate-700 border border-slate-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              }`}
              title={
                isCompared
                  ? "Remove from comparison"
                  : canCompare
                  ? "Add to comparison (max 3)"
                  : "Maximum 3 products can be compared at once"
              }
            >
              <Scale className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">
                {isCompared ? "Added" : "Compare"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Content Section - Structured with Consistent Vertical Spacing & Fixed Heights */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category breadcrumb preview */}
          <div className="text-[11px] font-medium text-slate-400 truncate h-4 leading-none mb-1">
            {product.category.name}
          </div>

          {/* Product Title - Fixed 2-Line Container with Clamp */}
          <div className="h-11 sm:h-12 flex items-start mb-1.5">
            <Link
              href={`/products/${product.id}`}
              className="block group/link w-full"
            >
              <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover/link:text-blue-600 transition">
                {product.name}
              </h3>
            </Link>
          </div>

          {/* Model Number / SKU */}
          <div className="flex items-center gap-2 text-xs text-slate-500 h-5 mb-2 overflow-hidden">
            {product.modelNumber && (
              <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 truncate">
                Model: {product.modelNumber}
              </span>
            )}
            <span className="font-mono text-[11px] text-slate-400 truncate">
              SKU: {product.sku}
            </span>
          </div>

          {/* Dynamic Specs preview chips (Consistent min-height) */}
          <div className="min-h-[26px] flex flex-wrap gap-1.5 items-center mb-2">
            {highlightSpecs.length > 0 ? (
              highlightSpecs.map((spec) => (
                <span
                  key={spec.id}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 truncate max-w-[130px]"
                >
                  <span className="text-slate-400 font-normal">{spec.attributeName}:</span>{" "}
                  <strong>{spec.value}</strong>
                </span>
              ))
            ) : null}
          </div>
        </div>

        {/* Pricing & Footer Actions - Fixed Baseline Alignment */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              {/* Selling Price */}
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                ₹{(product.sellingPrice ?? product.mrp).toLocaleString("en-IN")}
              </span>

              {/* MRP Strikethrough if selling price exists */}
              {product.sellingPrice && product.sellingPrice < product.mrp && (
                <span className="text-xs font-medium text-slate-400 line-through truncate">
                  ₹{product.mrp.toLocaleString("en-IN")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1 min-h-[20px]">
              {/* Discount Percentage Badge */}
              {product.discountPercent !== null && product.discountPercent > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                  {product.discountPercent}% OFF
                </span>
              )}

              {/* Customer-Visible Price Code */}
              {product.privatePriceCode && (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 shrink-0 truncate max-w-[120px]">
                  Code: {product.privatePriceCode}
                </span>
              )}
            </div>
          </div>

          {/* View Details CTA */}
          <Link
            href={`/products/${product.id}`}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-blue-600 text-white transition shadow-2xs flex items-center gap-1.5 shrink-0 ml-1"
          >
            <span>View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
