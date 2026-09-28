"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { AlertTriangle, Trash2, Building2 } from "lucide-react";
import type { SupplierQuotationItem } from "@/types";

interface QuotationDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  quotation: SupplierQuotationItem | null;
}

export function QuotationDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  quotation,
}: QuotationDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quotation) return null;

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete quotation.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Supplier Quotation"
      description="Confirm deletion of this price quote from supplier comparison records."
      maxWidth="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            <span>{quotation.supplierName}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
            <span>Quoted Price:</span>
            <span className="font-bold text-foreground">
              ₹{quotation.quotedPrice.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Date:</span>
            <span>{new Date(quotation.quotationDate).toLocaleDateString("en-IN")}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            This will remove this quotation from purchasing comparison. <strong>Product inventory and stock levels remain completely unchanged.</strong>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{loading ? "Deleting..." : "Delete Quotation"}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
