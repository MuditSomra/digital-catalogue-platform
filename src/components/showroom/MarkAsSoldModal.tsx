"use client";

import React, { useState } from "react";
import {
  ShoppingBag,
  Lock,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Minus,
  Plus,
} from "lucide-react";
import type { CatalogueProductItem } from "@/types";

interface MarkAsSoldModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CatalogueProductItem;
  onSuccess: (newStock: number, stockStatus: string) => void;
}

export function MarkAsSoldModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: MarkAsSoldModalProps) {
  const [pin, setPin] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const availableStock = product.inventory.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!/^\d{4}$/.test(pin)) {
      setError("Please enter your 4-digit owner PIN.");
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be at least 1 unit.");
      return;
    }

    if (quantity > availableStock) {
      setError(`Cannot sell ${quantity} units. Only ${availableStock} units available in stock.`);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/showroom/mark-as-sold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          pin,
          note: note.trim() || "Sold via Showroom Demo",
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccessMsg(json.data.message);
        onSuccess(json.data.product.newQuantity, json.data.product.stockStatus);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(json.error?.message || "Failed to mark product as sold.");
      }
    } catch {
      setError("Network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150 text-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Mark Product as Sold</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Record an in-person showroom sale and deduct stock immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Snapshot */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
          {product.primaryImage ? (
            <img
              src={product.primaryImage.url}
              alt={product.name}
              className="w-12 h-12 object-contain bg-white rounded-lg p-1 border border-slate-200"
            />
          ) : (
            <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-xs">
              📦
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">{product.name}</div>
            <div className="text-[11px] text-slate-500">
              Brand: <strong>{product.brand.name}</strong> &bull; Current Stock:{" "}
              <strong className={availableStock > 0 ? "text-emerald-600" : "text-rose-600"}>
                {availableStock} units
              </strong>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quantity Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Quantity Sold <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="p-2.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={availableStock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(availableStock, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 text-center font-bold text-sm bg-transparent text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                  disabled={quantity >= availableStock}
                  className="p-2.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs text-slate-500">
                (Remaining after sale: {Math.max(0, availableStock - quantity)})
              </span>
            </div>
          </div>

          {/* Owner PIN Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Owner Authorization PIN</span>
              <span className="text-[10px] text-slate-400 font-normal">4-digit security code</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Enter 4-digit PIN"
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                required
              />
            </div>
          </div>

          {/* Note Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Sale Note <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Customer Walk-in, Showroom Demo Floor"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || availableStock <= 0 || pin.length !== 4}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition shadow-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Sale</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
