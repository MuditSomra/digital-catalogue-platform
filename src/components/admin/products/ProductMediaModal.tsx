"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { ProductMediaManager } from "./ProductMediaManager";
import type { ProductListItem, ProductAdminDetailView } from "@/types";

interface ProductMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductListItem | ProductAdminDetailView | null;
  onMediaChanged?: () => void;
}

export function ProductMediaModal({
  isOpen,
  onClose,
  product,
  onMediaChanged,
}: ProductMediaModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product Photo & Media Manager"
      description={
        product
          ? `Add photos via camera or file upload, and arrange gallery for ${product.name}.`
          : "Find a product, take photos with camera or upload files, and save to catalogue."
      }
      maxWidth="3xl"
    >
      <div className="space-y-4">
        <ProductMediaManager
          productId={product?.id || null}
          productName={product?.name || ""}
          productSku={product?.sku || ""}
          productBrand={product?.brand?.name || ""}
          onMediaChanged={onMediaChanged}
          allowProductSelection={true}
        />

        <div className="pt-4 border-t border-border flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
