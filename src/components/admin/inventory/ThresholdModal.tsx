"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Sliders, CheckCircle2, AlertCircle } from "lucide-react";
import type { InventoryListItem, InventoryDetailView } from "@/types";

interface ThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryListItem | InventoryDetailView["product"] | null;
  currentThreshold: number;
  onSuccess: () => void;
}

export function ThresholdModal({
  isOpen,
  onClose,
  product,
  currentThreshold,
  onSuccess,
}: ThresholdModalProps) {
  const [threshold, setThreshold] = useState<string>(String(currentThreshold));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setThreshold(String(currentThreshold));
      setError(null);
    }
  }, [isOpen, currentThreshold]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const parsed = parseInt(threshold, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError("Please enter a valid non-negative threshold (0 or greater).");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const targetProductId =
        "productId" in product && (product as any).productId
          ? (product as any).productId
          : product.id;

      const res = await fetch(`/api/admin/inventory/${targetProductId}/threshold`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: parsed }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to update threshold.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update low-stock threshold.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const productName = "name" in product ? product.name : (product as any).productName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Low Stock Alert Threshold"
      description={`Set the stock level that triggers a low-stock alert for ${productName}.`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{error}</div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-foreground">
            Low Stock Threshold (Units) <span className="text-rose-400">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            required
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When available units reach or drop below this number, the product will be flagged as <strong>Low Stock</strong>.
          </p>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">Quick presets:</span>
            {[2, 3, 5, 10].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setThreshold(String(val))}
                className={`px-2 py-1 text-xs rounded-lg border transition ${
                  threshold === String(val)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {val} units
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Save Threshold</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
