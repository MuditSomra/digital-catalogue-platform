"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Package,
} from "lucide-react";
import type { CatalogueProductItem } from "@/types";

interface PresentationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CatalogueProductItem;
  allProducts?: CatalogueProductItem[];
}

type MediaItem =
  | {
      type: "image";
      id: string;
      url: string;
      altText?: string | null;
    }
  | {
      type: "video";
      id: string;
      url: string;
      youtubeVideoId?: string | null;
      title?: string | null;
      thumbnailUrl?: string | null;
    };

export function PresentationModeModal({
  isOpen,
  onClose,
  product,
}: PresentationModeModalProps) {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // Build sequential media list (images first, followed by videos)
  const mediaItems: MediaItem[] = [];

  if (product.images && product.images.length > 0) {
    product.images.forEach((img) => {
      mediaItems.push({
        type: "image",
        id: img.id,
        url: img.url,
        altText: img.altText,
      });
    });
  } else if (product.primaryImage) {
    mediaItems.push({
      type: "image",
      id: product.primaryImage.id,
      url: product.primaryImage.url,
      altText: product.primaryImage.altText,
    });
  }

  if (product.videos && product.videos.length > 0) {
    product.videos.forEach((vid) => {
      mediaItems.push({
        type: "video",
        id: vid.id,
        url: vid.url,
        youtubeVideoId: vid.youtubeVideoId,
        title: vid.title,
        thumbnailUrl: vid.thumbnailUrl,
      });
    });
  }

  // Reset media index when product or open state changes
  useEffect(() => {
    if (isOpen) {
      setCurrentMediaIndex(0);
    }
  }, [isOpen, product.id]);

  // Request browser fullscreen on open
  useEffect(() => {
    if (isOpen) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {});
      }
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isOpen]);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

  const totalItems = mediaItems.length;
  const hasMultiple = totalItems > 1;

  const handlePrev = useCallback(() => {
    if (totalItems <= 1) return;
    setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
  }, [totalItems]);

  const handleNext = useCallback(() => {
    if (totalItems <= 1) return;
    setCurrentMediaIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
  }, [totalItems]);

  // Keyboard navigation (Arrow keys + Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, handleExit]);

  // Touch swipe handling for mobile / tablets
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartXRef.current - touchEndX;

    // Minimum swipe threshold 40px
    if (diffX > 40) {
      handleNext();
    } else if (diffX < -40) {
      handlePrev();
    }
    touchStartXRef.current = null;
  };

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  const currentMedia = mediaItems[currentMediaIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between select-none animate-in fade-in duration-150"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimal Top Floating Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="max-w-[240px] sm:max-w-md truncate">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
              {product.brand.name}
            </span>
            <span className="text-sm sm:text-base font-semibold text-white/95 truncate block">
              {product.name}
            </span>
          </div>
        </div>

        {/* Counter, Fullscreen & Immediate Exit */}
        <div className="flex items-center gap-3">
          {totalItems > 0 && (
            <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-mono font-medium text-white/90 border border-white/15">
              {currentMediaIndex + 1} / {totalItems}
            </div>
          )}

          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white/80 hover:text-white transition hidden sm:flex items-center justify-center"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md text-xs font-semibold transition border border-white/20 shadow-md cursor-pointer"
            title="Exit Presentation"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Main Center Full-Screen Media Display */}
      <main className="relative flex-1 w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-hidden">
        {totalItems === 0 ? (
          <div className="text-center text-slate-500 space-y-2">
            <Package className="w-16 h-16 mx-auto stroke-[1.2]" />
            <p className="text-sm font-medium">No media available for this product</p>
          </div>
        ) : currentMedia.type === "image" ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              key={currentMedia.id}
              src={currentMedia.url}
              alt={currentMedia.altText || product.name}
              className="max-h-[88vh] max-w-[94vw] object-contain drop-shadow-2xl transition-all duration-200"
            />
          </div>
        ) : (
          <div className="w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center">
            {currentMedia.youtubeVideoId ? (
              <iframe
                key={currentMedia.id}
                src={`https://www.youtube-nocookie.com/embed/${currentMedia.youtubeVideoId}?autoplay=1&controls=1&rel=0`}
                title={currentMedia.title || "Product Video Demo"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full min-h-[320px] sm:min-h-[480px] max-h-[80vh] rounded-2xl border border-white/10 shadow-2xl"
              />
            ) : (
              <video
                key={currentMedia.id}
                src={currentMedia.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[92vw] rounded-2xl shadow-2xl"
              />
            )}
          </div>
        )}

        {/* Floating Prev Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 sm:p-4 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md transition border border-white/10 shadow-lg group cursor-pointer"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Floating Next Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 sm:p-4 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md transition border border-white/10 shadow-lg group cursor-pointer"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </main>

      {/* Minimal Bottom Thumbnail Indicators */}
      {hasMultiple && (
        <footer className="absolute bottom-0 left-0 right-0 z-20 py-4 px-6 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-1.5 max-w-full overflow-x-auto py-1 px-2">
            {mediaItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentMediaIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentMediaIndex
                    ? "w-8 bg-blue-500"
                    : "w-2 bg-white/30 hover:bg-white/60"
                }`}
                title={`Go to item ${idx + 1}`}
              />
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
