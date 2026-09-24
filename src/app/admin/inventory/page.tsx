"use client";

import React, { useState, useEffect, useCallback } from "react";
import { InventoryListTable } from "@/components/admin/inventory/InventoryListTable";
import { InventoryDetailModal } from "@/components/admin/inventory/InventoryDetailModal";
import { StockOperationModal } from "@/components/admin/inventory/StockOperationModal";
import { useToast } from "@/components/ui/ToastContext";
import {
  Boxes,
  PackageCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Package,
} from "lucide-react";
import {
  InventoryListItem,
  BrandOption,
  InventoryMetrics,
  PaginatedInventoryResponse,
  InventoryMovementType,
} from "@/types";

interface FlatCategoryOption {
  id: string;
  name: string;
  path: string;
  depth: number;
  isDisabled: boolean;
}

export default function AdminInventoryPage() {
  const { success, error, info } = useToast();

  // Data States
  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [pagination, setPagination] = useState<PaginatedInventoryResponse["pagination"] | null>(null);
  const [metrics, setMetrics] = useState<InventoryMetrics>({
    totalProducts: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalUnitsInStock: 0,
  });
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [categories, setCategories] = useState<FlatCategoryOption[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Quick Operation Modal State
  const [quickOpProduct, setQuickOpProduct] = useState<InventoryListItem | null>(null);
  const [quickOpType, setQuickOpType] = useState<InventoryMovementType>(InventoryMovementType.PURCHASE);
  const [isQuickOpModalOpen, setIsQuickOpModalOpen] = useState(false);

  // Fetch Brands and Flat Categories
  const fetchAuxData = useCallback(async () => {
    try {
      const [brandsRes, catsRes] = await Promise.all([
        fetch("/api/admin/brands"),
        fetch("/api/admin/categories?format=flat"),
      ]);

      if (brandsRes.ok) {
        const json = await brandsRes.json();
        setBrands(json.data || []);
      }

      if (catsRes.ok) {
        const json = await catsRes.json();
        setCategories(json.data || []);
      }
    } catch (err) {
      console.error("Error loading auxiliary data:", err);
    }
  }, []);

  // Fetch Inventory List
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "10");

      if (search.trim()) params.set("search", search.trim());
      if (selectedBrandId) params.set("brandId", selectedBrandId);
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (stockStatus !== "all") params.set("stockStatus", stockStatus);

      const res = await fetch(`/api/admin/inventory?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setItems(json.data.items);
        setPagination(json.data.pagination);
        setMetrics(json.data.metrics);
      } else {
        error("Failed to load inventory", json.error);
      }
    } catch (err: unknown) {
      error(
        "Network Error",
        err instanceof Error ? err.message : "Failed to load inventory."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, search, selectedBrandId, selectedCategoryId, stockStatus, error]);

  // Initial Load
  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  // Reload when filters change
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Refresh Handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuxData();
    fetchInventory();
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSearch("");
    setSelectedBrandId("");
    setSelectedCategoryId("");
    setStockStatus("all");
    setCurrentPage(1);
  };

  // Manage Inventory Action
  const handleManageInventory = (item: InventoryListItem) => {
    setSelectedProductId(item.productId);
    setIsDetailModalOpen(true);
  };

  // Quick Add Stock
  const handleQuickAddStock = (item: InventoryListItem) => {
    setQuickOpProduct(item);
    setQuickOpType(InventoryMovementType.PURCHASE);
    setIsQuickOpModalOpen(true);
  };

  // Quick Record Sale
  const handleQuickRecordSale = (item: InventoryListItem) => {
    setQuickOpProduct(item);
    setQuickOpType(InventoryMovementType.SALE);
    setIsQuickOpModalOpen(true);
  };

  const handleOperationSuccess = () => {
    success("Stock Updated", "Inventory movement recorded successfully.");
    fetchInventory();
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Inventory & Stock Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track available stock, record purchases, sales, damaged goods, and manage low-stock thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* In Stock */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">In Stock</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {metrics.inStockCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Healthy stock levels</p>
        </div>

        {/* Low Stock Alert */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Low Stock Alert</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {metrics.lowStockCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Below alert threshold</p>
        </div>

        {/* Out of Stock */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Out of Stock</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">
            {metrics.outOfStockCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">0 units available</p>
        </div>

        {/* Total Showroom Units */}
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Units on Hand</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {metrics.totalUnitsInStock}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across {metrics.totalProducts} products</p>
        </div>
      </div>

      {/* INVENTORY TABLE & FILTERS */}
      <InventoryListTable
        items={items}
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
        stockStatus={stockStatus}
        onStockStatusChange={(val) => {
          setStockStatus(val);
          setCurrentPage(1);
        }}
        onClearFilters={handleClearFilters}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onManageInventory={handleManageInventory}
        onQuickAddStock={handleQuickAddStock}
        onQuickRecordSale={handleQuickRecordSale}
      />

      {/* INVENTORY DETAIL / HISTORY MODAL */}
      <InventoryDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        productId={selectedProductId}
        onInventoryChanged={fetchInventory}
      />

      {/* QUICK STOCK OPERATION MODAL */}
      <StockOperationModal
        isOpen={isQuickOpModalOpen}
        onClose={() => setIsQuickOpModalOpen(false)}
        product={quickOpProduct}
        currentStock={quickOpProduct ? quickOpProduct.quantity : 0}
        initialType={quickOpType}
        onSuccess={handleOperationSuccess}
      />
    </div>
  );
}
