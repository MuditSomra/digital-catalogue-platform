"use client";

import React from "react";
import {
  Search,
  Filter,
  PackagePlus,
  ShoppingCart,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  InventoryListItem,
  BrandOption,
  InventoryMovementType,
  STOCK_STATUS_LABELS,
  PaginatedInventoryResponse,
} from "@/types";

interface FlatCategoryOption {
  id: string;
  name: string;
  path: string;
  depth: number;
  isDisabled: boolean;
}

interface InventoryListTableProps {
  items: InventoryListItem[];
  pagination: PaginatedInventoryResponse["pagination"] | null;
  loading: boolean;
  brands: BrandOption[];
  categories: FlatCategoryOption[];
  // Filters
  search: string;
  onSearchChange: (val: string) => void;
  selectedBrandId: string;
  onBrandChange: (val: string) => void;
  selectedCategoryId: string;
  onCategoryChange: (val: string) => void;
  stockStatus: string;
  onStockStatusChange: (val: string) => void;
  onClearFilters: () => void;
  // Pagination
  currentPage: number;
  onPageChange: (page: number) => void;
  // Actions
  onManageInventory: (item: InventoryListItem) => void;
  onQuickAddStock: (item: InventoryListItem) => void;
  onQuickRecordSale: (item: InventoryListItem) => void;
}

export function InventoryListTable({
  items,
  pagination,
  loading,
  brands,
  categories,
  search,
  onSearchChange,
  selectedBrandId,
  onBrandChange,
  selectedCategoryId,
  onCategoryChange,
  stockStatus,
  onStockStatusChange,
  onClearFilters,
  currentPage,
  onPageChange,
  onManageInventory,
  onQuickAddStock,
  onQuickRecordSale,
}: InventoryListTableProps) {
  const hasActiveFilters = Boolean(
    search.trim() || selectedBrandId || selectedCategoryId || stockStatus !== "all"
  );

  return (
    <div className="space-y-4">
      {/* FILTER BAR */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by product name, SKU, model number, brand, category..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Quick status filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "all", label: "All Items" },
              { id: "in_stock", label: "In Stock" },
              { id: "low_stock", label: "Low Stock Alert" },
              { id: "out_of_stock", label: "Out of Stock" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onStockStatusChange(st.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition ${
                  stockStatus === st.id
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdowns row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/60">
          {/* Category Filter */}
          <div className="flex-1 min-w-[180px]">
            <select
              value={selectedCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {"— ".repeat(cat.depth)}
                  {cat.name} {cat.depth > 0 ? `(${cat.path})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={selectedBrandId}
              onChange={(e) => onBrandChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Result Count Indicator */}
          {pagination && (
            <div className="ml-auto text-xs text-muted-foreground font-medium pl-2">
              Showing <strong className="text-foreground">{items.length}</strong> of{" "}
              <strong className="text-foreground">{pagination.totalCount}</strong> inventory items
            </div>
          )}
        </div>
      </div>

      {/* INVENTORY ITEMS TABLE */}
      {loading ? (
        <div className="p-12 bg-card border border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground text-xs gap-3">
          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span>Loading inventory data...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 bg-card border border-border rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No Inventory Items Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No products match the selected inventory filters. Try adjusting your search query."
                : "No products exist in your catalogue yet."}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW (Visible on >= 768px) */}
          <div className="hidden md:block bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">Brand</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">SKU / Model</th>
                    <th className="py-3 px-3 text-center">Current Stock</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Alert Level</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item) => (
                    <tr
                      key={item.productId}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      {/* Product Name */}
                      <td className="py-3.5 px-4 font-medium text-foreground max-w-[240px]">
                        <button
                          type="button"
                          onClick={() => onManageInventory(item)}
                          className="text-left font-semibold text-foreground hover:text-primary transition line-clamp-2"
                        >
                          {item.productName}
                        </button>
                      </td>

                      {/* Brand */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-md bg-muted/60 border border-border/80 text-[11px] font-medium text-foreground">
                          {item.brand.name}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 text-muted-foreground max-w-[140px] truncate">
                        <span className="text-[11px] font-medium text-foreground/90">
                          {item.category.name}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-[11px] font-semibold text-foreground">
                          {item.sku}
                        </div>
                        {item.modelNumber && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                            {item.modelNumber}
                          </div>
                        )}
                      </td>

                      {/* Current Stock Count */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="text-base font-bold text-foreground">
                          {item.quantity}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1">units</span>
                      </td>

                      {/* Stock Status Badge */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {item.stockStatus === "IN_STOCK" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>In Stock</span>
                          </span>
                        )}
                        {item.stockStatus === "LOW_STOCK" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Low Stock</span>
                          </span>
                        )}
                        {item.stockStatus === "OUT_OF_STOCK" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Out of Stock</span>
                          </span>
                        )}
                      </td>

                      {/* Low Stock Alert Level */}
                      <td className="py-3.5 px-3 text-center text-muted-foreground whitespace-nowrap">
                        <span className="font-mono text-[11px]">≤ {item.lowStockThreshold} units</span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onQuickAddStock(item)}
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition"
                            title="Add Stock"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickRecordSale(item)}
                            className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
                            title="Record Sale"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onManageInventory(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition flex items-center gap-1 ml-1"
                          >
                            <span>Manage</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS VIEW (Visible on < 768px) */}
          <div className="block md:hidden space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <span>{item.brand.name}</span>
                      <span>&bull;</span>
                      <span>{item.category.name}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground leading-snug">
                      {item.productName}
                    </h4>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      SKU: {item.sku}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {item.stockStatus === "IN_STOCK" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        In Stock
                      </span>
                    )}
                    {item.stockStatus === "LOW_STOCK" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Low Stock
                      </span>
                    )}
                    {item.stockStatus === "OUT_OF_STOCK" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Details Strip */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Current Units
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {item.quantity} units
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Alert Level
                    </span>
                    <span className="font-mono text-muted-foreground">
                      ≤ {item.lowStockThreshold} units
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onQuickAddStock(item)}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold transition flex items-center gap-1 text-primary"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>+ Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickRecordSale(item)}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold transition flex items-center gap-1 text-emerald-400"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>- Sale</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onManageInventory(item)}
                    className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-xs flex items-center gap-1"
                  >
                    <span>Manage</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PAGINATION CONTROLS */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                Page <strong className="text-foreground">{pagination.page}</strong> of{" "}
                <strong className="text-foreground">{pagination.totalPages}</strong> ({pagination.totalCount} total items)
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages}
                  className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
