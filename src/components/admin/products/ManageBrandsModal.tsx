"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  Tag,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Search,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { BrandOption } from "@/types";

interface ManageBrandsModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: BrandOption[];
  onBrandDeleted: (deletedBrandId: string) => void;
}

export function ManageBrandsModal({
  isOpen,
  onClose,
  brands: initialBrands,
  onBrandDeleted,
}: ManageBrandsModalProps) {
  const [brandsList, setBrandsList] = useState<BrandOption[]>(initialBrands);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<BrandOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync with initialBrands prop
  useEffect(() => {
    setBrandsList(initialBrands);
  }, [initialBrands]);

  // Fetch fresh brands with product counts whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setBrandToDelete(null);
      setError(null);
      setSuccessMessage(null);
      setSearchQuery("");
      fetchBrands();
    }
  }, [isOpen]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/brands");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBrandsList(json.data);
      }
    } catch {
      // Fallback to initialBrands
      setBrandsList(initialBrands);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return;

    try {
      setDeletingId(brandToDelete.id);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/admin/brands?id=${brandToDelete.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete brand.");
      }

      const deletedId = brandToDelete.id;
      const deletedName = brandToDelete.name;

      // Update local state immediately
      setBrandsList((prev) => prev.filter((b) => b.id !== deletedId));
      setBrandToDelete(null);
      setSuccessMessage(`Brand "${deletedName}" was successfully deleted.`);

      // Notify parent to update form and catalog state
      onBrandDeleted(deletedId);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while deleting the brand.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBrands = brandsList.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!deletingId) {
          onClose();
        }
      }}
      title="Manage Brands"
      description="View registered brands and safely delete unused brands with zero associated products."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Error notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed flex-1">{error}</div>
          </div>
        )}

        {/* Success notification */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Delete Confirmation Box */}
        {brandToDelete && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-foreground">
                  Permanently delete &ldquo;{brandToDelete.name}&rdquo;?
                </div>
                <div className="text-muted-foreground leading-relaxed">
                  This brand has 0 associated products and can be safely deleted. This action cannot be undone.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/15">
              <button
                type="button"
                onClick={() => setBrandToDelete(null)}
                disabled={Boolean(deletingId)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingId)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingId ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter brands by name..."
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            type="button"
            onClick={fetchBrands}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition shrink-0"
            title="Refresh brand list"
            aria-label="Refresh brand list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Brands List */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
          {loading && brandsList.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block mr-2 align-middle" />
              Loading brands...
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {searchQuery ? "No matching brands found." : "No brands registered yet."}
            </div>
          ) : (
            filteredBrands.map((brand) => {
              const productCount = brand._count?.products ?? 0;
              const canDelete = productCount === 0;

              return (
                <div
                  key={brand.id}
                  className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between gap-3 hover:border-border transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                        {brand.name}
                      </span>
                    </div>
                    {brand.description && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 pl-5.5">
                        {brand.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {/* Product Count Badge */}
                    {productCount > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                        {productCount} {productCount === 1 ? "product" : "products"}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                        0 products
                      </span>
                    )}

                    {/* Delete Icon Button (Only for zero-product brands) */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setSuccessMessage(null);
                          setBrandToDelete(brand);
                        }}
                        disabled={Boolean(deletingId)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
                        title={`Delete unused brand "${brand.name}"`}
                        aria-label={`Delete unused brand "${brand.name}"`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {brandsList.length} {brandsList.length === 1 ? "brand" : "brands"} total
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(deletingId)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
