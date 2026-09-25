"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { ProductMediaManager } from "./ProductMediaManager";
import type { ProductListItem, ProductAdminDetailView } from "@/types";

interface ProductMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductListItem | ProductAdminDetailView | null;
  onMediaChanged?: () => void;
}

export function ProductMediaModal({
  isOpen,
  onClose,
  product,
  onMediaChanged,
}: ProductMediaModalProps) {
  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Product Media"
      description={`Upload and manage gallery images and video demos for ${product.name}.`}
      maxWidth="3xl"
    >
      <div className="space-y-4">
        <ProductMediaManager
          productId={product.id}
          productName={product.name}
          onMediaChanged={onMediaChanged}
        />

        <div className="pt-4 border-t border-border flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
