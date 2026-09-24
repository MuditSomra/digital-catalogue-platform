"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  itemName: string;
  itemType: "category" | "specification" | "option";
  warningMessage?: string | null;
  childCount?: number;
  productCount?: number;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType,
  warningMessage,
  childCount = 0,
  productCount = 0,
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBlocked = childCount > 0 || productCount > 0;

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
        setError("Failed to delete item.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={`Confirm removal of ${itemType} "${itemName}".`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Error banner if action failed */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Blocking warnings */}
        {isBlocked ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cannot Delete This {itemType === "category" ? "Category" : "Item"}</span>
            </div>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              {childCount > 0 && productCount > 0
                ? `This category contains ${childCount} subcategory(ies) and ${productCount} product(s).`
                : childCount > 0
                ? `This category contains ${childCount} subcategory(ies).`
                : `This category is assigned to ${productCount} product(s).`}
            </p>
            <p className="text-[11px] text-amber-400/80">
              To keep your catalogue safe, please move or delete the dependent items first.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 space-y-2 text-xs">
            <div className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to delete &quot;{itemName}&quot;?</span>
            </div>
            <p className="text-rose-300/80 leading-relaxed text-[11px]">
              {warningMessage ||
                `This action cannot be undone. All settings for "${itemName}" will be permanently removed.`}
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            {isBlocked ? "Close" : "Cancel"}
          </button>

          {!isBlocked && (
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
          )}
        </div>
      </div>
    </Modal>
  );
}
