"use client";

import React from "react";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Package,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  Image as ImageIcon,
} from "lucide-react";
import type {
  ProductListItem,
  BrandOption,
  PaginatedProductsResponse,
  CategoryTreeNode,
  FlatCategoryOption,
} from "@/types";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";

interface ProductListTableProps {
  products: ProductListItem[];
  pagination: PaginatedProductsResponse["pagination"] | null;
  loading: boolean;
  brands: BrandOption[];
  categories: CategoryTreeNode[] | FlatCategoryOption[] | any[];
  // Filters
  search: string;
  onSearchChange: (val: string) => void;
  selectedBrandId: string;
  onBrandChange: (val: string) => void;
  selectedCategoryId: string;
  onCategoryChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  onClearFilters: () => void;
  // Pagination
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  // Actions
  onAddProduct: () => void;
  onEditProduct: (product: ProductListItem) => void;
  onDeleteProduct: (product: ProductListItem) => void;
  onToggleActive: (product: ProductListItem) => void;
  onManageMedia?: (product: ProductListItem) => void;
}

export function ProductListTable({
  products,
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
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
  currentPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onToggleActive,
  onManageMedia,
}: ProductListTableProps) {
  const hasActiveFilters = Boolean(
    search.trim() || selectedBrandId || selectedCategoryId || statusFilter !== "all"
  );

  return (
    <div className="space-y-4">
      {/* FILTER & ACTION BAR */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by product name, SKU, model number, brand..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Add Product CTA */}
          <button
            onClick={onAddProduct}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/60">
          {/* Category Filter */}
          <div className="flex-1 min-w-[200px]">
            <CascadingCategorySelect
              value={selectedCategoryId}
              onChange={(newCatId) => onCategoryChange(newCatId || "")}
              categories={categories}
              allowRootSelection={true}
              rootLabel="All Categories"
              isFilterMode={true}
              size="sm"
              layout="responsive"
              idPrefix="product-filter-cat"
            />
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

          {/* Status Filter */}
          <div className="w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="featured">Featured Only</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Total count badge */}
          {pagination && (
            <div className="ml-auto text-xs text-muted-foreground font-medium pl-2">
              Showing <strong className="text-foreground">{products.length}</strong> of{" "}
              <strong className="text-foreground">{pagination.totalCount}</strong> products
            </div>
          )}
        </div>
      </div>

      {/* PRODUCTS CONTAINER */}
      {loading ? (
        <div className="p-12 bg-card border border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground text-xs gap-3">
          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span>Loading products catalogue...</span>
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="p-12 bg-card border border-border rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No Products Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No products match your current filters. Try changing your search query or reset filters."
                : "Your showroom catalogue is empty. Click below to add your first product."}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition"
            >
              Reset All Filters
            </button>
          ) : (
            <button
              onClick={onAddProduct}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition flex items-center gap-1.5 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Product</span>
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
                    <th className="py-3 px-3 text-right">MRP</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3">Price Code</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      {/* Product Name & Badges */}
                      <td className="py-3.5 px-4 font-medium text-foreground max-w-[280px]">
                        <div className="flex items-center gap-3">
                          {/* Product Thumbnail */}
                          <div
                            onClick={() => onManageMedia && onManageMedia(product)}
                            className="w-10 h-10 shrink-0 rounded-xl bg-muted/40 border border-border overflow-hidden flex items-center justify-center relative cursor-pointer group/thumb hover:border-primary/50 transition"
                            title="Click to view/manage media"
                          >
                            {product.primaryImage ? (
                              <img
                                src={product.primaryImage.url}
                                alt={product.primaryImage.altText || product.name}
                                className="w-full h-full object-contain p-1 group-hover/thumb:scale-105 transition"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-xs line-clamp-2 leading-snug">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {product.isFeatured && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Featured
                                </span>
                              )}
                              {((product.imagesCount ?? product._count?.images ?? 0) > 0 ||
                                (product.videosCount ?? product._count?.videos ?? 0) > 0) && (
                                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                  📷 {product.imagesCount ?? product._count?.images ?? 0}
                                  {(product.videosCount ?? product._count?.videos ?? 0) > 0 &&
                                    ` • 🎥 ${product.videosCount ?? product._count?.videos}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="py-3.5 px-3 font-medium text-foreground whitespace-nowrap">
                        <span className="px-2 py-1 rounded-md bg-muted/60 border border-border/80 text-[11px]">
                          {product.brand ? product.brand.name : "—"}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 text-muted-foreground max-w-[160px] truncate">
                        <span className="text-[11px] font-medium text-foreground/90">
                          {product.category.name}
                        </span>
                      </td>

                      {/* SKU & Model Number */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-[11px] font-semibold text-foreground">
                          {product.sku}
                        </div>
                        {product.modelNumber && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                            {product.modelNumber}
                          </div>
                        )}
                      </td>

                      {/* MRP */}
                      <td className="py-3.5 px-3 text-right font-semibold text-foreground whitespace-nowrap">
                        ₹{product.mrp.toLocaleString("en-IN")}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {product.sellingPrice ? (
                          <div>
                            <div className="font-bold text-emerald-400">
                              ₹{product.sellingPrice.toLocaleString("en-IN")}
                            </div>
                            {product.discountPercent !== null && product.discountPercent > 0 && (
                              <span className="text-[10px] font-bold text-emerald-500">
                                {product.discountPercent}% OFF
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Price Code (Non-secret customer-visible code) */}
                      <td className="py-3.5 px-3">
                        {product.privatePriceCode ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            <Tag className="w-3 h-3" />
                            {product.privatePriceCode}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onToggleActive(product)}
                          title={`Click to ${product.isActive ? "deactivate" : "activate"}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                            product.isActive
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                          }`}
                        >
                          {product.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-muted-foreground" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {onManageMedia && (
                            <button
                              onClick={() => onManageMedia(product)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                              title="Manage Images & Videos"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditProduct(product)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(product)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            {products.map((product) => (
              <div
                key={product.id}
                className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3"
              >
                {/* Header: Title, Thumbnail & Badges */}
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => onManageMedia && onManageMedia(product)}
                    className="w-12 h-12 shrink-0 rounded-xl bg-muted/40 border border-border overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {product.primaryImage ? (
                      <img
                        src={product.primaryImage.url}
                        alt={product.primaryImage.altText || product.name}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <span>{product.brand?.name}</span>
                      <span>&bull;</span>
                      <span>{product.category.name}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                      {product.name}
                    </h4>
                  </div>
                  {product.isFeatured && (
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Featured
                    </span>
                  )}
                </div>

                {/* SKU / Model & Price Code */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">SKU</span>
                    <span className="font-mono font-semibold text-foreground">{product.sku}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Price Code</span>
                    <span className="font-mono font-semibold text-cyan-300">
                      {product.privatePriceCode || "—"}
                    </span>
                  </div>
                </div>

                {/* Pricing & Discount */}
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">MRP</span>
                    <span className="font-semibold text-foreground">
                      ₹{product.mrp.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Selling Price</span>
                    {product.sellingPrice ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-400">
                          ₹{product.sellingPrice.toLocaleString("en-IN")}
                        </span>
                        {product.discountPercent !== null && product.discountPercent > 0 && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {product.discountPercent}% OFF
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground font-medium">—</span>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <button
                    onClick={() => onToggleActive(product)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      product.isActive
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {product.isActive ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-muted-foreground" />
                        <span>Inactive</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {onManageMedia && (
                      <button
                        onClick={() => onManageMedia(product)}
                        className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold transition flex items-center gap-1"
                        title="Manage Media"
                      >
                        <ImageIcon className="w-3 h-3 text-primary" />
                        <span>Media</span>
                      </button>
                    )}
                    <button
                      onClick={() => onEditProduct(product)}
                      className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onDeleteProduct(product)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* PAGINATION CONTROLS */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                Page <strong className="text-foreground">{pagination.page}</strong> of{" "}
                <strong className="text-foreground">{pagination.totalPages}</strong> ({pagination.totalCount} total products)
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

                {/* Page Number Pills */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return (
                        p === 1 ||
                        p === pagination.totalPages ||
                        Math.abs(p - currentPage) <= 1
                      );
                    })
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-muted-foreground">...</span>
                        )}
                        <button
                          onClick={() => onPageChange(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                            currentPage === p
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

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
