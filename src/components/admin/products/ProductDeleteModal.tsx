"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import type { ProductListItem } from "@/types";

interface ProductDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  product: ProductListItem | null;
}

export function ProductDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  product,
}: ProductDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete product. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Product"
      description={`Confirm removal of product from catalogue.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Error banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Product summary card */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1.5 text-xs">
          <div className="font-semibold text-foreground text-sm">{product.name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            {product.brand && <span>Brand: <strong className="text-foreground">{product.brand.name}</strong></span>}
            <span>Category: <strong className="text-foreground">{product.category.name}</strong></span>
            {product.sku && <span>SKU: <strong className="text-foreground">{product.sku}</strong></span>}
            <span>MRP: <strong className="text-foreground">₹{product.mrp.toLocaleString("en-IN")}</strong></span>
          </div>
        </div>

        {/* Advisory Warning */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Consider Deactivating Instead</span>
          </div>
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            If this item is temporarily out of stock or discontinued, you can simply toggle its status to <strong>Inactive</strong> to hide it without losing its historical details.
          </p>
        </div>

        {/* Danger Warning */}
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 space-y-1.5 text-xs">
          <div className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Permanent Removal</span>
          </div>
          <p className="text-rose-300/80 leading-relaxed text-[11px]">
            This action will remove &quot;{product.name}&quot; and all its dynamic specification values from the catalogue.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
