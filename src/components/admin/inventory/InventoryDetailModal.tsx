"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  PackagePlus,
  ShoppingCart,
  ShieldAlert,
  RotateCcw,
  Sliders,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Tag,
  RefreshCw,
  Clock,
  User,
} from "lucide-react";
import {
  InventoryMovementType,
  InventoryDetailView,
  MOVEMENT_TYPE_LABELS,
  STOCK_STATUS_LABELS,
} from "@/types";
import { StockOperationModal } from "./StockOperationModal";
import { ThresholdModal } from "./ThresholdModal";

interface InventoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  onInventoryChanged: () => void;
}

export function InventoryDetailModal({
  isOpen,
  onClose,
  productId,
  onInventoryChanged,
}: InventoryDetailModalProps) {
  const [detail, setDetail] = useState<InventoryDetailView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-modal states
  const [operationModalOpen, setOperationModalOpen] = useState(false);
  const [operationType, setOperationType] = useState<InventoryMovementType>(InventoryMovementType.PURCHASE);
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!productId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/inventory/${productId}`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to load inventory details.");
      }
      setDetail(json.data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load inventory data.");
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (isOpen && productId) {
      fetchDetail();
    }
  }, [isOpen, productId, fetchDetail]);

  const handleOpenOperation = (type: InventoryMovementType) => {
    setOperationType(type);
    setOperationModalOpen(true);
  };

  const handleOperationSuccess = () => {
    fetchDetail();
    onInventoryChanged();
  };

  const handleThresholdSuccess = () => {
    fetchDetail();
    onInventoryChanged();
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Inventory & Stock Management"
        description={detail ? `Stock control and movement history for ${detail.product.name}` : "Loading product..."}
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {loading && !detail ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
              <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span>Loading inventory details...</span>
            </div>
          ) : detail ? (
            <>
              {/* Product Header & Overview Card */}
              <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span>{detail.product.brand.name}</span>
                      <span>&bull;</span>
                      <span>{detail.product.category.name}</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-0.5">
                      {detail.product.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs font-mono text-muted-foreground">
                      <span>SKU: <strong className="text-foreground">{detail.product.sku}</strong></span>
                      {detail.product.modelNumber && (
                        <span>Model: <strong className="text-foreground">{detail.product.modelNumber}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Stock Status Pill */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                        Stock Status
                      </span>
                      <div className="mt-0.5">
                        {detail.inventory.stockStatus === "IN_STOCK" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>In Stock</span>
                          </span>
                        )}
                        {detail.inventory.stockStatus === "LOW_STOCK" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Low Stock Alert</span>
                          </span>
                        )}
                        {detail.inventory.stockStatus === "OUT_OF_STOCK" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Out of Stock</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Stat Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60">
                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Current Units in Stock
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {detail.inventory.quantity}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        Low Stock Alert Level
                      </span>
                      <span className="text-2xl font-bold text-foreground">
                        {detail.inventory.lowStockThreshold}
                      </span>
                    </div>
                    <button
                      onClick={() => setThresholdModalOpen(true)}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 border border-primary/20 transition"
                    >
                      Change
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Retail Pricing
                    </span>
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground">MRP: </span>
                      <strong className="text-foreground">₹{detail.product.mrp.toLocaleString("en-IN")}</strong>
                      {detail.product.sellingPrice && (
                        <div className="text-emerald-400 font-semibold">
                          Offer: ₹{detail.product.sellingPrice.toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Quick Stock Operations
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleOpenOperation(InventoryMovementType.PURCHASE)}
                    className="p-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Add Stock</span>
                  </button>

                  <button
                    onClick={() => handleOpenOperation(InventoryMovementType.SALE)}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Record Sale</span>
                  </button>

                  <button
                    onClick={() => handleOpenOperation(InventoryMovementType.DAMAGED)}
                    className="p-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Damaged</span>
                  </button>

                  <button
                    onClick={() => handleOpenOperation(InventoryMovementType.RETURN)}
                    className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Customer Return</span>
                  </button>

                  <button
                    onClick={() => handleOpenOperation(InventoryMovementType.ADJUSTMENT)}
                    className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Adjustment</span>
                  </button>
                </div>
              </div>

              {/* Movement History / Audit Log */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Stock Movement History ({detail.movements.length})
                    </h4>
                  </div>
                  <button
                    onClick={fetchDetail}
                    disabled={loading}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition"
                    title="Refresh History"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {detail.movements.length === 0 ? (
                  <div className="p-8 rounded-xl bg-muted/20 border border-border text-center text-xs text-muted-foreground">
                    No stock movements recorded for this product yet.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-muted/40 sticky top-0 border-b border-border text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Date & Time</th>
                            <th className="py-2.5 px-3">Operation</th>
                            <th className="py-2.5 px-3 text-right">Change</th>
                            <th className="py-2.5 px-3">Note / Reason</th>
                            <th className="py-2.5 px-3">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {detail.movements.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-muted-foreground/70" />
                                  <span>{new Date(m.createdAt).toLocaleString("en-IN")}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {m.movementType === InventoryMovementType.PURCHASE && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                    <PackagePlus className="w-3 h-3" />
                                    <span>Purchase</span>
                                  </span>
                                )}
                                {m.movementType === InventoryMovementType.SALE && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <ShoppingCart className="w-3 h-3" />
                                    <span>Sale</span>
                                  </span>
                                )}
                                {m.movementType === InventoryMovementType.DAMAGED && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <ShieldAlert className="w-3 h-3" />
                                    <span>Damaged</span>
                                  </span>
                                )}
                                {m.movementType === InventoryMovementType.RETURN && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Customer Return</span>
                                  </span>
                                )}
                                {m.movementType === InventoryMovementType.ADJUSTMENT && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <Sliders className="w-3 h-3" />
                                    <span>Adjustment</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                                <span className={m.quantity > 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`} units
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate">
                                {m.note || "—"}
                              </td>

                              <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground/60" />
                                  <span>{m.createdByName || "Admin"}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* Close button */}
          <div className="pt-4 border-t border-border flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Stock Operation Sub-modal */}
      {detail && (
        <StockOperationModal
          isOpen={operationModalOpen}
          onClose={() => setOperationModalOpen(false)}
          product={detail.product}
          currentStock={detail.inventory.quantity}
          initialType={operationType}
          onSuccess={handleOperationSuccess}
        />
      )}

      {/* Threshold Sub-modal */}
      {detail && (
        <ThresholdModal
          isOpen={thresholdModalOpen}
          onClose={() => setThresholdModalOpen(false)}
          product={detail.product}
          currentThreshold={detail.inventory.lowStockThreshold}
          onSuccess={handleThresholdSuccess}
        />
      )}
    </>
  );
}
