"use client";

import React from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  Check,
  ChevronDown,
  Layers,
  Tag,
  DollarSign,
  IndianRupee,
  Hash,
  PackageCheck,
  Sparkles,
  X,
  AlertCircle,
} from "lucide-react";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";
import type {
  BrandOption,
  CategoryTreeNode,
  DynamicAttributeFilterDef,
} from "@/types";
import type { AttributeFilterParam } from "@/lib/catalogue-service";

interface DynamicFilterSidebarProps {
  categories: CategoryTreeNode[];
  brands: BrandOption[];
  availableFilters: DynamicAttributeFilterDef[];
  priceRange?: { min: number; max: number };
  sellingPriceRange?: { min: number; max: number };
  priceCodeRange?: { min: number; max: number };

  // Current Filter Values
  selectedCategoryId: string;
  selectedBrandIds: string[];
  minPrice?: number;
  maxPrice?: number;
  minSellingPrice?: number;
  maxSellingPrice?: number;
  minPriceCode?: number;
  maxPriceCode?: number;
  inStockOnly: boolean;
  attributeFilters: AttributeFilterParam[];

  // Change Handlers
  onCategoryChange: (catId: string) => void;
  onBrandToggle: (brandId: string) => void;
  onPriceChange?: (min?: number, max?: number) => void;
  onSellingPriceChange: (min?: number, max?: number) => void;
  onPriceCodeChange: (min?: number, max?: number) => void;
  onInStockToggle: (val: boolean) => void;
  onAttributeFilterChange: (attributeSlug: string, values: string[]) => void;
  onClearAll: () => void;
  onCloseMobile?: () => void;
}

export function DynamicFilterSidebar({
  categories,
  brands,
  availableFilters,
  priceRange,
  sellingPriceRange,
  priceCodeRange,
  selectedCategoryId,
  selectedBrandIds,
  minPrice,
  maxPrice,
  minSellingPrice,
  maxSellingPrice,
  minPriceCode,
  maxPriceCode,
  inStockOnly,
  attributeFilters,
  onCategoryChange,
  onBrandToggle,
  onPriceChange,
  onSellingPriceChange,
  onPriceCodeChange,
  onInStockToggle,
  onAttributeFilterChange,
  onClearAll,
  onCloseMobile,
}: DynamicFilterSidebarProps) {
  const effMinSelling = minSellingPrice !== undefined ? minSellingPrice : minPrice;
  const effMaxSelling = maxSellingPrice !== undefined ? maxSellingPrice : maxPrice;
  const isSellingPriceActive = effMinSelling !== undefined || effMaxSelling !== undefined;
  const isPriceCodeActive = minPriceCode !== undefined || maxPriceCode !== undefined;

  const effSellingBounds = sellingPriceRange || priceRange || { min: 0, max: 100000 };
  const effPriceCodeBounds = priceCodeRange || { min: 0, max: 10000 };

  // Local state for Selling Price inputs
  const [localMinSelling, setLocalMinSelling] = React.useState<string>(
    effMinSelling !== undefined ? String(effMinSelling) : ""
  );
  const [localMaxSelling, setLocalMaxSelling] = React.useState<string>(
    effMaxSelling !== undefined ? String(effMaxSelling) : ""
  );

  // Local state for Price Code inputs
  const [localMinCode, setLocalMinCode] = React.useState<string>(
    minPriceCode !== undefined ? String(minPriceCode) : ""
  );
  const [localMaxCode, setLocalMaxCode] = React.useState<string>(
    maxPriceCode !== undefined ? String(maxPriceCode) : ""
  );

  // Synchronize local states when props change externally (initial URL, Clear All, or mutual clearing)
  React.useEffect(() => {
    setLocalMinSelling(effMinSelling !== undefined ? String(effMinSelling) : "");
    setLocalMaxSelling(effMaxSelling !== undefined ? String(effMaxSelling) : "");
  }, [effMinSelling, effMaxSelling]);

  React.useEffect(() => {
    setLocalMinCode(minPriceCode !== undefined ? String(minPriceCode) : "");
    setLocalMaxCode(maxPriceCode !== undefined ? String(maxPriceCode) : "");
  }, [minPriceCode, maxPriceCode]);

  // Validation calculations
  const sellingMinNum = localMinSelling.trim() !== "" ? Number(localMinSelling) : undefined;
  const sellingMaxNum = localMaxSelling.trim() !== "" ? Number(localMaxSelling) : undefined;
  const isSellingNegative =
    (sellingMinNum !== undefined && sellingMinNum < 0) ||
    (sellingMaxNum !== undefined && sellingMaxNum < 0);
  const isSellingInverted =
    sellingMinNum !== undefined && sellingMaxNum !== undefined && sellingMinNum > sellingMaxNum;
  const isSellingInvalid =
    isSellingNegative ||
    isSellingInverted ||
    (sellingMinNum !== undefined && isNaN(sellingMinNum)) ||
    (sellingMaxNum !== undefined && isNaN(sellingMaxNum));
  const sellingValidationError = isSellingInverted
    ? "Min price cannot exceed Max"
    : isSellingNegative
    ? "Price cannot be negative"
    : null;

  const codeMinNum = localMinCode.trim() !== "" ? Number(localMinCode) : undefined;
  const codeMaxNum = localMaxCode.trim() !== "" ? Number(localMaxCode) : undefined;
  const isCodeNegative =
    (codeMinNum !== undefined && codeMinNum < 0) ||
    (codeMaxNum !== undefined && codeMaxNum < 0);
  const isCodeInverted =
    codeMinNum !== undefined && codeMaxNum !== undefined && codeMinNum > codeMaxNum;
  const isCodeInvalid =
    isCodeNegative ||
    isCodeInverted ||
    (codeMinNum !== undefined && isNaN(codeMinNum)) ||
    (codeMaxNum !== undefined && isNaN(codeMaxNum));
  const codeValidationError = isCodeInverted
    ? "Min code cannot exceed Max"
    : isCodeNegative
    ? "Code cannot be negative"
    : null;

  // Input change handlers: ONLY update local React state. Absolutely NO API request until Apply is clicked!
  const handleSellingMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMinSelling(e.target.value);
    // When editing Selling Price, clear local Price Code inputs without sending an API request
    if (localMinCode !== "" || localMaxCode !== "") {
      setLocalMinCode("");
      setLocalMaxCode("");
    }
  };

  const handleSellingMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMaxSelling(e.target.value);
    // When editing Selling Price, clear local Price Code inputs without sending an API request
    if (localMinCode !== "" || localMaxCode !== "") {
      setLocalMinCode("");
      setLocalMaxCode("");
    }
  };

  const handleCodeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMinCode(e.target.value);
    // When editing Price Code, clear local Selling Price inputs without sending an API request
    if (localMinSelling !== "" || localMaxSelling !== "") {
      setLocalMinSelling("");
      setLocalMaxSelling("");
    }
  };

  const handleCodeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMaxCode(e.target.value);
    // When editing Price Code, clear local Selling Price inputs without sending an API request
    if (localMinSelling !== "" || localMaxSelling !== "") {
      setLocalMinSelling("");
      setLocalMaxSelling("");
    }
  };

  // Apply handlers: Validate and apply the completed range, triggering exactly one products request
  const handleApplySelling = () => {
    if (isSellingInvalid) return;

    const minVal = localMinSelling.trim() !== "" ? Number(localMinSelling) : undefined;
    const maxVal = localMaxSelling.trim() !== "" ? Number(localMaxSelling) : undefined;

    // Avoid duplicate request if values are identical to current applied values
    if (minVal === effMinSelling && maxVal === effMaxSelling && !isPriceCodeActive) return;

    onSellingPriceChange(minVal, maxVal);
  };

  const handleApplyPriceCode = () => {
    if (isCodeInvalid) return;

    const minVal = localMinCode.trim() !== "" ? Number(localMinCode) : undefined;
    const maxVal = localMaxCode.trim() !== "" ? Number(localMaxCode) : undefined;

    // Avoid duplicate request if values are identical to current applied values
    if (minVal === minPriceCode && maxVal === maxPriceCode && !isSellingPriceActive) return;

    onPriceCodeChange(minVal, maxVal);
  };

  // Explicit clear handlers: Reset the filter and fetch updated results once
  const handleClearSelling = () => {
    setLocalMinSelling("");
    setLocalMaxSelling("");
    onSellingPriceChange(undefined, undefined);
  };

  const handleClearPriceCode = () => {
    setLocalMinCode("");
    setLocalMaxCode("");
    onPriceCodeChange(undefined, undefined);
  };

  const hasActiveFilters =
    Boolean(selectedCategoryId) ||
    selectedBrandIds.length > 0 ||
    isSellingPriceActive ||
    isPriceCodeActive ||
    !inStockOnly ||
    attributeFilters.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-6 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Filters</h3>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 1. Category Hierarchy Filter */}
      <div className="space-y-2.5">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Category</span>
        </label>
        <CascadingCategorySelect
          value={selectedCategoryId}
          onChange={(newCatId) => onCategoryChange(newCatId || "")}
          categories={categories}
          allowRootSelection={true}
          rootLabel="All Categories"
          isFilterMode={true}
          size="sm"
          layout="vertical"
          idPrefix="catalogue-filter-cat"
        />
      </div>

      {/* 2. Availability Filter */}
      <div className="space-y-2.5 pt-4 border-t border-slate-100">
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>In Stock Only</span>
          </span>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockToggle(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
        </label>
      </div>

      {/* 3. Brands Filter */}
      {brands.length > 0 && (
        <div className="space-y-2.5 pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
            <span>Brands</span>
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {brands.map((b) => {
              const isChecked = selectedBrandIds.includes(b.id);
              return (
                <label
                  key={b.id}
                  className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 transition"
                >
                  <span className="font-medium truncate">{b.name}</span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onBrandToggle(b.id)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Mutually Exclusive Price Filters */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Price Filters
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Mutually exclusive</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Activating one price filter automatically clears the other.
          </p>
        </div>

        {/* 4A. Selling Price Range */}
        <div
          className={`p-3 rounded-xl border transition ${
            isSellingPriceActive
              ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/20"
              : "bg-slate-50/60 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-blue-600" />
              <span>Selling Price Range</span>
            </label>
            <div className="flex items-center gap-1.5">
              {isSellingPriceActive && (
                <>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-blue-100 text-blue-700">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelling}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline font-medium"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Min (₹)</span>
              <input
                id="filter-selling-price-min"
                type="number"
                value={localMinSelling}
                onChange={handleSellingMinChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleApplySelling();
                  }
                }}
                placeholder={`₹${effSellingBounds.min}`}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${
                  isSellingInverted || (sellingMinNum !== undefined && sellingMinNum < 0)
                    ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                    : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                }`}
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Max (₹)</span>
              <input
                id="filter-selling-price-max"
                type="number"
                value={localMaxSelling}
                onChange={handleSellingMaxChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleApplySelling();
                  }
                }}
                placeholder={`₹${effSellingBounds.max}`}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${
                  isSellingInverted || (sellingMaxNum !== undefined && sellingMaxNum < 0)
                    ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                    : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                }`}
              />
            </div>
          </div>

          {sellingValidationError && (
            <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{sellingValidationError}</span>
            </p>
          )}

          <button
            type="button"
            onClick={handleApplySelling}
            disabled={isSellingInvalid}
            className={`w-full mt-2.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs ${
              isSellingInvalid
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            }`}
          >
            <span>Apply Selling Price</span>
          </button>
        </div>

        {/* 4B. Price Code Range */}
        <div
          className={`p-3 rounded-xl border transition ${
            isPriceCodeActive
              ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/20"
              : "bg-slate-50/60 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              <span>Price Code Range</span>
            </label>
            <div className="flex items-center gap-1.5">
              {isPriceCodeActive && (
                <>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-blue-100 text-blue-700">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={handleClearPriceCode}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline font-medium"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Min Code</span>
              <input
                id="filter-price-code-min"
                type="number"
                value={localMinCode}
                onChange={handleCodeMinChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleApplyPriceCode();
                  }
                }}
                placeholder={effPriceCodeBounds.min ? String(effPriceCodeBounds.min) : "Min"}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${
                  isCodeInverted || (codeMinNum !== undefined && codeMinNum < 0)
                    ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                    : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                }`}
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Max Code</span>
              <input
                id="filter-price-code-max"
                type="number"
                value={localMaxCode}
                onChange={handleCodeMaxChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleApplyPriceCode();
                  }
                }}
                placeholder={effPriceCodeBounds.max ? String(effPriceCodeBounds.max) : "Max"}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${
                  isCodeInverted || (codeMaxNum !== undefined && codeMaxNum < 0)
                    ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                    : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                }`}
              />
            </div>
          </div>

          {codeValidationError && (
            <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{codeValidationError}</span>
            </p>
          )}

          <button
            type="button"
            onClick={handleApplyPriceCode}
            disabled={isCodeInvalid}
            className={`w-full mt-2.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs ${
              isCodeInvalid
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            }`}
          >
            <span>Apply Price Code</span>
          </button>
        </div>
      </div>

      {/* 5. Dynamic Category Attribute Filters (Only shown for a selected category) */}
      {Boolean(selectedCategoryId && selectedCategoryId !== "all" && availableFilters.length > 0) && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Specifications</span>
          </div>

          {availableFilters.map((filter) => {
            const currentFilter = attributeFilters.find(
              (af) => af.slug === filter.slug || af.attributeId === filter.id
            );
            const selectedValues = currentFilter?.values || [];

            return (
              <div key={filter.id} className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>{filter.name}</span>
                  {filter.unit && (
                    <span className="text-[10px] text-slate-400 font-normal">({filter.unit})</span>
                  )}
                </div>

                {/* Predefined Options or Checkboxes */}
                {filter.options.length > 0 ? (
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {filter.options.map((opt) => {
                      const isChecked = selectedValues.includes(opt.value);
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 cursor-pointer p-1 rounded-md hover:bg-slate-50 transition"
                        >
                          <span className="font-normal truncate">{opt.label || opt.value}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const newVals = isChecked
                                ? selectedValues.filter((v) => v !== opt.value)
                                : [...selectedValues, opt.value];
                              onAttributeFilterChange(filter.slug, newVals);
                            }}
                            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  /* Generic text or boolean if no predefined options */
                  <div className="text-[11px] text-slate-400 italic">
                    Filter by {filter.name.toLowerCase()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
