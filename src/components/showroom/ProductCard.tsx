"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Scale,
  ArrowRight,
  Check,
  Copy,
} from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/cloudinary-url";

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
  const router = useRouter();
  const isOutOfStock = product.inventory.stockStatus === "OUT_OF_STOCK";
  const isLowStock = product.inventory.stockStatus === "LOW_STOCK";

  const [imageError, setImageError] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);

  // Desktop/tablet preview chips (top 3 attribute values unchanged)
  const highlightSpecs = product.attributeValues.slice(0, 3);

  // Mobile portrait required specifications only (max 3, sorted by sortOrder)
  const requiredSpecs = React.useMemo(() => {
    return (product.attributeValues || [])
      .filter((av) => av.isRequired === true && Boolean(av.value && av.value.trim()))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .slice(0, 3);
  }, [product.attributeValues]);

  // Optional size descriptor for mobile category line (e.g. "Kitchen Chimney • 90 cm")
  // const sizeSpec = React.useMemo(() => {
  //   const found = (product.attributeValues || []).find((av) => {
  //     const name = av.attributeName?.toLowerCase() || "";
  //     const slug = av.attributeSlug?.toLowerCase() || "";
  //     return name.includes("size") || slug.includes("size");
  //   });
  //   return found ? `${found.value}${found.unit ? ` ${found.unit}` : ""}` : null;
  // }, [product.attributeValues]);
  const sizeSpec = React.useMemo(() => {
    const sizeKeywords = [
      "size",
      "capacity",
      "dimension",
      "width",
      "height",
      "depth",
      "length",
      "diameter",
      "volume",
      "number of jugs",
      "no of jugs",
      "jug count",
      "burner count",
      "number of burners",
      "no of burners",
    ];

    const found = (product.attributeValues || []).find((av) => {
      const name = av.attributeName?.toLowerCase() || "";
      const slug = av.attributeSlug?.toLowerCase() || "";

      return sizeKeywords.some(
        (keyword) => name.includes(keyword) || slug.includes(keyword)
      );
    });

    return found ? `${found.value}${found.unit ? ` ${found.unit}` : ""}` : null;
  }, [product.attributeValues]);

  // Pricing calculations
  const hasValidSellingPrice =
    product.sellingPrice != null && Number(product.sellingPrice) > 0;
  const hasValidMrp = product.mrp != null && Number(product.mrp) > 0;
  const mrpNum = Number(product.mrp);
  const sellingPriceNum = hasValidSellingPrice ? Number(product.sellingPrice) : null;
  const primaryPrice = hasValidSellingPrice
    ? sellingPriceNum
    : hasValidMrp
      ? mrpNum
      : null;
  const showCrossedOutMrp =
    hasValidSellingPrice && hasValidMrp && mrpNum > sellingPriceNum!;
  const showDiscount =
    hasValidSellingPrice &&
    product.discountPercent !== null &&
    product.discountPercent > 0;

  const optimizedImageUrl = product.primaryImage?.url
    ? getOptimizedImageUrl(product.primaryImage.url, {
      width: 500,
      height: 375,
      crop: "fill",
      quality: "auto:good",
      format: "auto",
    })
    : "";

  const handleCopyPriceCode = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (product.privatePriceCode) {
      navigator.clipboard.writeText(product.privatePriceCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("[data-no-card-nav]")
    ) {
      return;
    }
    router.push(`/products/${product.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative bg-white border rounded-2xl overflow-hidden transition duration-200 flex flex-col h-full cursor-pointer ${isCompared
        ? "border-blue-500 ring-2 ring-blue-100 shadow-md"
        : "border-slate-200 hover:border-slate-300 hover:shadow-lg shadow-2xs"
        }`}
    >
      {/* ========================================================================= */}
      {/* 1. MOBILE PORTRAIT CARD VIEW (Scoped strictly to < 640px / sm:hidden)      */}
      {/* Matches the approved portrait mockup layout                               */}
      {/* ========================================================================= */}
      <div className="flex sm:hidden flex-col p-4 h-full select-none">
        {/* 1. Brand label and stock-status badge */}
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 tracking-wide uppercase">
            {product.brand.name}
          </span>

          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              <XCircle className="w-3.5 h-3.5" />
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock ({product.inventory.quantity})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              In Stock ({product.inventory.quantity})
            </span>
          )}
        </div>

        {/* 2. Large, recognizable product image */}
        <div className="relative w-full aspect-[4/3] bg-white rounded-xl overflow-hidden flex items-center justify-center my-2 select-none">
          {optimizedImageUrl && !imageError ? (
            <img
              src={optimizedImageUrl}
              alt={product.primaryImage?.altText || product.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-contain p-2"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 gap-1.5 p-3">
              <Package className="w-12 h-12 stroke-[1.2] text-slate-300" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                No Image
              </span>
            </div>
          )}

          {/* Compare Checkbox Button on mobile */}
          {onToggleCompare && (
            <div className="absolute bottom-1.5 right-1.5 z-10" data-no-card-nav>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleCompare(product);
                }}
                disabled={!isCompared && !canCompare}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs ${isCompared
                  ? "bg-blue-600 text-white"
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
                {isCompared && <span className="text-[10px] font-bold">Added</span>}
              </button>
            </div>
          )}
        </div>

        {/* 3. Product name and optional short category descriptor */}
        <div className="mt-1 mb-2">
          <h3 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2">
            {product.name}
          </h3>
          <div className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
            {product.category.name}
            {sizeSpec ? ` • ${sizeSpec}` : ""}
          </div>
        </div>

        {/* 4. Price section */}
        {primaryPrice !== null && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{primaryPrice.toLocaleString("en-IN")}
            </span>
            {showCrossedOutMrp && (
              <span className="text-sm font-semibold text-slate-400 line-through">
                ₹{mrpNum.toLocaleString("en-IN")}
              </span>
            )}
            {showDiscount && (
              <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60 shrink-0">
                {product.discountPercent}% OFF
              </span>
            )}
          </div>
        )}

        {/* 5. Dedicated price-code section with copy button */}
        {product.privatePriceCode && (
          <div className="bg-blue-50/70 border border-blue-100/90 rounded-2xl p-3 flex items-center justify-between mt-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-100/80 flex items-center justify-center text-blue-600 shrink-0">
                <Tag className="w-5 h-5 -rotate-45" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-slate-500 leading-tight block">
                  Price Code
                </span>
                <span className="text-base font-extrabold text-slate-900 tracking-tight leading-snug truncate block">
                  {product.privatePriceCode}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyPriceCode}
              className="min-w-[40px] min-h-[40px] rounded-xl bg-blue-100/70 hover:bg-blue-200/80 text-blue-600 transition flex items-center justify-center cursor-pointer shrink-0 ml-2"
              title="Copy price code"
              aria-label="Copy price code"
              data-no-card-nav
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-blue-600 shrink-0" />
              )}
            </button>
          </div>
        )}

        {/* 6. Required specifications in a compact text-only row */}
        {requiredSpecs.length > 0 && (
          <div
            className={`grid divide-x divide-slate-100 py-3 mt-3 border-t border-b border-slate-100/80 ${requiredSpecs.length === 1
              ? "grid-cols-1"
              : requiredSpecs.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
              }`}
          >
            {requiredSpecs.map((spec, idx) => (
              <div
                key={spec.id || spec.attributeId || idx}
                className={`px-2 min-w-0 ${idx === 0
                  ? "pl-0 text-left"
                  : idx === requiredSpecs.length - 1
                    ? "pr-0 text-left"
                    : "text-left"
                  }`}
              >
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  {spec.attributeName}
                </div>
                <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                  {spec.value}
                  {spec.unit ? ` ${spec.unit}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 7. Full-width View Details button */}
        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={() => router.push(`/products/${product.id}`)}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABLET & DESKTOP CARD VIEW (Visible on >= 640px / sm:flex)             */}
      {/* Completely untouched layout, classes, image sizing, spacing, & typography */}
      {/* ========================================================================= */}
      <div className="hidden sm:flex flex-col h-full">
        {/* Top Image Container - Strictly Enforced 4:3 Aspect Ratio Wrapper */}
        <div
          className="relative w-full aspect-[4/3] bg-slate-50/90 overflow-hidden border-b border-slate-100 shrink-0 select-none"
          style={{ aspectRatio: "4 / 3", width: "100%" }}
        >
          {optimizedImageUrl && !imageError ? (
            <img
              src={optimizedImageUrl}
              alt={product.primaryImage?.altText || product.name}
              onError={() => setImageError(true)}
              className="absolute inset-0 w-full h-full object-contain p-3 sm:p-4 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
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
            <div className="absolute bottom-3 right-3 z-10" data-no-card-nav>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleCompare(product);
                }}
                disabled={!isCompared && !canCompare}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${isCompared
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

              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 min-h-[26px]">
                {/* Discount Percentage Badge */}
                {product.discountPercent !== null && product.discountPercent > 0 && (
                  <span className="inline-flex items-center min-h-[26px] px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80 shrink-0">
                    {product.discountPercent}% OFF
                  </span>
                )}

                {/* Customer-Visible Price Code */}
                {product.privatePriceCode && (
                  <span className="inline-flex items-center min-h-[26px] gap-1 text-slate-500 bg-slate-100 px-2 sm:px-2.5 py-0.5 rounded-md border border-slate-200/80 shrink-0 whitespace-nowrap">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Code:</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800">{product.privatePriceCode}</span>
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
    </div>
  );
}
