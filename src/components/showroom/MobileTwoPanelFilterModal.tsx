"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Filter,
  X,
  Search,
  Layers,
  PackageCheck,
  Tag,
  IndianRupee,
  Hash,
  SlidersHorizontal,
  RotateCcw,
  Check,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  CheckSquare,
  Square,
} from "lucide-react";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";
import type {
  BrandOption,
  CategoryTreeNode,
  DynamicAttributeFilterDef,
} from "@/types";
import type { AttributeFilterParam } from "@/lib/catalogue-service";

type FilterSectionId =
  | "category"
  | "availability"
  | "brands"
  | "sellingPrice"
  | "priceCode"
  | "specifications";

interface MobileTwoPanelFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryTreeNode[];
  brands: BrandOption[];
  availableFilters: DynamicAttributeFilterDef[];
  sellingPriceBounds?: { min: number; max: number };
  priceCodeBounds?: { min: number; max: number };

  // Current applied filters from main page
  appliedCategoryId: string;
  appliedBrandIds: string[];
  appliedInStockOnly: boolean;
  appliedMinSellingPrice?: number;
  appliedMaxSellingPrice?: number;
  appliedMinPriceCode?: number;
  appliedMaxPriceCode?: number;
  appliedAttributeFilters: AttributeFilterParam[];

  // Global search from top bar
  catalogSearch?: string;
  initialProductCount: number;

  // Single commit apply handler
  onApplyFilters: (filters: {
    categoryId: string;
    brandIds: string[];
    inStockOnly: boolean;
    minSellingPrice?: number;
    maxSellingPrice?: number;
    minPriceCode?: number;
    maxPriceCode?: number;
    attributeFilters: AttributeFilterParam[];
  }) => void;
}

export function MobileTwoPanelFilterModal({
  isOpen,
  onClose,
  categories,
  brands,
  availableFilters: initialAvailableFilters,
  sellingPriceBounds = { min: 0, max: 100000 },
  priceCodeBounds = { min: 0, max: 10000 },
  appliedCategoryId,
  appliedBrandIds,
  appliedInStockOnly,
  appliedMinSellingPrice,
  appliedMaxSellingPrice,
  appliedMinPriceCode,
  appliedMaxPriceCode,
  appliedAttributeFilters,
  catalogSearch = "",
  initialProductCount,
  onApplyFilters,
}: MobileTwoPanelFilterModalProps) {
  // Active Section (Category is first section)
  const [activeSection, setActiveSection] = useState<FilterSectionId>("category");

  // Track if user explicitly cleared the category filter
  const [isCategoryCleared, setIsCategoryCleared] = useState<boolean>(false);

  // Temporary UI prefill for Category filter section in development/testing
  // Identify Kitchen Appliance parent category dynamically from loaded category hierarchy
  const defaultKitchenApplianceId = useMemo(() => {
    function findKitchenAppliance(nodes: CategoryTreeNode[]): string | null {
      for (const node of nodes) {
        const slug = (node.slug || "").toLowerCase();
        const name = (node.name || "").toLowerCase();
        if (
          slug === "kitchen-appliances" ||
          slug === "kitchen-appliance" ||
          name === "kitchen appliances" ||
          name === "kitchen appliance"
        ) {
          return node.id;
        }
        if (node.children && node.children.length > 0) {
          const found = findKitchenAppliance(node.children);
          if (found) return found;
        }
      }
      return null;
    }
    return findKitchenAppliance(categories);
  }, [categories]);

  // In-modal search query
  const [filterSearch, setFilterSearch] = useState<string>("");

  // In-modal brand search query inside the Brands tab
  const [brandSearch, setBrandSearch] = useState<string>("");

  // DRAFT Filter States
  const [draftCategoryId, setDraftCategoryId] = useState<string>(appliedCategoryId);
  const [draftBrandIds, setDraftBrandIds] = useState<string[]>(appliedBrandIds);
  const [draftInStockOnly, setDraftInStockOnly] = useState<boolean>(appliedInStockOnly);
  const [draftMinSellingPrice, setDraftMinSellingPrice] = useState<number | undefined>(appliedMinSellingPrice);
  const [draftMaxSellingPrice, setDraftMaxSellingPrice] = useState<number | undefined>(appliedMaxSellingPrice);
  const [draftMinPriceCode, setDraftMinPriceCode] = useState<number | undefined>(appliedMinPriceCode);
  const [draftMaxPriceCode, setDraftMaxPriceCode] = useState<number | undefined>(appliedMaxPriceCode);
  const [draftAttributeFilters, setDraftAttributeFilters] = useState<AttributeFilterParam[]>(appliedAttributeFilters);

  // Inside Category section only: prefill Kitchen Appliance as parent category if none is active
  const effectiveCategoryValue =
    draftCategoryId || (!isCategoryCleared && defaultKitchenApplianceId ? defaultKitchenApplianceId : "");

  // Local string inputs for typing price ranges without immediate validation lock
  const [localMinSelling, setLocalMinSelling] = useState<string>(
    appliedMinSellingPrice !== undefined ? String(appliedMinSellingPrice) : ""
  );
  const [localMaxSelling, setLocalMaxSelling] = useState<string>(
    appliedMaxSellingPrice !== undefined ? String(appliedMaxSellingPrice) : ""
  );
  const [localMinCode, setLocalMinCode] = useState<string>(
    appliedMinPriceCode !== undefined ? String(appliedMinPriceCode) : ""
  );
  const [localMaxCode, setLocalMaxCode] = useState<string>(
    appliedMaxPriceCode !== undefined ? String(appliedMaxPriceCode) : ""
  );

  // Dynamic attribute filters for currently selected draft category
  const [dynamicFilters, setDynamicFilters] = useState<DynamicAttributeFilterDef[]>(initialAvailableFilters);
  const [loadingDynamicFilters, setLoadingDynamicFilters] = useState<boolean>(false);

  // Product Count Live State
  const [productCount, setProductCount] = useState<number>(initialProductCount);
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const countAbortControllerRef = useRef<AbortController | null>(null);
  const countRequestIdRef = useRef<number>(0);

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Synchronize draft state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setDraftCategoryId(appliedCategoryId);
      setDraftBrandIds(appliedBrandIds);
      setDraftInStockOnly(appliedInStockOnly);
      setDraftMinSellingPrice(appliedMinSellingPrice);
      setDraftMaxSellingPrice(appliedMaxSellingPrice);
      setDraftMinPriceCode(appliedMinPriceCode);
      setDraftMaxPriceCode(appliedMaxPriceCode);
      setDraftAttributeFilters(appliedAttributeFilters);
      setLocalMinSelling(appliedMinSellingPrice !== undefined ? String(appliedMinSellingPrice) : "");
      setLocalMaxSelling(appliedMaxSellingPrice !== undefined ? String(appliedMaxSellingPrice) : "");
      setLocalMinCode(appliedMinPriceCode !== undefined ? String(appliedMinPriceCode) : "");
      setLocalMaxCode(appliedMaxPriceCode !== undefined ? String(appliedMaxPriceCode) : "");
      setDynamicFilters(initialAvailableFilters);
      setProductCount(initialProductCount);
      setFilterSearch("");
      setBrandSearch("");
      setIsCategoryCleared(false);
      setActiveSection("category");
    }
  }, [
    isOpen,
    appliedCategoryId,
    appliedBrandIds,
    appliedInStockOnly,
    appliedMinSellingPrice,
    appliedMaxSellingPrice,
    appliedMinPriceCode,
    appliedMaxPriceCode,
    appliedAttributeFilters,
    initialAvailableFilters,
    initialProductCount,
  ]);

  // Load dynamic category specifications whenever draftCategoryId changes
  useEffect(() => {
    if (!draftCategoryId || draftCategoryId === "all") {
      setDynamicFilters([]);
      return;
    }

    if (draftCategoryId === appliedCategoryId && initialAvailableFilters.length > 0) {
      setDynamicFilters(initialAvailableFilters);
      return;
    }

    let isMounted = true;
    async function loadCategoryFilters() {
      try {
        setLoadingDynamicFilters(true);
        const res = await fetch(`/api/catalogue/filters?categoryId=${encodeURIComponent(draftCategoryId)}`);
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setDynamicFilters(json.data);
        }
      } catch (err) {
        console.error("Failed to load category filters:", err);
      } finally {
        if (isMounted) setLoadingDynamicFilters(false);
      }
    }

    loadCategoryFilters();
    return () => {
      isMounted = false;
    };
  }, [draftCategoryId, appliedCategoryId, initialAvailableFilters]);

  // Validation calculations for Selling Price & Price Code
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

  // Real-time debounced recalculation of the dynamic product count
  useEffect(() => {
    // If selling price or code has validation errors, pause count request
    if (isSellingInvalid || isCodeInvalid) {
      return;
    }

    const timer = setTimeout(async () => {
      if (countAbortControllerRef.current) {
        countAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      countAbortControllerRef.current = controller;
      const reqId = ++countRequestIdRef.current;

      try {
        setIsCounting(true);
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "1");
        if (catalogSearch.trim()) params.set("search", catalogSearch.trim());
        if (draftCategoryId) params.set("categoryId", draftCategoryId);
        if (draftBrandIds.length > 0) params.set("brandIds", draftBrandIds.join(","));
        if (draftMinSellingPrice !== undefined) params.set("minSellingPrice", String(draftMinSellingPrice));
        if (draftMaxSellingPrice !== undefined) params.set("maxSellingPrice", String(draftMaxSellingPrice));
        if (draftMinPriceCode !== undefined) params.set("minPriceCode", String(draftMinPriceCode));
        if (draftMaxPriceCode !== undefined) params.set("maxPriceCode", String(draftMaxPriceCode));
        if (draftInStockOnly) params.set("inStockOnly", "true");
        if (draftAttributeFilters.length > 0) {
          params.set("attributeFilters", JSON.stringify(draftAttributeFilters));
        }

        const res = await fetch(`/api/catalogue/products?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();

        if (reqId === countRequestIdRef.current && json.success && json.data?.pagination) {
          setProductCount(json.data.pagination.totalCount);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Count calculation error:", err);
        }
      } finally {
        if (reqId === countRequestIdRef.current) {
          setIsCounting(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    catalogSearch,
    draftCategoryId,
    draftBrandIds,
    draftInStockOnly,
    draftMinSellingPrice,
    draftMaxSellingPrice,
    draftMinPriceCode,
    draftMaxPriceCode,
    draftAttributeFilters,
    isSellingInvalid,
    isCodeInvalid,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (countAbortControllerRef.current) {
        countAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Handlers for Price inputs with mutual exclusivity
  const handleSellingMinInput = (val: string) => {
    setLocalMinSelling(val);
    setLocalMinCode("");
    setLocalMaxCode("");
    setDraftMinPriceCode(undefined);
    setDraftMaxPriceCode(undefined);
    const num = val.trim() !== "" ? Number(val) : undefined;
    setDraftMinSellingPrice(num);
  };

  const handleSellingMaxInput = (val: string) => {
    setLocalMaxSelling(val);
    setLocalMinCode("");
    setLocalMaxCode("");
    setDraftMinPriceCode(undefined);
    setDraftMaxPriceCode(undefined);
    const num = val.trim() !== "" ? Number(val) : undefined;
    setDraftMaxSellingPrice(num);
  };

  const handleCodeMinInput = (val: string) => {
    setLocalMinCode(val);
    setLocalMinSelling("");
    setLocalMaxSelling("");
    setDraftMinSellingPrice(undefined);
    setDraftMaxSellingPrice(undefined);
    const num = val.trim() !== "" ? Number(val) : undefined;
    setDraftMinPriceCode(num);
  };

  const handleCodeMaxInput = (val: string) => {
    setLocalMaxCode(val);
    setLocalMinSelling("");
    setLocalMaxSelling("");
    setDraftMinSellingPrice(undefined);
    setDraftMaxSellingPrice(undefined);
    const num = val.trim() !== "" ? Number(val) : undefined;
    setDraftMaxPriceCode(num);
  };

  // Category Change Handler
  const handleCategorySelect = (catId: string) => {
    setDraftCategoryId(catId);
    if (!catId) {
      setIsCategoryCleared(true);
    } else {
      setIsCategoryCleared(false);
    }
    setDraftAttributeFilters([]); // Reset dependent specifications
  };

  // Brand Toggle Handlers
  const handleBrandToggle = (brandId: string) => {
    setDraftBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  };

  const handleSelectAllBrands = () => {
    setDraftBrandIds(brands.map((b) => b.id));
  };

  const handleDeselectAllBrands = () => {
    setDraftBrandIds([]);
  };

  // Specification Attribute Filter Handler
  const handleAttributeFilterToggle = (slug: string, value: string) => {
    setDraftAttributeFilters((prev) => {
      const existing = prev.find((af) => af.slug === slug);
      const currentValues: string[] = existing?.values ? existing.values : [];
      const updatedValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      const remaining = prev.filter((af) => af.slug !== slug);
      if (updatedValues.length > 0) {
        return [...remaining, { slug, values: updatedValues }];
      }
      return remaining;
    });
  };

  // Check if any draft filters differ from default
  const hasActiveDraftFilters =
    Boolean(draftCategoryId) ||
    draftBrandIds.length > 0 ||
    !draftInStockOnly ||
    draftMinSellingPrice !== undefined ||
    draftMaxSellingPrice !== undefined ||
    draftMinPriceCode !== undefined ||
    draftMaxPriceCode !== undefined ||
    draftAttributeFilters.length > 0;

  // Reset all draft filters to default state (Header "Clear all" & Footer "Reset")
  const handleResetAll = () => {
    setDraftCategoryId("");
    setIsCategoryCleared(false);
    setDraftBrandIds([]);
    setDraftInStockOnly(true);
    setDraftMinSellingPrice(undefined);
    setDraftMaxSellingPrice(undefined);
    setDraftMinPriceCode(undefined);
    setDraftMaxPriceCode(undefined);
    setDraftAttributeFilters([]);
    setLocalMinSelling("");
    setLocalMaxSelling("");
    setLocalMinCode("");
    setLocalMaxCode("");
  };

  // Commit and Apply draft filters
  const handleApplyAndClose = () => {
    if (isSellingInvalid || isCodeInvalid) return;

    onApplyFilters({
      categoryId: draftCategoryId,
      brandIds: draftBrandIds,
      inStockOnly: draftInStockOnly,
      minSellingPrice: draftMinSellingPrice,
      maxSellingPrice: draftMaxSellingPrice,
      minPriceCode: draftMinPriceCode,
      maxPriceCode: draftMaxPriceCode,
      attributeFilters: draftAttributeFilters,
    });
    onClose();
  };

  // Badges calculation for left panel sections
  const totalSelectedSpecsCount = useMemo(() => {
    return draftAttributeFilters.reduce((acc, f) => acc + (f.values?.length || 0), 0);
  }, [draftAttributeFilters]);

  const isSellingPriceActive = draftMinSellingPrice !== undefined || draftMaxSellingPrice !== undefined;
  const isPriceCodeActive = draftMinPriceCode !== undefined || draftMaxPriceCode !== undefined;

  // Flattened categories for search matching
  const flatCategories = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    function traverse(nodes: CategoryTreeNode[]) {
      for (const node of nodes) {
        list.push({ id: node.id, name: node.name });
        if (node.children?.length) traverse(node.children);
      }
    }
    traverse(categories);
    return list;
  }, [categories]);

  // In-modal search matching calculations (Sections, Brands, Specs, Categories)
  const isSearchActive = filterSearch.trim().length > 0;
  const searchLower = filterSearch.trim().toLowerCase();

  const searchMatchingBrands = useMemo(() => {
    if (!isSearchActive) return [];
    return brands.filter((b) => b.name.toLowerCase().includes(searchLower));
  }, [brands, isSearchActive, searchLower]);

  const searchMatchingSpecs = useMemo(() => {
    if (!isSearchActive) return [];
    return dynamicFilters
      .map((df) => {
        const nameMatches = df.name.toLowerCase().includes(searchLower);
        const matchingOpts = df.options.filter(
          (o) =>
            o.value.toLowerCase().includes(searchLower) ||
            (o.label && o.label.toLowerCase().includes(searchLower))
        );
        if (nameMatches || matchingOpts.length > 0) {
          return {
            ...df,
            options: matchingOpts.length > 0 ? matchingOpts : df.options,
          };
        }
        return null;
      })
      .filter(Boolean) as DynamicAttributeFilterDef[];
  }, [dynamicFilters, isSearchActive, searchLower]);

  const searchMatchingCategories = useMemo(() => {
    if (!isSearchActive) return [];
    return flatCategories.filter((c) => c.name.toLowerCase().includes(searchLower));
  }, [flatCategories, isSearchActive, searchLower]);

  const hasSearchMatches =
    searchMatchingBrands.length > 0 ||
    searchMatchingSpecs.length > 0 ||
    searchMatchingCategories.length > 0 ||
    "selling price".includes(searchLower) ||
    "price code".includes(searchLower) ||
    "in stock".includes(searchLower);

  // Filtered brands for brand tab search
  const visibleBrandsInTab = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    const bLower = brandSearch.trim().toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(bLower));
  }, [brands, brandSearch]);

  if (!isOpen) return null;

  return (
    <>
      {/* Background Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Full-Screen Two-Panel Filter Interface (beneath top mobile header) */}
      <div className="fixed top-16 inset-x-0 bottom-0 z-40 lg:hidden flex flex-col bg-white overflow-hidden shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
        {/* ========================================================================= */}
        {/* 1. FIXED HEADER                                                           */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                Filters
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">
                Refine showroom catalogue
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              disabled={!hasActiveDraftFilters}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${hasActiveDraftFilters
                  ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
                }`}
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Close filter interface"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. SEARCH BAR                                                             */}
        {/* ========================================================================= */}
        <div className="px-3.5 py-2 bg-slate-50/60 border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search filters, brands, specifications..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition shadow-2xs"
            />
            {filterSearch.trim() && (
              <button
                type="button"
                onClick={() => setFilterSearch("")}
                className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2"
                aria-label="Clear filter search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. TWO-PANEL CONTENT AREA                                                 */}
        {/* ========================================================================= */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* ----------------------------------------------------------------------- */}
          {/* LEFT PANEL: Section Navigation (34% width, subtle neutral background)   */}
          {/* ----------------------------------------------------------------------- */}
          <div className="w-[34%] max-w-[130px] sm:max-w-[155px] shrink-0 border-r border-slate-200 bg-slate-50/90 overflow-y-auto divide-y divide-slate-100">
            {/* 1. Category */}
            <button
              type="button"
              onClick={() => {
                setActiveSection("category");
                setFilterSearch("");
              }}
              className={`w-full text-left px-2.5 sm:px-3 py-3 transition flex items-center justify-between gap-1.5 relative ${activeSection === "category" && !isSearchActive
                  ? "bg-white text-blue-700 font-bold border-l-3 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="text-xs truncate">Category</span>
              </div>
              {draftCategoryId && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
              )}
            </button>

            {/* 2. Availability */}
            <button
              type="button"
              onClick={() => {
                setActiveSection("availability");
                setFilterSearch("");
              }}
              className={`w-full text-left px-2.5 sm:px-3 py-3 transition flex items-center justify-between gap-1.5 relative ${activeSection === "availability" && !isSearchActive
                  ? "bg-white text-blue-700 font-bold border-l-3 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <PackageCheck className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="text-xs truncate">Availability</span>
              </div>
              {draftInStockOnly && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
              )}
            </button>

            {/* 3. Brands */}
            <button
              type="button"
              onClick={() => {
                setActiveSection("brands");
                setFilterSearch("");
              }}
              className={`w-full text-left px-2.5 sm:px-3 py-3 transition flex items-center justify-between gap-1.5 relative ${activeSection === "brands" && !isSearchActive
                  ? "bg-white text-blue-700 font-bold border-l-3 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="text-xs truncate">Brands</span>
              </div>
              {draftBrandIds.length > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {draftBrandIds.length}
                </span>
              )}
            </button>

            {/* 4. Selling Price */}
            <button
              type="button"
              onClick={() => {
                setActiveSection("sellingPrice");
                setFilterSearch("");
              }}
              className={`w-full text-left px-2.5 sm:px-3 py-3 transition flex items-center justify-between gap-1.5 relative ${activeSection === "sellingPrice" && !isSearchActive
                  ? "bg-white text-blue-700 font-bold border-l-3 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <IndianRupee className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="text-xs truncate">Selling Price</span>
              </div>
              {isSellingPriceActive && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
              )}
            </button>

            {/* 5. Price Code */}
            <button
              type="button"
              onClick={() => {
                setActiveSection("priceCode");
                setFilterSearch("");
              }}
              className={`w-full text-left px-2.5 sm:px-3 py-3 transition flex items-center justify-between gap-1.5 relative ${activeSection === "priceCode" && !isSearchActive
                  ? "bg-white text-blue-700 font-bold border-l-3 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Hash className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="text-xs truncate">Price Code</span>
              </div>
              {isPriceCodeActive && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
              )}
            </button>

            {/* 6. Specifications */}
            <button
              type="button"
              onClick={() => {
                setActiveSection("specifications");
                setFilterSearch("");
              }}
              className={`w-full text-left px-2.5 sm:px-3 py-3 transition flex items-center justify-between gap-1.5 relative ${activeSection === "specifications" && !isSearchActive
                  ? "bg-white text-blue-700 font-bold border-l-3 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="text-xs truncate">Specifications</span>
              </div>
              {totalSelectedSpecsCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {totalSelectedSpecsCount}
                </span>
              )}
            </button>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* RIGHT PANEL: Active Section Content (Scrollable, remaining width)       */}
          {/* ----------------------------------------------------------------------- */}
          <div className="flex-1 min-w-0 bg-white overflow-y-auto p-3.5 sm:p-4 pb-28">
            {/* SEARCH RESULTS VIEW (When query is entered) */}
            {isSearchActive ? (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900">
                    Search Results for &ldquo;{filterSearch}&rdquo;
                  </span>
                </div>

                {!hasSearchMatches ? (
                  <div className="py-10 text-center space-y-2">
                    <Search className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="text-xs font-bold text-slate-700">No matching filters</div>
                    <p className="text-[11px] text-slate-400">
                      Try searching for a different brand, specification or category.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilterSearch("")}
                      className="text-xs font-semibold text-blue-600 underline mt-2"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Matching Brands */}
                    {searchMatchingBrands.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Brands ({searchMatchingBrands.length})
                        </span>
                        <div className="space-y-1">
                          {searchMatchingBrands.map((b) => {
                            const isChecked = draftBrandIds.includes(b.id);
                            return (
                              <label
                                key={b.id}
                                className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer"
                              >
                                <span className="text-xs font-medium text-slate-800">{b.name}</span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleBrandToggle(b.id)}
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matching Specifications */}
                    {searchMatchingSpecs.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Specifications ({searchMatchingSpecs.length})
                        </span>
                        {searchMatchingSpecs.map((filter) => {
                          const currentFilter = draftAttributeFilters.find((af) => af.slug === filter.slug);
                          const selectedValues = currentFilter?.values || [];

                          return (
                            <div key={filter.id} className="space-y-1.5">
                              <div className="text-xs font-semibold text-slate-700">
                                {filter.name} {filter.unit ? `(${filter.unit})` : ""}
                              </div>
                              <div className="space-y-1">
                                {filter.options.map((opt) => {
                                  const isChecked = selectedValues.includes(opt.value);
                                  return (
                                    <label
                                      key={opt.id}
                                      className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs"
                                    >
                                      <span className="text-slate-800">{opt.label || opt.value}</span>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleAttributeFilterToggle(filter.slug, opt.value)}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Matching Categories */}
                    {searchMatchingCategories.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Categories ({searchMatchingCategories.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {searchMatchingCategories.map((c) => {
                            const isSelected = draftCategoryId === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleCategorySelect(c.id)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${isSelected
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  }`}
                              >
                                {c.name}
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* REGULAR SECTION CONTENT (When search is inactive) */
              <>


                {/* 1. CATEGORY SECTION */}
                {activeSection === "category" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Select Category
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Select a category or subcategory to filter appliances
                      </p>
                    </div>

                    <CascadingCategorySelect
                      value={effectiveCategoryValue}
                      onChange={(newCatId) => handleCategorySelect(newCatId || "")}
                      categories={categories}
                      allowRootSelection={true}
                      rootLabel="All Categories"
                      isFilterMode={true}
                      size="sm"
                      layout="vertical"
                      idPrefix="mobile-two-panel-cat"
                    />

                    {(draftCategoryId || (!isCategoryCleared && defaultKitchenApplianceId)) && (
                      <button
                        type="button"
                        onClick={() => {
                          handleCategorySelect("");
                          setIsCategoryCleared(true);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 pt-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Category Filter</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 2. AVAILABILITY SECTION */}
                {activeSection === "availability" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Availability
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Filter by showroom inventory status
                      </p>
                    </div>

                    <label className="flex items-start justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/30 hover:border-blue-200 transition cursor-pointer">
                      <div className="pr-3">
                        <span className="text-xs font-bold text-slate-900 block">
                          In stock only
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                          Only display products with confirmed stock on-hand for customer view or delivery.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={draftInStockOnly}
                        onChange={(e) => setDraftInStockOnly(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                      />
                    </label>
                  </div>
                )}

                {/* 3. BRANDS SECTION */}
                {activeSection === "brands" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Brands
                        </h3>
                        <span className="text-[11px] text-slate-400">
                          {draftBrandIds.length} of {brands.length} selected
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {draftBrandIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDeselectAllBrands}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSelectAllBrands}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Select all
                        </button>
                      </div>
                    </div>

                    {/* Local Brand Search */}
                    {brands.length > 6 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={brandSearch}
                          onChange={(e) => setBrandSearch(e.target.value)}
                          placeholder="Search brands..."
                          className="w-full pl-8 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {brandSearch && (
                          <button
                            type="button"
                            onClick={() => setBrandSearch("")}
                            className="p-1 text-slate-400 hover:text-slate-600 absolute right-1.5 top-1/2 -translate-y-1/2"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      {visibleBrandsInTab.map((b) => {
                        const isChecked = draftBrandIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition text-xs"
                          >
                            <span className="font-medium text-slate-800">{b.name}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleBrandToggle(b.id)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. SELLING PRICE SECTION */}
                {activeSection === "sellingPrice" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Selling Price Range
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Available bounds: ₹{sellingPriceBounds.min.toLocaleString("en-IN")} – ₹
                        {sellingPriceBounds.max.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-2xl text-[11px] text-blue-800">
                      <strong>Note:</strong> Setting a Selling Price range clears any Price Code filter.
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Min Price (₹)
                        </label>
                        <input
                          type="number"
                          value={localMinSelling}
                          onChange={(e) => handleSellingMinInput(e.target.value)}
                          placeholder={`₹${sellingPriceBounds.min}`}
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${isSellingInverted || (sellingMinNum !== undefined && sellingMinNum < 0)
                              ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                              : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                            }`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Max Price (₹)
                        </label>
                        <input
                          type="number"
                          value={localMaxSelling}
                          onChange={(e) => handleSellingMaxInput(e.target.value)}
                          placeholder={`₹${sellingPriceBounds.max}`}
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${isSellingInverted || (sellingMaxNum !== undefined && sellingMaxNum < 0)
                              ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                              : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                            }`}
                        />
                      </div>
                    </div>

                    {sellingValidationError && (
                      <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{sellingValidationError}</span>
                      </p>
                    )}

                    {isSellingPriceActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalMinSelling("");
                          setLocalMaxSelling("");
                          setDraftMinSellingPrice(undefined);
                          setDraftMaxSellingPrice(undefined);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Price Range</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 5. PRICE CODE SECTION */}
                {activeSection === "priceCode" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Price Code Range
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Filter by confidential wholesale price code
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900">
                      <strong>Exclusive:</strong> Activating Price Code clears any Selling Price range.
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Min Code
                        </label>
                        <input
                          type="number"
                          value={localMinCode}
                          onChange={(e) => handleCodeMinInput(e.target.value)}
                          placeholder="Min"
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${isCodeInverted || (codeMinNum !== undefined && codeMinNum < 0)
                              ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                              : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                            }`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Max Code
                        </label>
                        <input
                          type="number"
                          value={localMaxCode}
                          onChange={(e) => handleCodeMaxInput(e.target.value)}
                          placeholder="Max"
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 transition ${isCodeInverted || (codeMaxNum !== undefined && codeMaxNum < 0)
                              ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                              : "border-slate-200 focus:ring-blue-100 focus:border-blue-600"
                            }`}
                        />
                      </div>
                    </div>

                    {codeValidationError && (
                      <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{codeValidationError}</span>
                      </p>
                    )}

                    {isPriceCodeActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalMinCode("");
                          setLocalMaxCode("");
                          setDraftMinPriceCode(undefined);
                          setDraftMaxPriceCode(undefined);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Price Code Range</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 6. SPECIFICATIONS SECTION */}
                {activeSection === "specifications" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Specifications
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dynamic attributes configured for category
                      </p>
                    </div>

                    {!draftCategoryId || draftCategoryId === "all" ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                        <SlidersHorizontal className="w-6 h-6 text-slate-400 mx-auto" />
                        <div className="text-xs font-bold text-slate-800">
                          Select a category to view specifications
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Attributes like size, suction, burners, auto-clean, etc. depend on the selected category.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveSection("category")}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-2xs"
                        >
                          Choose Category
                        </button>
                      </div>
                    ) : loadingDynamicFilters ? (
                      <div className="py-8 text-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="text-xs text-slate-500 font-medium">
                          Loading category specifications...
                        </div>
                      </div>
                    ) : dynamicFilters.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                        No specific filters configured for this category.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {dynamicFilters.map((filter) => {
                          const currentFilter = draftAttributeFilters.find((af) => af.slug === filter.slug);
                          const selectedValues = currentFilter?.values || [];

                          return (
                            <div key={filter.id} className="space-y-1.5 pb-3 border-b border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                  {filter.name} {filter.unit ? `(${filter.unit})` : ""}
                                </span>
                                {selectedValues.length > 0 && (
                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                    {selectedValues.length} selected
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1">
                                {filter.options.map((opt) => {
                                  const isChecked = selectedValues.includes(opt.value);
                                  return (
                                    <label
                                      key={opt.id}
                                      className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition text-xs"
                                    >
                                      <span className="font-normal text-slate-800">
                                        {opt.label || opt.value}
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleAttributeFilterToggle(filter.slug, opt.value)}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. FIXED BOTTOM ACTION BAR                                                */}
        {/* ========================================================================= */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleResetAll}
            className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer shrink-0"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleApplyAndClose}
            disabled={isCounting || isSellingInvalid || isCodeInvalid}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isCounting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Calculating count...</span>
              </>
            ) : (
              <span>
                {productCount === 1 ? "Show 1 product" : `Show ${productCount} products`}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
