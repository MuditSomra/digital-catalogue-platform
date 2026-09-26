"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  SlidersHorizontal,
  Search,
  Scale,
  Package,
  Layers,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { ShowroomHeader } from "@/components/showroom/ShowroomHeader";
import { ProductCard } from "@/components/showroom/ProductCard";
import { DynamicFilterSidebar } from "@/components/showroom/DynamicFilterSidebar";
import { ComparisonFloatingBar } from "@/components/showroom/ComparisonFloatingBar";
import type {
  CatalogueProductItem,
  CategoryTreeNode,
  BrandOption,
  DynamicAttributeFilterDef,
  PaginationInfo,
} from "@/types";
import type { AttributeFilterParam } from "@/lib/catalogue-service";

function CustomerCatalogueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Data States
  const [products, setProducts] = useState<CatalogueProductItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [availableFilters, setAvailableFilters] = useState<DynamicAttributeFilterDef[]>([]);
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number }>({ min: 0, max: 100000 });
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get("category") || "");
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilterParam[]>([]);
  const [sortBy, setSortBy] = useState<string>("featured");
  const [currentPage, setCurrentPage] = useState(1);

  // Comparison State (max 3 products)
  const [comparedProducts, setComparedProducts] = useState<CatalogueProductItem[]>([]);

  // 1. Fetch Categories & Brands initially
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [catsRes, brandsRes] = await Promise.all([
          fetch("/api/admin/categories"),
          fetch("/api/admin/brands"),
        ]);
        if (catsRes.ok) {
          const catsJson = await catsRes.json();
          setCategories(catsJson.data?.tree || []);
        }
        if (brandsRes.ok) {
          const brandsJson = await brandsRes.json();
          setBrands(brandsJson.data || []);
        }
      } catch (err) {
        console.error("Failed to load auxiliary catalogue data:", err);
      }
    }
    loadAuxData();
  }, []);

  // 2. Fetch Catalogue Products whenever filters change
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "12");
      params.set("sortBy", sortBy);

      if (search.trim()) params.set("search", search.trim());
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (selectedBrandIds.length > 0) params.set("brandIds", selectedBrandIds.join(","));
      if (minPrice !== undefined) params.set("minPrice", String(minPrice));
      if (maxPrice !== undefined) params.set("maxPrice", String(maxPrice));
      if (inStockOnly) params.set("inStockOnly", "true");
      if (attributeFilters.length > 0) {
        params.set("attributeFilters", JSON.stringify(attributeFilters));
      }

      const res = await fetch(`/api/catalogue/products?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setProducts(json.data.products);
        setPagination(json.data.pagination);
        setAvailableFilters(json.data.availableFilters || []);
        if (json.data.priceRange) {
          setPriceBounds(json.data.priceRange);
        }
      }
    } catch (err) {
      console.error("Failed to fetch catalogue products:", err);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    sortBy,
    search,
    selectedCategoryId,
    selectedBrandIds,
    minPrice,
    maxPrice,
    inStockOnly,
    attributeFilters,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle Category Change (resets dynamic attribute filters)
  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    setAttributeFilters([]);
    setCurrentPage(1);
  };

  // Handle Brand Toggle
  const handleBrandToggle = (brandId: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
    setCurrentPage(1);
  };

  // Handle Dynamic Attribute Filter
  const handleAttributeFilterChange = (slug: string, values: string[]) => {
    setAttributeFilters((prev) => {
      const filtered = prev.filter((af) => af.slug !== slug);
      if (values.length > 0) {
        filtered.push({ slug, values });
      }
      return filtered;
    });
    setCurrentPage(1);
  };

  // Handle Clear All
  const handleClearAll = () => {
    setSearch("");
    setSelectedCategoryId("");
    setSelectedBrandIds([]);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setInStockOnly(false);
    setAttributeFilters([]);
    setCurrentPage(1);
  };

  // Comparison Handlers
  const handleToggleCompare = (product: CatalogueProductItem) => {
    setComparedProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, product];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <ShowroomHeader
        comparedCount={comparedProducts.length}
        searchQuery={search}
        onSearchChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mobile Search Bar (Visible on small screens) */}
        <div className="md:hidden">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search appliances, brands, models..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition shadow-2xs"
            />
          </div>
        </div>

        {/* Top Control Bar: Total Count, Sorting & Mobile Filter Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            {/* Mobile Filter Drawer Button */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              {loading ? (
                "Loading appliances..."
              ) : pagination ? (
                <>
                  Showing <strong>{products.length}</strong> of <strong>{pagination.totalCount}</strong>{" "}
                  appliances
                </>
              ) : (
                "Showroom Catalogue"
              )}
            </span>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Sort by:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition cursor-pointer appearance-none"
              >
                <option value="featured">Featured First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
                <option value="newest">Newest Arrivals</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Catalogue Content Layout (Sidebar + Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Filter Sidebar (3 cols) */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-4">
            <DynamicFilterSidebar
              categories={categories}
              brands={brands}
              availableFilters={availableFilters}
              priceRange={priceBounds}
              selectedCategoryId={selectedCategoryId}
              selectedBrandIds={selectedBrandIds}
              minPrice={minPrice}
              maxPrice={maxPrice}
              inStockOnly={inStockOnly}
              attributeFilters={attributeFilters}
              onCategoryChange={handleCategoryChange}
              onBrandToggle={handleBrandToggle}
              onPriceChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max);
                setCurrentPage(1);
              }}
              onInStockToggle={(val) => {
                setInStockOnly(val);
                setCurrentPage(1);
              }}
              onAttributeFilterChange={handleAttributeFilterChange}
              onClearAll={handleClearAll}
            />
          </aside>

          {/* Product Grid (9 cols) */}
          <div className="lg:col-span-9 space-y-6">
            {loading ? (
              <div className="py-24 text-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs text-slate-500 font-medium">Loading showroom appliances...</div>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Appliances Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  We couldn&apos;t find any kitchen appliances matching your search or active filter criteria. Try adjusting or clearing your filters.
                </p>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isCompared={comparedProducts.some((p) => p.id === product.id)}
                      onToggleCompare={handleToggleCompare}
                      canCompare={comparedProducts.length < 3}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">
                      Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={!pagination.hasPrevPage}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                        .filter((p) => Math.abs(p - pagination.page) <= 2 || p === 1 || p === pagination.totalPages)
                        .map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="text-xs text-slate-400 px-1">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`w-8 h-8 rounded-xl text-xs font-bold transition ${
                                p === pagination.page
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={!pagination.hasNextPage}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Filter Drawer Overlay */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative ml-auto w-full max-w-xs bg-white h-full overflow-y-auto p-4 z-10 animate-in slide-in-from-right duration-200 shadow-2xl">
            <DynamicFilterSidebar
              categories={categories}
              brands={brands}
              availableFilters={availableFilters}
              priceRange={priceBounds}
              selectedCategoryId={selectedCategoryId}
              selectedBrandIds={selectedBrandIds}
              minPrice={minPrice}
              maxPrice={maxPrice}
              inStockOnly={inStockOnly}
              attributeFilters={attributeFilters}
              onCategoryChange={handleCategoryChange}
              onBrandToggle={handleBrandToggle}
              onPriceChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max);
                setCurrentPage(1);
              }}
              onInStockToggle={(val) => {
                setInStockOnly(val);
                setCurrentPage(1);
              }}
              onAttributeFilterChange={handleAttributeFilterChange}
              onClearAll={handleClearAll}
              onCloseMobile={() => setMobileFilterOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Floating Comparison Bar */}
      <ComparisonFloatingBar
        comparedProducts={comparedProducts}
        onRemoveProduct={(id) => setComparedProducts((prev) => prev.filter((p) => p.id !== id))}
        onClearAll={() => setComparedProducts([])}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          Loading showroom...
        </div>
      }
    >
      <CustomerCatalogueContent />
    </Suspense>
  );
}
