"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProductListTable } from "@/components/admin/products/ProductListTable";
import { ProductFormModal } from "@/components/admin/products/ProductFormModal";
import { ProductDeleteModal } from "@/components/admin/products/ProductDeleteModal";
import { ProductMediaModal } from "@/components/admin/products/ProductMediaModal";
import { useToast } from "@/components/ui/ToastContext";
import {
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Tag,
  Percent,
  Image as ImageIcon,
} from "lucide-react";
import type {
  ProductListItem,
  ProductAdminDetailView,
  BrandOption,
  PaginatedProductsResponse,
  CategoryTreeNode,
  FlatCategoryOption,
} from "@/types";

export default function AdminProductsPage() {
  const { success, error, info } = useToast();

  // Data States
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [pagination, setPagination] = useState<PaginatedProductsResponse["pagination"] | null>(null);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [categories, setCategories] = useState<CategoryTreeNode[] | FlatCategoryOption[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductAdminDetailView | ProductListItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [productForMedia, setProductForMedia] = useState<ProductListItem | null>(null);

  // Fetch Auxiliary Data (Brands & Categories)
  const fetchAuxData = useCallback(async () => {
    try {
      const [brandsRes, catsRes] = await Promise.all([
        fetch("/api/admin/brands"),
        fetch("/api/admin/categories"),
      ]);

      if (brandsRes.ok) {
        const brandsData = await brandsRes.json();
        setBrands(brandsData.data || []);
      }

      if (catsRes.ok) {
        const catsData = await catsRes.json();
        const catList = catsData.data?.tree || catsData.data?.flat || catsData.data || [];
        setCategories(catList);
      }
    } catch (err) {
      console.error("Error fetching brands or categories:", err);
    }
  }, []);

  // Fetch Products List
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));

      if (search.trim()) params.set("search", search.trim());
      if (selectedBrandId) params.set("brandId", selectedBrandId);
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setProducts(json.data.products);
        setPagination(json.data.pagination);
      } else {
        error("Failed to load products", json.error?.message);
      }
    } catch (err: unknown) {
      error(
        "Network Error",
        err instanceof Error ? err.message : "Failed to load products."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, search, selectedBrandId, selectedCategoryId, statusFilter, error]);

  // Initial Load
  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  // Fetch Products whenever filters change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Quick Refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuxData();
    fetchProducts();
  };

  // Clear Filters Handler
  const handleClearFilters = () => {
    setSearch("");
    setSelectedBrandId("");
    setSelectedCategoryId("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  // Open Create Product Modal
  const handleOpenCreateModal = () => {
    setProductToEdit(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Product Modal (loads full details including attribute values)
  const handleOpenEditModal = async (product: ProductListItem) => {
    try {
      const res = await fetch(`/api/admin/products/${product.id}`);
      const json = await res.json();
      if (json.success) {
        setProductToEdit(json.data);
      } else {
        setProductToEdit(product);
      }
    } catch (err) {
      setProductToEdit(product);
    }
    setIsFormModalOpen(true);
  };

  // Open Delete Product Modal
  const handleOpenDeleteModal = (product: ProductListItem) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  // Open Media Management Modal
  const handleOpenMediaModal = (product: ProductListItem) => {
    setProductForMedia(product);
    setIsMediaModalOpen(true);
  };

  // Save Product (Create / Update)
  const handleSaveProduct = async (payload: any) => {
    if (productToEdit) {
      // Update
      const res = await fetch(`/api/admin/products/${productToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to update product.");
      }
      success("Product Updated", `"${payload.name}" was updated successfully.`);
    } else {
      // Create
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to create product.");
      }
      success("Product Created", `"${payload.name}" was added to the catalogue.`);
    }

    fetchProducts();
  };

  // Toggle Active Status
  const handleToggleActive = async (product: ProductListItem) => {
    try {
      const nextActive = !product.isActive;
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const json = await res.json();
      if (json.success) {
        success(
          nextActive ? "Product Activated" : "Product Deactivated",
          `"${product.name}" is now ${nextActive ? "visible" : "hidden"} in the catalogue.`
        );
        fetchProducts();
      } else {
        error("Action Failed", json.error?.message || "Could not update status.");
      }
    } catch (err) {
      error("Action Failed", "Failed to update status.");
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;

    const res = await fetch(`/api/admin/products/${productToDelete.id}`, {
      method: "DELETE",
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || "Failed to delete product.");
    }

    success("Product Deleted", `"${productToDelete.name}" was permanently removed.`);
    fetchProducts();
  };

  // Stats Calculations
  const stats = React.useMemo(() => {
    const total = pagination ? pagination.totalCount : products.length;
    const activeCount = products.filter((p) => p.isActive).length;
    const featuredCount = products.filter((p) => p.isFeatured).length;
    const discountedCount = products.filter(
      (p) => p.sellingPrice !== null && p.sellingPrice < p.mrp
    ).length;

    return { total, activeCount, featuredCount, discountedCount };
  }, [pagination, products]);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Package className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Product Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Create, edit, view, and organize products with dynamic category specifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setProductForMedia(null);
              setIsMediaModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            title="Open Product Photo & Media Hub"
          >
            <ImageIcon className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Photo Manager</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            title="Refresh Catalogue"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Products</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {stats.total}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">In digital showroom</p>
        </div>

        {/* Active Products */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active & Live</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {stats.activeCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Visible to customers</p>
        </div>

        {/* Featured Showcase */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Featured Showcase</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {stats.featuredCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Highlighted on homepage</p>
        </div>

        {/* Special Deals */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Special Offers</span>
            <Percent className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300 mt-2">
            {stats.discountedCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Discounted items</p>
        </div>
      </div>

      {/* PRODUCTS TABLE & FILTERS */}
      <ProductListTable
        products={products}
        pagination={pagination}
        loading={loading}
        brands={brands}
        categories={categories}
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
        selectedBrandId={selectedBrandId}
        onBrandChange={(val) => {
          setSelectedBrandId(val);
          setCurrentPage(1);
        }}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={(val) => {
          setSelectedCategoryId(val);
          setCurrentPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          setCurrentPage(1);
        }}
        onClearFilters={handleClearFilters}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onAddProduct={handleOpenCreateModal}
        onEditProduct={handleOpenEditModal}
        onDeleteProduct={handleOpenDeleteModal}
        onToggleActive={handleToggleActive}
        onManageMedia={handleOpenMediaModal}
      />

      {/* CREATE / EDIT PRODUCT MODAL */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
        categories={categories}
        brands={brands}
        onBrandCreated={(newBrand) => {
          setBrands((prev) => [newBrand, ...prev]);
        }}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <ProductDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        product={productToDelete}
      />

      {/* STANDALONE MEDIA MANAGEMENT MODAL */}
      <ProductMediaModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        product={productForMedia}
        onMediaChanged={fetchProducts}
      />
    </div>
  );
}
