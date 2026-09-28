"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PurchasingComparisonView } from "@/components/admin/purchasing/PurchasingComparisonView";
import { QuotationFormModal } from "@/components/admin/purchasing/QuotationFormModal";
import { ProductWithQuoteModal } from "@/components/admin/purchasing/ProductWithQuoteModal";
import { QuotationDeleteModal } from "@/components/admin/purchasing/QuotationDeleteModal";
import { useToast } from "@/components/ui/ToastContext";
import {
  Building2,
  DollarSign,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  PackageCheck,
  Boxes,
  Lock,
} from "lucide-react";
import type {
  ProductQuotationGroup,
  SupplierQuotationItem,
  BrandOption,
  CategoryTreeNode,
  FlatCategoryOption,
} from "@/types";

export function PurchasingClient() {
  const { success, error, info } = useToast();

  // Quotation Groups Data
  const [groups, setGroups] = useState<ProductQuotationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auxiliary Data
  const [categories, setCategories] = useState<CategoryTreeNode[] | FlatCategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [productsList, setProductsList] = useState<Array<{
    id: string;
    name: string;
    sku: string;
    mrp: number;
    sellingPrice: number | null;
    brand?: { name: string } | null;
  }>>([]);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [sortBy, setSortBy] = useState("lowest_price");
  const [dynamicAttributeFilters, setDynamicAttributeFilters] = useState<Record<string, string>>({});
  const [availableAttributes, setAvailableAttributes] = useState<any[]>([]);

  // Modal States
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [quotationToEdit, setQuotationToEdit] = useState<SupplierQuotationItem | null>(null);
  const [preselectedProductId, setPreselectedProductId] = useState<string | null>(null);

  const [isProductWithQuoteModalOpen, setIsProductWithQuoteModalOpen] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<SupplierQuotationItem | null>(null);

  // Fetch Auxiliary Data (Categories, Brands, Products)
  const fetchAuxData = useCallback(async () => {
    try {
      const [catsRes, brandsRes, prodsRes] = await Promise.all([
        fetch("/api/admin/purchasing/categories"),
        fetch("/api/admin/brands"),
        fetch("/api/admin/products?limit=100"),
      ]);

      if (catsRes.ok) {
        const catsJson = await catsRes.json();
        const catList = Array.isArray(catsJson.data)
          ? catsJson.data
          : Array.isArray(catsJson.data?.tree)
          ? catsJson.data.tree
          : Array.isArray(catsJson.data?.flat)
          ? catsJson.data.flat
          : [];
        setCategories(catList);
      }

      if (brandsRes.ok) {
        const brandsJson = await brandsRes.json();
        setBrands(Array.isArray(brandsJson.data) ? brandsJson.data : []);
      }

      if (prodsRes.ok) {
        const prodsJson = await prodsRes.json();
        const prodList = Array.isArray(prodsJson.data?.products)
          ? prodsJson.data.products
          : Array.isArray(prodsJson.data)
          ? prodsJson.data
          : [];
        setProductsList(prodList);
      }
    } catch (err) {
      console.error("Error fetching auxiliary data:", err);
    }
  }, []);

  // Fetch Category Attributes when category filter changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setAvailableAttributes([]);
      setDynamicAttributeFilters({});
      return;
    }

    async function loadAttributes() {
      try {
        const res = await fetch(`/api/admin/categories/${selectedCategoryId}/attributes`);
        if (res.ok) {
          const json = await res.json();
          const attrList = Array.isArray(json.data) ? json.data : [];
          const filterable = attrList.filter(
            (a: any) => a && a.isFilterable && Array.isArray(a.predefinedValues) && a.predefinedValues.length > 0
          );
          setAvailableAttributes(filterable);
        }
      } catch (err) {
        console.error("Error fetching category attributes:", err);
      }
    }

    loadAttributes();
  }, [selectedCategoryId]);

  // Fetch Quotation Groups
  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (search.trim()) params.set("search", search.trim());
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (sortBy) params.set("sortBy", sortBy);

      // Add dynamic attribute filters
      if (dynamicAttributeFilters && typeof dynamicAttributeFilters === "object") {
        for (const [key, value] of Object.entries(dynamicAttributeFilters)) {
          if (value) params.set(`attr_${key}`, value);
        }
      }

      const res = await fetch(`/api/admin/purchasing/quotations?${params.toString()}`);
      if (res.status === 403) {
        error("Access Denied", "Owner permissions required to view purchasing quotations.");
        setGroups([]);
        return;
      }

      const json = await res.json();

      if (json.success) {
        setGroups(Array.isArray(json.data?.groups) ? json.data.groups : []);
      } else {
        error("Failed to load quotations", json.error?.message);
      }
    } catch (err: unknown) {
      error(
        "Network Error",
        err instanceof Error ? err.message : "Failed to load quotations."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategoryId, sortBy, dynamicAttributeFilters, error]);

  // Initial Data Fetch
  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  // Fetch quotations whenever query parameters change
  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuxData();
    fetchQuotations();
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedCategoryId("");
    setSortBy("lowest_price");
    setDynamicAttributeFilters({});
  };

  const handleAttributeFilterChange = (attrSlug: string, val: string) => {
    setDynamicAttributeFilters((prev) => ({
      ...prev,
      [attrSlug]: val,
    }));
  };

  // Open Quotation Modal for creating or editing
  const handleOpenAddQuotation = (productId?: string) => {
    setQuotationToEdit(null);
    setPreselectedProductId(productId || null);
    setIsQuotationModalOpen(true);
  };

  const handleOpenEditQuotation = (quotation: SupplierQuotationItem) => {
    setQuotationToEdit(quotation);
    setPreselectedProductId(quotation.productId);
    setIsQuotationModalOpen(true);
  };

  const handleOpenDeleteQuotation = (quotation: SupplierQuotationItem) => {
    setQuotationToDelete(quotation);
    setIsDeleteModalOpen(true);
  };

  // Save Quotation (Create / Update)
  const handleSaveQuotation = async (payload: any) => {
    if (quotationToEdit) {
      // Update
      const res = await fetch(`/api/admin/purchasing/quotations/${quotationToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to update quotation.");
      }
      success("Quotation Updated", `Updated price quote from ${payload.supplierName}.`);
    } else {
      // Create
      const res = await fetch("/api/admin/purchasing/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to add quotation.");
      }
      success("Quotation Saved", `Recorded quote of ₹${payload.quotedPrice} from ${payload.supplierName}.`);
    }

    fetchQuotations();
  };

  // Confirm Delete Quotation
  const handleConfirmDeleteQuotation = async () => {
    if (!quotationToDelete) return;

    const res = await fetch(`/api/admin/purchasing/quotations/${quotationToDelete.id}`, {
      method: "DELETE",
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || "Failed to delete quotation.");
    }

    success("Quotation Removed", `Deleted price quote from ${quotationToDelete.supplierName}.`);
    fetchQuotations();
  };

  // Save Product with Initial Quotation
  const handleSaveProductWithQuote = async (payload: any) => {
    const res = await fetch("/api/admin/purchasing/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || "Failed to create product and quotation.");
    }

    success(
      "Product & Quotation Created",
      `"${payload.name}" was added with initial quote from ${payload.supplierName}.`
    );

    fetchAuxData();
    fetchQuotations();
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Building2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Purchasing & Supplier Comparison</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Owner Only
              </span>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Compare wholesale supplier purchase quotes by category and identify the best margin deals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            title="Refresh Quotations"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          <button
            onClick={() => setIsProductWithQuoteModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
          >
            <PackageCheck className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Add Product & Quote</span>
          </button>

          <button
            onClick={() => handleOpenAddQuotation()}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier Quote</span>
          </button>
        </div>
      </div>

      {/* PURCHASING COMPARISON INTERFACE */}
      <PurchasingComparisonView
        groups={groups}
        loading={loading}
        categories={categories}
        search={search}
        onSearchChange={(val) => setSearch(val)}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={(catId) => setSelectedCategoryId(catId)}
        sortBy={sortBy}
        onSortByChange={(s) => setSortBy(s)}
        dynamicAttributeFilters={dynamicAttributeFilters}
        onAttributeFilterChange={handleAttributeFilterChange}
        availableAttributes={availableAttributes}
        onClearFilters={handleClearFilters}
        onAddQuotation={handleOpenAddQuotation}
        onEditQuotation={handleOpenEditQuotation}
        onDeleteQuotation={handleOpenDeleteQuotation}
        onAddProductWithQuote={() => setIsProductWithQuoteModalOpen(true)}
      />

      {/* ADD / EDIT QUOTATION MODAL */}
      <QuotationFormModal
        isOpen={isQuotationModalOpen}
        onClose={() => setIsQuotationModalOpen(false)}
        onSave={handleSaveQuotation}
        quotationToEdit={quotationToEdit}
        preselectedProductId={preselectedProductId}
        products={productsList}
      />

      {/* ADD PRODUCT WITH INITIAL QUOTATION MODAL */}
      <ProductWithQuoteModal
        isOpen={isProductWithQuoteModalOpen}
        onClose={() => setIsProductWithQuoteModalOpen(false)}
        onSave={handleSaveProductWithQuote}
        categories={categories}
        brands={brands}
        onBrandCreated={(newBrand) => {
          setBrands((prev) => [newBrand, ...prev]);
        }}
      />

      {/* DELETE QUOTATION MODAL */}
      <QuotationDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteQuotation}
        quotation={quotationToDelete}
      />
    </div>
  );
}
