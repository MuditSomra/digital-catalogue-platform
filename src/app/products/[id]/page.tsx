"use client";

import React, { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Tag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Scale,
  Sparkles,
  ShoppingBag,
  Play,
  Film,
  Package,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Copy,
  Check,
  Box,
  FileText,
  Info,
  Images,
} from "lucide-react";
import { ShowroomHeader } from "@/components/showroom/ShowroomHeader";
import { ProductCard } from "@/components/showroom/ProductCard";
import { PresentationModeModal } from "@/components/showroom/PresentationModeModal";
import { MarkAsSoldModal } from "@/components/showroom/MarkAsSoldModal";
import type { CatalogueProductItem } from "@/types";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<CatalogueProductItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Media State
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeMediaTab, setActiveMediaTab] = useState<"image" | "video">("image");
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  // Accordion Sections State (Product Specifications EXPANDED by default, remaining COLLAPSED)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    specs: true,
    box: false,
    warranty: false,
    additional: false,
    gallery: false,
  });

  // Modals
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [isMarkSoldOpen, setIsMarkSoldOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/catalogue/products/${productId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setProduct(json.data);
          setSelectedImageIndex(0);
          setActiveMediaTab("image");
        } else {
          setError(json.error?.message || "Product not found.");
        }
      } catch {
        setError("Failed to load product details.");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleCopyPriceCode = () => {
    if (product?.privatePriceCode) {
      navigator.clipboard.writeText(product.privatePriceCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleStockUpdate = (newQuantity: number, stockStatus: string) => {
    if (product) {
      setProduct({
        ...product,
        inventory: {
          ...product.inventory,
          quantity: newQuantity,
          stockStatus: stockStatus as any,
        },
      });
    }
  };

  // Image Navigation & Swipe Handlers
  const images = product?.images || [];
  const videos = product?.videos || [];
  const totalImages = images.length;

  const handlePrevImage = () => {
    if (totalImages <= 1) return;
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : totalImages - 1));
    setActiveMediaTab("image");
  };

  const handleNextImage = () => {
    if (totalImages <= 1) return;
    setSelectedImageIndex((prev) => (prev < totalImages - 1 ? prev + 1 : 0));
    setActiveMediaTab("image");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeMediaTab !== "image" || totalImages <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || activeMediaTab !== "image" || totalImages <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartXRef.current - touchEndX;

    // Minimum swipe threshold 40px
    if (diffX > 40) {
      handleNextImage();
    } else if (diffX < -40) {
      handlePrevImage();
    }
    touchStartXRef.current = null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ShowroomHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs text-slate-500 font-medium">Loading appliance details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ShowroomHeader />
        <div className="flex-1 max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Product Unavailable</h2>
          <p className="text-xs text-slate-500">{error || "This product does not exist or has been removed."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Catalogue</span>
          </Link>
        </div>
      </div>
    );
  }

  const activeImage = images[selectedImageIndex] || product.primaryImage;
  const activeVideo = videos[selectedVideoIndex];
  const isOutOfStock = product.inventory.stockStatus === "OUT_OF_STOCK";
  const isLowStock = product.inventory.stockStatus === "LOW_STOCK";
  const similarProducts = product.similarProducts || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <ShowroomHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Breadcrumbs & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-900 font-medium transition">
              Showroom
            </Link>
            {product.category.breadcrumbs?.map((bc) => (
              <React.Fragment key={bc.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <Link
                  href={`/?category=${bc.id}`}
                  className="hover:text-slate-900 font-medium transition"
                >
                  {bc.name}
                </Link>
              </React.Fragment>
            ))}
          </nav>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <Link
              href={`/compare?ids=${product.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-2xs"
            >
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              <span>Compare</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsPresentationOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition shadow-2xs cursor-pointer"
              title="Enter distraction-free full-screen demonstration mode"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Showroom Presentation</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMarkSoldOpen(true)}
              disabled={isOutOfStock}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition shadow-2xs cursor-pointer"
              title="Record an in-person customer sale with PIN authorization"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Mark as Sold</span>
            </button>
          </div>
        </div>

        {/* Hero Product Card (Consistent Fixed-Aspect Image & Primary Info) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Fixed-Dimension Media Box with Touch Swipe & Thumbnails (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Main Image/Video Container with Fixed 4:3 Aspect Ratio */}
            <div
              className="relative w-full aspect-[4/3] bg-slate-50/90 rounded-2xl border border-slate-200/80 overflow-hidden select-none shrink-0"
              style={{ aspectRatio: "4 / 3", width: "100%" }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {activeMediaTab === "image" ? (
                activeImage ? (
                  <img
                    key={activeImage.id || selectedImageIndex}
                    src={activeImage.url}
                    alt={activeImage.altText || product.name}
                    className="absolute inset-0 w-full h-full object-contain p-4 sm:p-6 drop-shadow-sm transition-all duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 p-4 sm:p-6">
                    <Package className="w-16 h-16 stroke-[1.2] text-slate-300" />
                    <span className="text-xs font-medium text-slate-400">No Image Available</span>
                  </div>
                )
              ) : activeVideo ? (
                <div className="absolute inset-0 p-2 sm:p-4 flex items-center justify-center">
                  {activeVideo.youtubeVideoId ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeVideoId}?autoplay=1&controls=1&rel=0`}
                      title={activeVideo.title || "Product Video"}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full rounded-xl border-0 shadow-sm"
                    />
                  ) : (
                    <video src={activeVideo.url} controls autoPlay className="w-full h-full rounded-xl object-contain shadow-sm" />
                  )}
                </div>
              ) : null}

              {/* Image Counter Badge */}
              {activeMediaTab === "image" && totalImages > 1 && (
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/70 text-white text-[11px] font-medium backdrop-blur-xs">
                  {selectedImageIndex + 1} / {totalImages}
                </div>
              )}

              {/* Prev / Next Arrows (Visible for multiple images) */}
              {activeMediaTab === "image" && totalImages > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md border border-slate-200/80 transition cursor-pointer"
                    title="Previous Image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md border border-slate-200/80 transition cursor-pointer"
                    title="Next Image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Fullscreen Icon Button */}
              <button
                type="button"
                onClick={() => setIsPresentationOpen(true)}
                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
                title="Full-screen presentation mode"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Media Thumbnails Strip (Consistent Sizing) */}
            {(images.length > 1 || videos.length > 0) && (
              <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                {/* Images */}
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setActiveMediaTab("image");
                    }}
                    className={`w-16 h-16 sm:w-18 sm:h-18 aspect-square rounded-xl bg-slate-50 p-1.5 border shrink-0 transition overflow-hidden cursor-pointer ${
                      activeMediaTab === "image" && selectedImageIndex === idx
                        ? "border-blue-600 ring-2 ring-blue-100"
                        : "border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100"
                    }`}
                  >
                    <img src={img.url} alt="thumb" className="w-full h-full object-contain" />
                  </button>
                ))}

                {/* Videos */}
                {videos.map((vid, idx) => (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => {
                      setSelectedVideoIndex(idx);
                      setActiveMediaTab("video");
                    }}
                    className={`w-16 h-16 sm:w-18 sm:h-18 aspect-square rounded-xl bg-slate-900 p-1 border shrink-0 transition overflow-hidden relative flex items-center justify-center cursor-pointer ${
                      activeMediaTab === "video" && selectedVideoIndex === idx
                        ? "border-rose-600 ring-2 ring-rose-100"
                        : "border-slate-700 opacity-75 hover:opacity-100"
                    }`}
                  >
                    {vid.thumbnailUrl ? (
                      <img src={vid.thumbnailUrl} alt="video" className="w-full h-full object-cover rounded" />
                    ) : (
                      <Film className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Core Product Overview & Live Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Brand & Stock Status Header */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  {product.brand.name}
                </span>

                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5" /> Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Low Stock ({product.inventory.quantity} units)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> In Stock ({product.inventory.quantity} units)
                  </span>
                )}
              </div>

              {/* Title & Identifiers */}
              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 font-mono">
                  {product.modelNumber && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      Model: {product.modelNumber}
                    </span>
                  )}
                  <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                    SKU: {product.sku}
                  </span>
                </div>
              </div>

              {/* Pricing Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    ₹{(product.sellingPrice ?? product.mrp).toLocaleString("en-IN")}
                  </span>
                  {product.sellingPrice && product.sellingPrice < product.mrp && (
                    <span className="text-sm font-medium text-slate-400 line-through">
                      MRP ₹{product.mrp.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {product.discountPercent !== null && product.discountPercent > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                      {product.discountPercent}% OFF
                    </span>
                  )}

                  {product.privatePriceCode && (
                    <button
                      type="button"
                      onClick={handleCopyPriceCode}
                      className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      title="Click to copy price code"
                    >
                      <span>Code: {product.privatePriceCode}</span>
                      {copiedCode ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  )}

                  {product.warranty && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>{product.warranty}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Product Overview
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPresentationOpen(true)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Showroom Presentation</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMarkSoldOpen(true)}
                disabled={isOutOfStock}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Mark as Sold</span>
              </button>
            </div>
          </div>
        </div>

        {/* Product Information Expandable Dropdown Accordions */}
        <div className="space-y-3 pt-2">
          {/* 1. Product Specifications (EXPANDED by default) */}
          {product.attributeValues.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition">
              <button
                type="button"
                onClick={() => toggleSection("specs")}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-900">Product Specifications</span>
                  <span className="text-xs font-medium text-slate-400">
                    ({product.attributeValues.length})
                  </span>
                </div>
                {openSections.specs ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {openSections.specs && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {product.attributeValues.map((spec) => (
                      <div
                        key={spec.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                      >
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                          {spec.attributeName}
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {spec.value} {spec.unit ? <span className="text-xs text-slate-500 font-normal">({spec.unit})</span> : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. What's in the Box (COLLAPSED by default) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition">
            <button
              type="button"
              onClick={() => toggleSection("box")}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Box className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900">What&apos;s in the Box</span>
              </div>
              {openSections.box ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.box && (
              <div className="px-6 pb-6 pt-2 border-t border-slate-100 text-xs sm:text-sm text-slate-700 space-y-3">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <li className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Main Appliance Unit ({product.name})</span>
                  </li>
                  <li className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>User &amp; Operation Manual</span>
                  </li>
                  <li className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Manufacturer Warranty Registration Card</span>
                  </li>
                  <li className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Standard Installation Hardware &amp; Accessories</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* 3. Warranty Details (COLLAPSED by default) */}
          {product.warranty && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition">
              <button
                type="button"
                onClick={() => toggleSection("warranty")}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-900">Warranty Details</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {product.warranty}
                  </span>
                </div>
                {openSections.warranty ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {openSections.warranty && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 text-xs sm:text-sm text-slate-700 space-y-2 leading-relaxed">
                  <p>
                    This product comes with official <strong>{product.warranty}</strong> manufacturer warranty from <strong>{product.brand.name}</strong>.
                  </p>
                  <p className="text-slate-500">
                    Warranty covers manufacturing defects and functional issues. Please retain the purchase invoice and warranty documentation provided inside the package for authorized brand service support.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4. Additional Details (COLLAPSED by default) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition">
            <button
              type="button"
              onClick={() => toggleSection("additional")}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900">Additional Details</span>
              </div>
              {openSections.additional ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.additional && (
              <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 font-medium block">Brand</span>
                    <span className="font-bold text-slate-900">{product.brand.name}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 font-medium block">Category</span>
                    <span className="font-bold text-slate-900">{product.category.name}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 font-mono">
                    <span className="text-[11px] text-slate-400 font-medium block font-sans">Stock Keeping Unit (SKU)</span>
                    <span className="font-bold text-slate-900">{product.sku}</span>
                  </div>
                  {product.modelNumber && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 font-mono">
                      <span className="text-[11px] text-slate-400 font-medium block font-sans">Model Number</span>
                      <span className="font-bold text-slate-900">{product.modelNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 5. Product Image Gallery (COLLAPSED by default - only shown if multiple media items exist) */}
          {(images.length > 1 || videos.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition">
              <button
                type="button"
                onClick={() => toggleSection("gallery")}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Images className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-900">Product Image &amp; Media Gallery</span>
                  <span className="text-xs font-medium text-slate-400">
                    ({images.length + videos.length} items)
                  </span>
                </div>
                {openSections.gallery ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {openSections.gallery && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        onClick={() => {
                          setSelectedImageIndex(idx);
                          setActiveMediaTab("image");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="aspect-square bg-slate-50 rounded-xl border border-slate-200 p-2 overflow-hidden flex items-center justify-center hover:border-blue-500 cursor-pointer transition group"
                        title="Click to view as main image"
                      >
                        <img
                          src={img.url}
                          alt={img.altText || `Gallery image ${idx + 1}`}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div className="pt-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Similar Appliances
                </h2>
                <p className="text-xs text-slate-500">
                  Handpicked matching models from {product.category.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {similarProducts.map((similar) => (
                <ProductCard
                  key={similar.id}
                  product={similar}
                  canCompare={true}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Presentation Mode Modal */}
      <PresentationModeModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        product={product}
      />

      {/* Mark as Sold Modal */}
      <MarkAsSoldModal
        isOpen={isMarkSoldOpen}
        onClose={() => setIsMarkSoldOpen(false)}
        product={product}
        onSuccess={handleStockUpdate}
      />
    </div>
  );
}
