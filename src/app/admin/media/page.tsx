"use client";

import React from "react";
import { ProductMediaManager } from "@/components/admin/products/ProductMediaManager";
import { Image as ImageIcon, Sparkles } from "lucide-react";

export default function AdminMediaGalleryPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phase 5 • Media Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span>Product Media Gallery</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Take live appliance photos with your camera, upload high-res images, set primary covers, and embed YouTube demo videos for your showroom catalogue.
          </p>
        </div>
      </div>

      {/* Main Standalone Product Media Manager */}
      <div className="p-4 sm:p-6 bg-card border border-border rounded-2xl shadow-xs">
        <ProductMediaManager allowProductSelection={true} />
      </div>
    </div>
  );
}
