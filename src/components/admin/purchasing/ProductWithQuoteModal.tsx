"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  Package,
  Building2,
  DollarSign,
  Calendar,
  Layers,
  Plus,
  AlertCircle,
  TrendingUp,
  Boxes,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import type {
  BrandOption,
  CategoryTreeNode,
  FlatCategoryOption,
} from "@/types";
import { BrandModal } from "../products/BrandModal";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";

interface ProductWithQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    // Product details
    name: string;
    brandId: string;
    categoryId: string;
    additionalCategoryIds?: string[];
    sku: string;
    modelNumber?: string | null;
    description?: string | null;
    mrp: number;
    sellingPrice?: number | null;
    warranty?: string | null;
    isActive?: boolean;
    // Initial Quotation details
    supplierName: string;
    quotedPrice: number;
    quotationDate: string;
    validUntil?: string | null;
    moq?: number | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }) => Promise<void>;
  categories: CategoryTreeNode[] | FlatCategoryOption[] | any[];
  brands: BrandOption[];
  onBrandCreated: (newBrand: BrandOption) => void;
}

export function ProductWithQuoteModal({
  isOpen,
  onClose,
  onSave,
  categories,
  brands,
  onBrandCreated,
}: ProductWithQuoteModalProps) {
  // Product Fields
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>([]);
  const [sku, setSku] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [description, setDescription] = useState("");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [warranty, setWarranty] = useState("1 Year Comprehensive");
  const [isActive, setIsActive] = useState(true);

  // Initial Quotation Fields
  const [supplierName, setSupplierName] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [quotationDate, setQuotationDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [moq, setMoq] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");

  // Sub-modal for inline brand creation
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten categories list for additional category checkboxes
  const flatCategoryList = useMemo(() => {
    const list: Array<{ id: string; name: string }> = [];
    function flatten(nodes: any[]) {
      if (!nodes || !Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (!n || !n.id) continue;
        list.push({ id: n.id, name: n.name });
        if (n.children && Array.isArray(n.children)) {
          flatten(n.children);
        }
      }
    }
    if (Array.isArray(categories)) {
      flatten(categories);
    }
    return list;
  }, [categories]);

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }
    setName("");
    setBrandId(Array.isArray(brands) && brands.length > 0 ? brands[0].id : "");
    setCategoryId(Array.isArray(categories) && categories.length > 0 ? categories[0].id : "");
    setAdditionalCategoryIds([]);
    setSku("");
    setModelNumber("");
    setDescription("");
    setMrp("");
    setSellingPrice("");
    setWarranty("1 Year Comprehensive");
    setIsActive(true);

    setSupplierName("");
    setQuotedPrice("");
    setQuotationDate(new Date().toISOString().split("T")[0]);
    setValidUntil("");
    setMoq("");
    setLeadTimeDays("");
    setNotes("");
    setError(null);
  }, [isOpen, brands, categories]);

  // Live estimated margin
  const marginInfo = useMemo(() => {
    const numMrp = parseFloat(mrp);
    const numSelling = parseFloat(sellingPrice) || numMrp;
    const numQuote = parseFloat(quotedPrice);

    if (isNaN(numQuote) || numQuote <= 0 || isNaN(numSelling) || numSelling <= 0) return null;

    const profit = numSelling - numQuote;
    const marginPercent = ((profit / numSelling) * 100);

    return {
      profit,
      marginPercent: Math.round(marginPercent * 10) / 10,
      isPositive: profit > 0,
      basePrice: numSelling,
    };
  }, [mrp, sellingPrice, quotedPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate Product Fields
    if (!name.trim()) {
      setError("Please enter product name.");
      return;
    }
    if (!brandId) {
      setError("Please select a brand.");
      return;
    }
    if (!categoryId) {
      setError("Please select the primary category.");
      return;
    }
    if (!sku.trim()) {
      setError("Please enter a SKU.");
      return;
    }
    const numMrp = parseFloat(mrp);
    if (isNaN(numMrp) || numMrp <= 0) {
      setError("Please enter a valid MRP greater than ₹0.");
      return;
    }

    let numSelling: number | null = null;
    if (sellingPrice.trim()) {
      numSelling = parseFloat(sellingPrice);
      if (isNaN(numSelling) || numSelling < 0) {
        setError("Please enter a valid selling price.");
        return;
      }
      if (numSelling > numMrp) {
        setError("Selling price cannot be higher than MRP.");
        return;
      }
    }

    // Validate Initial Quotation Fields
    if (!supplierName.trim()) {
      setError("Please enter the initial supplier name.");
      return;
    }
    const numQuote = parseFloat(quotedPrice);
    if (isNaN(numQuote) || numQuote <= 0) {
      setError("Please enter a valid initial quoted purchase price.");
      return;
    }
    if (!quotationDate) {
      setError("Please select the quotation date.");
      return;
    }

    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        brandId,
        categoryId,
        additionalCategoryIds: additionalCategoryIds.filter((id) => id !== categoryId),
        sku: sku.trim().toUpperCase(),
        modelNumber: modelNumber.trim() || null,
        description: description.trim() || null,
        mrp: numMrp,
        sellingPrice: numSelling,
        warranty: warranty.trim() || null,
        isActive,
        supplierName: supplierName.trim(),
        quotedPrice: numQuote,
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
        setError("Failed to create product and supplier quotation.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Add Product & First Supplier Quotation"
        description="Streamlined workflow: create a new showroom appliance and register its initial purchase quote in a single step."
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* SECTION 1: PRODUCT DETAILS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Package className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                1. Product Catalogue Information
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Faber Hood Zenith FL SC AC BK 90cm Auto-Clean Chimney"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  required
                />
              </div>

              {/* Brand */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    Brand <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBrandModalOpen(true)}
                    className="text-[11px] font-semibold text-primary hover:text-primary/80 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Brand</span>
                  </button>
                </div>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  required
                >
                  <option value="" disabled>Select Brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  SKU <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. FBR-ZEN-90-AC"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  required
                />
              </div>

              {/* Primary Category */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Primary Category <span className="text-rose-400">*</span>
                </label>
                <CascadingCategorySelect
                  value={categoryId}
                  onChange={(newId) => setCategoryId(newId || "")}
                  categories={categories}
                  allowRootSelection={false}
                  rootLabel="Select Main Category..."
                  subCategoryPlaceholder="Select Subcategory..."
                  required={true}
                  showPathPreview={true}
                  idPrefix="quote-product-cat"
                />
              </div>

              {/* Additional Categories (Multi-category membership) */}
              {flatCategoryList.length > 1 && (
                <div className="space-y-1.5 md:col-span-2 p-3 bg-muted/20 border border-border rounded-xl">
                  <label className="block text-xs font-semibold text-foreground">
                    Additional Secondary Categories (Multi-Category Support)
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Select any other categories this product belongs to. It will appear under all assigned categories.
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {flatCategoryList
                      .filter((c) => c.id !== categoryId)
                      .map((c) => {
                        const isChecked = additionalCategoryIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition ${
                              isChecked
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-card border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAdditionalCategoryIds((prev) => [...prev, c.id]);
                                } else {
                                  setAdditionalCategoryIds((prev) =>
                                    prev.filter((id) => id !== c.id)
                                  );
                                }
                              }}
                              className="sr-only"
                            />
                            <span>{c.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Model Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Model Number <span className="text-muted-foreground text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  placeholder="e.g. Zenith FL SC AC BK 90"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>

              {/* MRP & Selling Price */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    MRP (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    placeholder="e.g. 24990"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Offer Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="e.g. 19990"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: INITIAL SUPPLIER QUOTATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                2. Initial Supplier Purchase Quotation
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Supplier / Seller Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Faber India Direct / National Distributors"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  required
                />
              </div>

              {/* Quoted Price */}
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
                    placeholder="e.g. 13500"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>
              </div>

              {/* Margin Card */}
              {marginInfo && (
                <div
                  className={`md:col-span-2 p-3 rounded-xl border text-xs flex items-center justify-between ${
                    marginInfo.isPositive
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/25 text-amber-300"
                  }`}
                >
                  <div>
                    <span>Estimated Margin: </span>
                    <strong className="text-emerald-200 text-sm font-bold">
                      {marginInfo.marginPercent}%
                    </strong>
                    <span className="text-[11px] text-muted-foreground ml-1">
                      (₹{marginInfo.profit.toLocaleString("en-IN")} margin per unit)
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Initial quotation recorded for Owner comparison
                  </div>
                </div>
              )}

              {/* Quotation Date & MOQ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Quotation Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Minimum Order Qty (MOQ) <span className="text-muted-foreground text-[11px]">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(e) => setMoq(e.target.value)}
                  placeholder="e.g. 2 units"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Quotation Terms / Notes <span className="text-muted-foreground text-[11px]">(Optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Dealer price including GST and door delivery."
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
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
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Creating..." : "Save Product & Initial Quotation"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Inline Brand Creation Modal */}
      <BrandModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        onBrandCreated={(newBrand) => {
          onBrandCreated(newBrand);
          setBrandId(newBrand.id);
        }}
      />
    </>
  );
}
