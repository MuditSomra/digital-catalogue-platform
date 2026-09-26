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
  PackageCheck,
  Sparkles,
  X,
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
  priceRange: { min: number; max: number };

  // Current Filter Values
  selectedCategoryId: string;
  selectedBrandIds: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly: boolean;
  attributeFilters: AttributeFilterParam[];

  // Change Handlers
  onCategoryChange: (catId: string) => void;
  onBrandToggle: (brandId: string) => void;
  onPriceChange: (min?: number, max?: number) => void;
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
  selectedCategoryId,
  selectedBrandIds,
  minPrice,
  maxPrice,
  inStockOnly,
  attributeFilters,
  onCategoryChange,
  onBrandToggle,
  onPriceChange,
  onInStockToggle,
  onAttributeFilterChange,
  onClearAll,
  onCloseMobile,
}: DynamicFilterSidebarProps) {
  const hasActiveFilters =
    Boolean(selectedCategoryId) ||
    selectedBrandIds.length > 0 ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    inStockOnly ||
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

      {/* 4. Price Range Filter */}
      <div className="space-y-2.5 pt-4 border-t border-slate-100">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-blue-600" />
          <span>Price Range (₹)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 font-medium">Min</span>
            <input
              type="number"
              value={minPrice !== undefined ? minPrice : ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onPriceChange(val, maxPrice);
              }}
              placeholder={`₹${priceRange.min}`}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-medium">Max</span>
            <input
              type="number"
              value={maxPrice !== undefined ? maxPrice : ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onPriceChange(minPrice, val);
              }}
              placeholder={`₹${priceRange.max}`}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
            />
          </div>
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
