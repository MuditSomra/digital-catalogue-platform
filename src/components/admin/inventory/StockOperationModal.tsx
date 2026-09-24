"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  PackagePlus,
  ShoppingCart,
  ShieldAlert,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  InventoryMovementType,
  InventoryListItem,
  InventoryDetailView,
  MOVEMENT_TYPE_LABELS,
  STOCK_STATUS_LABELS,
} from "@/types";

interface StockOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryListItem | InventoryDetailView["product"] | null;
  currentStock: number;
  initialType?: InventoryMovementType;
  onSuccess: () => void;
}

export function StockOperationModal({
  isOpen,
  onClose,
  product,
  currentStock,
  initialType = InventoryMovementType.PURCHASE,
  onSuccess,
}: StockOperationModalProps) {
  const [movementType, setMovementType] = useState<InventoryMovementType>(initialType);
  const [quantity, setQuantity] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMovementType(initialType);
      setQuantity("");
      setNote("");
      setError(null);
    }
  }, [isOpen, initialType]);

  // Real-time calculation of new stock preview and validation
  const preview = useMemo(() => {
    const rawQty = parseFloat(quantity);
    if (isNaN(rawQty) || quantity.trim() === "") {
      return { isValid: false, newStock: currentStock, message: null };
    }

    if (movementType === InventoryMovementType.PURCHASE) {
      if (rawQty <= 0) return { isValid: false, newStock: currentStock, message: "Quantity must be greater than 0" };
      return { isValid: true, newStock: currentStock + rawQty, delta: `+${rawQty}` };
    }

    if (movementType === InventoryMovementType.SALE) {
      if (rawQty <= 0) return { isValid: false, newStock: currentStock, message: "Quantity must be greater than 0" };
      if (rawQty > currentStock) {
        return {
          isValid: false,
          newStock: currentStock - rawQty,
          message: `Not enough stock available. Available stock is ${currentStock} units.`,
        };
      }
      return { isValid: true, newStock: currentStock - rawQty, delta: `-${rawQty}` };
    }

    if (movementType === InventoryMovementType.DAMAGED) {
      if (rawQty <= 0) return { isValid: false, newStock: currentStock, message: "Quantity must be greater than 0" };
      if (rawQty > currentStock) {
        return {
          isValid: false,
          newStock: currentStock - rawQty,
          message: `Damaged quantity cannot exceed current available stock (${currentStock}).`,
        };
      }
      return { isValid: true, newStock: currentStock - rawQty, delta: `-${rawQty}` };
    }

    if (movementType === InventoryMovementType.RETURN) {
      if (rawQty <= 0) return { isValid: false, newStock: currentStock, message: "Quantity must be greater than 0" };
      return { isValid: true, newStock: currentStock + rawQty, delta: `+${rawQty}` };
    }

    if (movementType === InventoryMovementType.ADJUSTMENT) {
      if (rawQty === 0) return { isValid: false, newStock: currentStock, message: "Adjustment quantity cannot be 0" };
      const resulting = currentStock + rawQty;
      if (resulting < 0) {
        return {
          isValid: false,
          newStock: resulting,
          message: `Adjustment cannot result in negative stock. Available is ${currentStock}.`,
        };
      }
      return {
        isValid: true,
        newStock: resulting,
        delta: rawQty > 0 ? `+${rawQty}` : `${rawQty}`,
      };
    }

    return { isValid: false, newStock: currentStock, message: null };
  }, [movementType, quantity, currentStock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (!preview.isValid) {
      setError(preview.message || "Please enter a valid quantity.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const parsedQty = parseFloat(quantity);
      const targetProductId =
        "productId" in product && (product as any).productId
          ? (product as any).productId
          : product.id;

      const res = await fetch("/api/admin/inventory/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: targetProductId,
          movementType,
          quantity: parsedQty,
          note: note.trim() || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to record stock movement.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to record stock movement. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const productName = "name" in product ? product.name : (product as any).productName;
  const productSku = product.sku;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stock Operation"
      description={`Record inventory transaction for ${productName}.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{error}</div>
          </div>
        )}

        {/* Product Overview Summary */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-foreground">{productName}</div>
            <div className="text-[11px] text-muted-foreground font-mono">SKU: {productSku}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Current Stock
            </span>
            <span className="text-sm font-bold text-foreground">
              {currentStock} units
            </span>
          </div>
        </div>

        {/* Operation Type Tabs */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Operation Type <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMovementType(InventoryMovementType.PURCHASE)}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-2 ${
                movementType === InventoryMovementType.PURCHASE
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <PackagePlus className="w-4 h-4 shrink-0" />
              <span>Add Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType(InventoryMovementType.SALE)}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-2 ${
                movementType === InventoryMovementType.SALE
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>Record Sale</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType(InventoryMovementType.DAMAGED)}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-2 ${
                movementType === InventoryMovementType.DAMAGED
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Damaged</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType(InventoryMovementType.RETURN)}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-2 ${
                movementType === InventoryMovementType.RETURN
                  ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Customer Return</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType(InventoryMovementType.ADJUSTMENT)}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-2 sm:col-span-2 ${
                movementType === InventoryMovementType.ADJUSTMENT
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span>Stock Adjustment (+/-)</span>
            </button>
          </div>
        </div>

        {/* Quantity Input & Calculation Preview */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Quantity <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={
                movementType === InventoryMovementType.ADJUSTMENT
                  ? "e.g. +5 or -2"
                  : "e.g. 10"
              }
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/50"
              required
              autoFocus
            />
            {movementType === InventoryMovementType.ADJUSTMENT && (
              <p className="text-[11px] text-muted-foreground">
                Enter a positive number to add stock, or a negative number (e.g. -3) to deduct stock.
              </p>
            )}
          </div>

          {/* Real-time Result Preview */}
          {quantity.trim() !== "" && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                preview.isValid
                  ? "bg-primary/10 border-primary/20 text-foreground"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-300"
              }`}
            >
              {preview.isValid ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Stock Change:</span>
                  <span className="font-semibold">{currentStock}</span>
                  <span className="font-bold text-primary">{preview.delta}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>
                    New Stock: <strong className="text-foreground text-sm">{preview.newStock} units</strong>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{preview.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Note / Reason */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Note / Reason{" "}
            <span className="text-[11px] font-normal text-muted-foreground">
              (Optional audit note)
            </span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              movementType === InventoryMovementType.PURCHASE
                ? "e.g. New stock received from distributor"
                : movementType === InventoryMovementType.SALE
                ? "e.g. In-store showroom walk-in sale"
                : movementType === InventoryMovementType.DAMAGED
                ? "e.g. Glass chipped during transit"
                : movementType === InventoryMovementType.RETURN
                ? "e.g. Unopened box returned by customer"
                : "e.g. Physical inventory count correction"
            }
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Form Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !preview.isValid}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>
              {movementType === InventoryMovementType.PURCHASE && "Add Stock"}
              {movementType === InventoryMovementType.SALE && "Record Sale"}
              {movementType === InventoryMovementType.DAMAGED && "Record Damaged"}
              {movementType === InventoryMovementType.RETURN && "Record Return"}
              {movementType === InventoryMovementType.ADJUSTMENT && "Apply Adjustment"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
