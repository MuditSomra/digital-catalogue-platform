"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  DollarSign,
  Building2,
  Calendar,
  Clock,
  Boxes,
  FileText,
  AlertCircle,
  TrendingUp,
  Percent,
} from "lucide-react";
import type { SupplierQuotationItem } from "@/types";

interface QuotationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    productId: string;
    supplierName: string;
    quotedPrice: number;
    quotationDate: string;
    validUntil?: string | null;
    moq?: number | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }) => Promise<void>;
  quotationToEdit?: SupplierQuotationItem | null;
  preselectedProductId?: string | null;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    mrp: number;
    sellingPrice: number | null;
    brand?: { name: string } | null;
  }>;
}

export function QuotationFormModal({
  isOpen,
  onClose,
  onSave,
  quotationToEdit,
  preselectedProductId,
  products,
}: QuotationFormModalProps) {
  const isEditing = Boolean(quotationToEdit);

  // Form State
  const [productId, setProductId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [quotationDate, setQuotationDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [moq, setMoq] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset/Initialize state on modal open
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }

    if (quotationToEdit) {
      setProductId(quotationToEdit.productId);
      setSupplierName(quotationToEdit.supplierName);
      setQuotedPrice(String(quotationToEdit.quotedPrice));
      setQuotationDate(
        quotationToEdit.quotationDate
          ? new Date(quotationToEdit.quotationDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setValidUntil(
        quotationToEdit.validUntil
          ? new Date(quotationToEdit.validUntil).toISOString().split("T")[0]
          : ""
      );
      setMoq(quotationToEdit.moq ? String(quotationToEdit.moq) : "");
      setLeadTimeDays(
        quotationToEdit.leadTimeDays ? String(quotationToEdit.leadTimeDays) : ""
      );
      setNotes(quotationToEdit.notes || "");
    } else {
      setProductId(preselectedProductId || (Array.isArray(products) && products.length > 0 ? products[0].id : ""));
      setSupplierName("");
      setQuotedPrice("");
      setQuotationDate(new Date().toISOString().split("T")[0]);
      setValidUntil("");
      setMoq("");
      setLeadTimeDays("");
      setNotes("");
    }
    setError(null);
  }, [isOpen, quotationToEdit, preselectedProductId, products]);

  // Selected product details
  const selectedProduct = Array.isArray(products) ? products.find((p) => p.id === productId) : undefined;

  // Live Margin Calculation vs MRP & Selling Price
  const marginInfo = React.useMemo(() => {
    const quoteNum = parseFloat(quotedPrice);
    if (isNaN(quoteNum) || quoteNum <= 0 || !selectedProduct) return null;

    const basePrice = selectedProduct.sellingPrice || selectedProduct.mrp;
    const profit = basePrice - quoteNum;
    const marginPercent = ((profit / basePrice) * 100);

    return {
      profit,
      marginPercent: Math.round(marginPercent * 10) / 10,
      isPositive: profit > 0,
      basePrice,
    };
  }, [quotedPrice, selectedProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError("Please select a product for this quotation.");
      return;
    }
    if (!supplierName.trim()) {
      setError("Please enter the supplier or distributor name.");
      return;
    }
    const numPrice = parseFloat(quotedPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Please enter a valid quoted purchase price greater than ₹0.");
      return;
    }
    if (!quotationDate) {
      setError("Please specify the quotation date.");
      return;
    }

    try {
      setLoading(true);
      await onSave({
        id: quotationToEdit?.id,
        productId,
        supplierName: supplierName.trim(),
        quotedPrice: numPrice,
        quotationDate: new Date(quotationDate).toISOString(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        moq: moq.trim() ? parseInt(moq, 10) : null,
        leadTimeDays: leadTimeDays.trim() ? parseInt(leadTimeDays, 10) : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save supplier quotation.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Supplier Quotation" : "Add Supplier Quotation"}
      description={
        isEditing
          ? "Update price quote, supplier information, and delivery terms."
          : "Record a new supplier purchase quote for comparison. Quotations do not modify inventory."
      }
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{error}</div>
          </div>
        )}

        {/* Product Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Product <span className="text-rose-400">*</span>
          </label>
          {preselectedProductId && quotationToEdit ? (
            <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-foreground font-medium flex items-center justify-between">
              <span>{selectedProduct?.name || "Selected Product"}</span>
              <span className="font-mono text-muted-foreground">{selectedProduct?.sku}</span>
            </div>
          ) : (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={Boolean(preselectedProductId)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition disabled:opacity-75"
              required
            >
              <option value="" disabled>
                Select appliance...
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand ? `[${p.brand.name}] ` : ""}
                  {p.name} ({p.sku}) — MRP: ₹{p.mrp.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Supplier Name & Quoted Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Supplier / Seller Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Metro Kitchenware Wholesalers"
                className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Quoted Purchase Price (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
                placeholder="e.g. 4800"
                className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                required
              />
            </div>
          </div>
        </div>

        {/* Real-time Estimated Margin Card */}
        {marginInfo && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
              marginInfo.isPositive
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/25 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span>Estimated Gross Margin: </span>
                <strong className="text-emerald-200 text-sm font-bold">
                  {marginInfo.marginPercent}%
                </strong>
                <span className="text-[11px] text-muted-foreground ml-1">
                  (vs ₹{marginInfo.basePrice.toLocaleString("en-IN")} Selling/MRP)
                </span>
              </div>
            </div>
            <div className="font-semibold text-right">
              Profit / Unit: ₹{marginInfo.profit.toLocaleString("en-IN")}
            </div>
          </div>
        )}

        {/* Quotation Date & Valid Until */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Quotation Date <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Quote Valid Until <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              />
            </div>
          </div>
        </div>

        {/* MOQ & Lead Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Minimum Order Qty (MOQ) <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Boxes className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                min="1"
                step="1"
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                placeholder="e.g. 5 units"
                className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Lead Time (Days) <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                min="0"
                step="1"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                placeholder="e.g. 3 days"
                className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Quotation Notes & Payment Terms <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Price includes freight delivery; 30-day payment term; 5% extra discount on bulk orders > 10 units"
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60 resize-none"
            />
          </div>
        </div>

        {/* Inventory Safety Notice */}
        <div className="p-3 bg-muted/40 border border-border rounded-xl text-[11px] text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          <span>
            <strong>Inventory Safety:</strong> Saving or editing a supplier quotation records pricing intel only. It will not change stock counts or create stock movements.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? "Saving..." : isEditing ? "Update Quotation" : "Save Quotation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
