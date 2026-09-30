"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  DollarSign,
  Search,
  ArrowUpDown,
  Plus,
  TrendingUp,
  Tag,
  Calendar,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Boxes,
  CheckCircle2,
  Trash2,
  Edit2,
  Percent,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  BadgeAlert,
  ImageIcon,
  Eye,
  X,
  Package,
} from "lucide-react";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";
import { getOptimizedImageUrl, IMAGE_PROFILES } from "@/lib/cloudinary-url";
import type {
  ProductQuotationGroup,
  SupplierQuotationItem,
  CategoryTreeNode,
  FlatCategoryOption,
} from "@/types";

interface PurchasingComparisonViewProps {
  groups: ProductQuotationGroup[];
  loading: boolean;
  categories: CategoryTreeNode[] | FlatCategoryOption[] | any[];
  search: string;
  onSearchChange: (val: string) => void;
  selectedCategoryId: string;
  onCategoryChange: (catId: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  dynamicAttributeFilters: Record<string, string>;
  onAttributeFilterChange: (attrSlug: string, val: string) => void;
  availableAttributes: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    predefinedValues: Array<{ id: string; value: string; label: string }>;
  }>;
  onClearFilters: () => void;
  onAddQuotation: (productId?: string) => void;
  onEditQuotation: (quotation: SupplierQuotationItem) => void;
  onDeleteQuotation: (quotation: SupplierQuotationItem) => void;
  onAddProductWithQuote: () => void;
}

export function PurchasingComparisonView({
  groups,
  loading,
  categories,
  search,
  onSearchChange,
  selectedCategoryId,
  onCategoryChange,
  sortBy,
  onSortByChange,
  dynamicAttributeFilters,
  onAttributeFilterChange,
  availableAttributes,
  onClearFilters,
  onAddQuotation,
  onEditQuotation,
  onDeleteQuotation,
  onAddProductWithQuote,
}: PurchasingComparisonViewProps) {
  // Collapsed / Expanded state for product quotation groups (default all expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Image Gallery Lightbox Modal State
  const [galleryProduct, setGalleryProduct] = useState<ProductQuotationGroup["product"] | null>(null);
  const [galleryActiveIndex, setGalleryActiveIndex] = useState(0);

  const toggleGroupCollapse = (productId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleOpenGallery = (product: ProductQuotationGroup["product"], initialIndex = 0) => {
    setGalleryProduct(product);
    setGalleryActiveIndex(initialIndex);
  };

  const handleCloseGallery = () => {
    setGalleryProduct(null);
    setGalleryActiveIndex(0);
  };

  // Quick statistics calculated across all loaded quotation groups
  const stats = useMemo(() => {
    if (!groups || !Array.isArray(groups)) {
      return { totalProducts: 0, totalQuotes: 0, supplierCount: 0, avgSavings: 0 };
    }
    const totalProducts = groups.length;
    const allQuotes = groups.flatMap((g) => g?.quotations || []);
    const totalQuotes = allQuotes.length;

    const uniqueSuppliers = new Set(
      allQuotes
        .filter((q) => q && q.supplierName)
        .map((q) => q.supplierName.toLowerCase().trim())
    );
    const supplierCount = uniqueSuppliers.size;

    // Calculate best overall margin potential
    let totalPotentialSavings = 0;
    let productsWithQuotes = 0;

    for (const group of groups) {
      if (!group || !group.product) continue;
      const retailPrice = group.product.sellingPrice || group.product.mrp;
      if (group.lowestQuotedPrice !== null && group.lowestQuotedPrice !== undefined && retailPrice) {
        const diff = retailPrice - group.lowestQuotedPrice;
        if (diff > 0) {
          totalPotentialSavings += diff;
          productsWithQuotes++;
        }
      }
    }

    return {
      totalProducts,
      totalQuotes,
      supplierCount,
      avgSavings: productsWithQuotes > 0 ? Math.round(totalPotentialSavings / productsWithQuotes) : 0,
    };
  }, [groups]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(selectedCategoryId) ||
    (dynamicAttributeFilters &&
      typeof dynamicAttributeFilters === "object" &&
      Object.keys(dynamicAttributeFilters).some((k) => Boolean(dynamicAttributeFilters[k])));

  return (
    <div className="space-y-6">
      {/* QUICK METRICS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products with Quotations */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Tracked Products</span>
            <Tag className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {stats.totalProducts}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            With supplier purchase quotes
          </p>
        </div>

        {/* Active Suppliers */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Suppliers</span>
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300 mt-2">
            {stats.supplierCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Registered wholesale vendors
          </p>
        </div>

        {/* Total Price Quotes */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Recorded Quotes</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {stats.totalQuotes}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Competing purchase prices
          </p>
        </div>

        {/* Average Unit Margin */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Avg Unit Margin</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2">
            ₹{stats.avgSavings.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Best quote vs retail price
          </p>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROL BAR */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by product name, SKU, model, brand, or supplier..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            />
          </div>

          {/* Reused Cascading Category Selector */}
          <div className="w-full lg:w-auto lg:min-w-[280px]">
            <CascadingCategorySelect
              value={selectedCategoryId}
              onChange={(newCatId) => onCategoryChange(newCatId || "")}
              categories={categories}
              allowRootSelection={true}
              rootLabel="All Categories"
              isFilterMode={true}
              size="sm"
              layout="responsive"
              idPrefix="purchasing-filter-cat"
            />
          </div>

          {/* Sort Filter */}
          <div className="w-full lg:w-56 shrink-0">
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              >
                <option value="lowest_price">Lowest Quoted Price</option>
                <option value="highest_margin">Highest Gross Margin</option>
                <option value="newest">Newest Quotation Date</option>
                <option value="supplier">Supplier Name (A–Z)</option>
                <option value="product_name">Product Name (A–Z)</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="px-3 py-2 text-xs font-semibold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-xl transition cursor-pointer shrink-0"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Dynamic Attribute Filters (if category selected and specifications available) */}
        {availableAttributes.length > 0 && (
          <div className="pt-3 border-t border-border/80 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Category Filters:</span>
            </div>
            {availableAttributes.map((attr) => (
              <div key={attr.id} className="min-w-36">
                <select
                  value={dynamicAttributeFilters[attr.slug] || ""}
                  onChange={(e) => onAttributeFilterChange(attr.slug, e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{attr.name} (All)</option>
                  {attr.predefinedValues.map((v) => (
                    <option key={v.id} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPARISON CONTENT / PRODUCT GROUPS */}
      {loading ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Loading quotation comparisons...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="p-12 bg-card border border-border rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">No Supplier Quotations Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? "No products or quotations matched your selected search and category filters. Try clearing your filters."
                : "No supplier purchase quotes have been recorded yet. Start by adding a quotation for an existing product or registering a new product."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
              >
                Clear All Filters
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onAddQuotation()}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Quotation</span>
                </button>
                <button
                  type="button"
                  onClick={onAddProductWithQuote}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition flex items-center gap-2 cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4 text-primary" />
                  <span>Create Product with Quote</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.product.id]);
            const quoteCount = group.quotations.length;
            const imagesList = group.product.images || [];
            const primaryImg = group.product.primaryImage;
            const specsList = group.product.attributeValues || [];

            return (
              <div
                key={group.product.id}
                className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs hover:border-border/80 transition"
              >
                {/* PRODUCT HEADER BAR */}
                <div className="p-4 sm:p-5 border-b border-border/80 bg-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Product Image, Details & Dynamic Specifications */}
                  <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
                    {/* Product Image Thumbnail & Gallery Trigger */}
                    <div
                      onClick={() => handleOpenGallery(group.product, 0)}
                      className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl bg-background border border-border overflow-hidden relative cursor-pointer group/thumb hover:border-primary/50 transition select-none flex items-center justify-center"
                      title={imagesList.length > 1 ? `Click to view all ${imagesList.length} photos` : "Click to view photo preview"}
                    >
                      {primaryImg?.url ? (
                        <img
                          src={getOptimizedImageUrl(primaryImg.url, IMAGE_PROFILES.thumbnail)}
                          alt={primaryImg.altText || group.product.name}
                          className="w-full h-full object-contain p-1 group-hover/thumb:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-1 p-1">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[9px] font-medium uppercase tracking-wider">No photo</span>
                        </div>
                      )}

                      {/* Photo count indicator badge */}
                      {imagesList.length > 1 && (
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold flex items-center gap-0.5 shadow-xs">
                          <span>📷</span>
                          <span>{imagesList.length}</span>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-4 h-4 text-primary drop-shadow-xs" />
                      </div>
                    </div>

                    {/* Product Metadata & Specifications */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {group.product.brand && (
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                            {group.product.brand.name}
                          </span>
                        )}
                        <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                          {group.product.name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border">
                          SKU: {group.product.sku}
                        </span>
                        {group.product.modelNumber && (
                          <span className="text-[11px]">Model: {group.product.modelNumber}</span>
                        )}
                        <span className="text-border">•</span>

                        {/* Primary Category */}
                        {group.product.category && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                            <Layers className="w-3 h-3" />
                            {group.product.category.name}
                          </span>
                        )}

                        {/* Secondary Categories */}
                        {group.product.categories &&
                          group.product.categories
                            .filter((pc) => !pc.isPrimary)
                            .map((pc) => (
                              <span
                                key={pc.id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border"
                                title="Additional Category Membership"
                              >
                                +{pc.name}
                              </span>
                            ))}

                        {/* Current Floor Stock */}
                        <span className="text-border">•</span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Boxes className="w-3 h-3 text-muted-foreground/80" />
                          <span>Stock: <strong className="text-foreground">{group.product.currentStock}</strong></span>
                        </span>
                      </div>

                      {/* DYNAMIC PRODUCT SPECIFICATIONS (Material, Gas Type, Ignition, Burners, etc.) */}
                      {specsList.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          {specsList.map((spec) => {
                            const valDisplay =
                              spec.value ||
                              (spec.numericValue !== null ? `${spec.numericValue}${spec.unit ? ` ${spec.unit}` : ""}` : "") ||
                              (spec.booleanValue ? "Yes" : "");
                            if (!valDisplay) return null;

                            return (
                              <span
                                key={spec.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground border border-border/70 text-[11px] transition"
                                title={`${spec.attributeName}: ${valDisplay}`}
                              >
                                <span className="text-muted-foreground/80 font-normal">{spec.attributeName}:</span>
                                <span className="font-semibold text-foreground">{valDisplay}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Retail Pricing, Best Quote Summary & Actions */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-center">
                    {/* Retail Pricing Indicators */}
                    <div className="text-right hidden sm:block pr-3 border-r border-border">
                      <div className="text-[11px] text-muted-foreground">Retail Pricing</div>
                      <div className="text-xs font-semibold text-foreground">
                        {group.product.sellingPrice ? (
                          <>
                            <span className="text-emerald-400 font-bold">
                              ₹{group.product.sellingPrice.toLocaleString("en-IN")}
                            </span>
                            <span className="line-through text-muted-foreground/60 text-[10px] ml-1.5">
                              ₹{group.product.mrp.toLocaleString("en-IN")}
                            </span>
                          </>
                        ) : (
                          <span>₹{group.product.mrp.toLocaleString("en-IN")} MRP</span>
                        )}
                      </div>
                    </div>

                    {/* Lowest Quoted Deal Highlight */}
                    {group.lowestQuotedPrice !== null ? (
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-left">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Lowest Quote</span>
                        </div>
                        <div className="text-sm font-extrabold text-emerald-300">
                          ₹{group.lowestQuotedPrice.toLocaleString("en-IN")}
                          {(group.bestMarginPercent ?? group.potentialMarginPercent) !== null && (
                            <span className="text-[10px] font-semibold text-emerald-400 ml-1.5">
                              ({group.bestMarginPercent ?? group.potentialMarginPercent}% margin)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs">
                        No quotes yet
                      </div>
                    )}

                    {/* Add Quote for this product */}
                    <button
                      type="button"
                      onClick={() => onAddQuotation(group.product.id)}
                      className="p-2 sm:px-3 sm:py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Add supplier quotation for this product"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Add Quote</span>
                    </button>

                    {/* Expand/Collapse Button */}
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.product.id)}
                      className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                      aria-label="Toggle quotation list"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* QUOTATIONS TABLE / COMPARISON LIST */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    {group.quotations.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No supplier quotes on file for this product. Click &quot;Add Quote&quot; to compare wholesale prices.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] border-b border-border uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-4">Supplier / Seller</th>
                            <th className="py-2.5 px-4">Quoted Price</th>
                            <th className="py-2.5 px-4">Price Difference / Deal</th>
                            <th className="py-2.5 px-4">Est. Gross Margin</th>
                            <th className="py-2.5 px-4">Quote Date & Validity</th>
                            <th className="py-2.5 px-4">Terms / MOQ</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {group.quotations.map((quote) => {
                            const isLowest = quote.isLowestPrice;
                            const priceDiff =
                              group.lowestQuotedPrice !== null && !isLowest
                                ? quote.quotedPrice - group.lowestQuotedPrice
                                : 0;

                            const retailPrice =
                              group.product.sellingPrice || group.product.mrp;
                            const profit = retailPrice - quote.quotedPrice;
                            const marginPct =
                              retailPrice > 0
                                ? Math.round(((profit / retailPrice) * 100) * 10) / 10
                                : 0;

                            return (
                              <tr
                                key={quote.id}
                                className={`hover:bg-muted/20 transition ${
                                  isLowest ? "bg-emerald-500/[0.03]" : ""
                                }`}
                              >
                                {/* Supplier Name */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                        isLowest
                                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                          : "bg-muted text-muted-foreground border border-border"
                                      }`}
                                    >
                                      <Building2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="font-semibold text-foreground">
                                        {quote.supplierName}
                                      </div>
                                      {quote.createdByUser && (
                                        <div className="text-[10px] text-muted-foreground/70">
                                          Logged by {quote.createdByUser.name}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Quoted Price */}
                                <td className="py-3 px-4">
                                  <div className="font-extrabold text-sm text-foreground">
                                    ₹{quote.quotedPrice.toLocaleString("en-IN")}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    per unit wholesale
                                  </div>
                                </td>

                                {/* Price Difference / Comparison Badge */}
                                <td className="py-3 px-4">
                                  {isLowest ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                      <Sparkles className="w-3 h-3" />
                                      Lowest Quote
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium">
                                      +₹{priceDiff.toLocaleString("en-IN")} higher
                                    </span>
                                  )}
                                </td>

                                {/* Estimated Margin */}
                                <td className="py-3 px-4">
                                  <div
                                    className={`font-bold ${
                                      marginPct > 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {marginPct}% ({profit >= 0 ? "+" : ""}₹
                                    {profit.toLocaleString("en-IN")})
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    vs ₹{retailPrice.toLocaleString("en-IN")} retail
                                  </div>
                                </td>

                                {/* Quotation Date & Validity */}
                                <td className="py-3 px-4 text-muted-foreground">
                                  <div className="flex items-center gap-1 text-foreground font-medium">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span>
                                      {new Date(quote.quotationDate).toLocaleDateString("en-IN")}
                                    </span>
                                  </div>
                                  {quote.validUntil ? (
                                    <div className="text-[10px] text-amber-300/80">
                                      Valid until {new Date(quote.validUntil).toLocaleDateString("en-IN")}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-muted-foreground/60">
                                      Open validity
                                    </div>
                                  )}
                                </td>

                                {/* Terms & MOQ */}
                                <td className="py-3 px-4 max-w-xs text-muted-foreground">
                                  <div className="flex items-center gap-2 text-[11px]">
                                    {quote.moq && (
                                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                        MOQ: {quote.moq}
                                      </span>
                                    )}
                                    {quote.leadTimeDays && (
                                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                        {quote.leadTimeDays}d lead
                                      </span>
                                    )}
                                  </div>
                                  {quote.notes && (
                                    <p className="text-[11px] text-foreground/80 mt-1 line-clamp-1">
                                      {quote.notes}
                                    </p>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onEditQuotation(quote)}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                                      title="Edit Quotation"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteQuotation(quote)}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                      title="Delete Quotation"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* IMAGE GALLERY / PREVIEW LIGHTBOX MODAL */}
      {galleryProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">{galleryProduct.name}</h4>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="font-mono">SKU: {galleryProduct.sku}</span>
                  {galleryProduct.brand && <span>• {galleryProduct.brand.name}</span>}
                  {galleryProduct.category && <span>• {galleryProduct.category.name}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseGallery}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Active Image Preview */}
            <div className="p-6 flex-1 flex items-center justify-center bg-muted/20 relative min-h-[300px] sm:min-h-[420px]">
              {galleryProduct.images && galleryProduct.images.length > 0 ? (
                <>
                  <img
                    src={getOptimizedImageUrl(
                      galleryProduct.images[galleryActiveIndex]?.url || galleryProduct.primaryImage?.url || "",
                      IMAGE_PROFILES.detail
                    )}
                    alt={galleryProduct.images[galleryActiveIndex]?.altText || galleryProduct.name}
                    className="max-h-[50vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
                  />

                  {/* Previous Button */}
                  {galleryProduct.images.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryActiveIndex((prev) =>
                          prev === 0 ? (galleryProduct.images?.length || 1) - 1 : prev - 1
                        )
                      }
                      className="absolute left-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition shadow-md cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Next Button */}
                  {galleryProduct.images.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryActiveIndex((prev) =>
                          prev === (galleryProduct.images?.length || 1) - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition shadow-md cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Package className="w-16 h-16 stroke-[1.2] text-muted-foreground/40" />
                  <span className="text-xs font-medium">No images uploaded for this product</span>
                </div>
              )}
            </div>

            {/* Modal Footer: Thumbnail Strip */}
            {galleryProduct.images && galleryProduct.images.length > 1 && (
              <div className="p-3 border-t border-border bg-card flex items-center justify-center gap-2 overflow-x-auto">
                {galleryProduct.images.map((img, idx) => (
                  <button
                    key={img.id || idx}
                    type="button"
                    onClick={() => setGalleryActiveIndex(idx)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer p-0.5 bg-background ${
                      galleryActiveIndex === idx
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-muted-foreground/50 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={getOptimizedImageUrl(img.url, IMAGE_PROFILES.thumbnail)}
                      alt={img.altText || ""}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
