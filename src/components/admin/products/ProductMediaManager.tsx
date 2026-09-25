"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  UploadCloud,
  Image as ImageIcon,
  Video as VideoIcon,
  Search,
  Star,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Play,
  Film,
  Package,
  RotateCcw,
  Maximize2,
  SwitchCamera,
  Layers,
  ChevronRight,
} from "lucide-react";
import type {
  ProductImageItem,
  ProductVideoItem,
  ProductListItem,
} from "@/types";
import { VideoType } from "@prisma/client";
import { extractYouTubeVideoId } from "@/validations/media";

interface QueuedImage {
  id: string;
  blob?: Blob;
  file?: File;
  previewUrl: string;
  name: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  errorMessage?: string;
}

interface ProductMediaManagerProps {
  productId?: string | null;
  productName?: string;
  productSku?: string;
  productBrand?: string;
  onMediaChanged?: () => void;
  allowProductSelection?: boolean;
}

export function ProductMediaManager({
  productId: initialProductId,
  productName: initialProductName,
  productSku: initialProductSku,
  productBrand: initialProductBrand,
  onMediaChanged,
  allowProductSelection = true,
}: ProductMediaManagerProps) {
  // Active product selection state
  const [activeProductId, setActiveProductId] = useState<string | null>(
    initialProductId || null
  );
  const [activeProductName, setActiveProductName] = useState<string>(
    initialProductName || ""
  );
  const [activeProductSku, setActiveProductSku] = useState<string>(
    initialProductSku || ""
  );
  const [activeProductBrand, setActiveProductBrand] = useState<string>(
    initialProductBrand || ""
  );

  // Tab State: "photos" vs "videos"
  const [activeTab, setActiveTab] = useState<"photos" | "videos">("photos");

  // Product Search State (Step 1)
  const [productSearch, setProductSearch] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductListItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(
    !initialProductId
  );

  // Media Data state
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [videos, setVideos] = useState<ProductVideoItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Local Upload & Queue State (Step 2 & 4)
  const [uploadQueue, setUploadQueue] = useState<QueuedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Camera Capture State (Step 2: Take Photo)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<
    "environment" | "user"
  >("environment");
  const [capturedPhoto, setCapturedPhoto] = useState<{
    blob: Blob;
    previewUrl: string;
  } | null>(null);

  // Video Management Modals
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");

  const [isUploadVideoModalOpen, setIsUploadVideoModalOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const [previewVideo, setPreviewVideo] = useState<ProductVideoItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync initial props
  useEffect(() => {
    if (initialProductId) {
      setActiveProductId(initialProductId);
      setActiveProductName(initialProductName || "");
      setActiveProductSku(initialProductSku || "");
      setActiveProductBrand(initialProductBrand || "");
      setShowProductSearch(false);
    }
  }, [
    initialProductId,
    initialProductName,
    initialProductSku,
    initialProductBrand,
  ]);

  // Search products when query changes
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingProduct(true);
        const res = await fetch(
          `/api/admin/products?search=${encodeURIComponent(
            productSearch.trim()
          )}&limit=6`
        );
        const json = await res.json();
        if (json.success && (json.data?.products || json.data?.items)) {
          setSearchResults(json.data.products || json.data.items);
        }
      } catch (err) {
        console.error("Failed to search products:", err);
      } finally {
        setIsSearchingProduct(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productSearch]);

  // Fetch images and videos whenever activeProductId changes
  const fetchProductMedia = useCallback(async () => {
    if (!activeProductId) {
      setImages([]);
      setVideos([]);
      return;
    }

    try {
      setLoadingMedia(true);
      setError(null);

      const [imagesRes, videosRes] = await Promise.all([
        fetch(`/api/admin/products/${activeProductId}/images`),
        fetch(`/api/admin/products/${activeProductId}/videos`),
      ]);

      const imagesJson = await imagesRes.json();
      const videosJson = await videosRes.json();

      if (imagesJson.success) {
        setImages(imagesJson.data || []);
      }
      if (videosJson.success) {
        setVideos(videosJson.data || []);
      }
    } catch (err) {
      console.error("Error fetching media:", err);
      setError("Failed to load product media. Please refresh.");
    } finally {
      setLoadingMedia(false);
    }
  }, [activeProductId]);

  useEffect(() => {
    fetchProductMedia();
  }, [fetchProductMedia]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ----------------------------------------------------------------------------
  // STEP 1: SELECT PRODUCT
  // ----------------------------------------------------------------------------
  const handleSelectProduct = (product: ProductListItem) => {
    setActiveProductId(product.id);
    setActiveProductName(product.name);
    setActiveProductSku(product.sku);
    setActiveProductBrand(product.brand?.name || "");
    setShowProductSearch(false);
    setProductSearch("");
    setSearchResults([]);
    setUploadQueue([]);
  };

  // ----------------------------------------------------------------------------
  // STEP 2: CAMERA CONTROLS (TAKE PHOTO)
  // ----------------------------------------------------------------------------
  const startCamera = async (facing: "environment" | "user" = cameraFacingMode) => {
    setCameraError(null);
    setCapturedPhoto(null);
    setIsCameraOpen(true);
    setCameraFacingMode(facing);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Camera stream is not supported in this browser. Please click 'Open Device Camera' below to take a photo."
      );
      return;
    }

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      console.warn("Camera start error:", err);
      const e = err as { name?: string };
      if (
        e.name === "NotAllowedError" ||
        e.name === "PermissionDeniedError"
      ) {
        setCameraError(
          "Camera access permission was denied. Please allow camera permissions in browser settings or use the device photo option."
        );
      } else if (
        e.name === "NotFoundError" ||
        e.name === "DevicesNotFoundError"
      ) {
        setCameraError("No camera device was detected on this system.");
      } else {
        setCameraError(
          "Unable to start camera. You can take a photo using your device camera app or choose photos from files."
        );
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCapturedPhoto(null);
    setCameraError(null);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === "environment" ? "user" : "environment";
    startCamera(nextFacing);
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          setCapturedPhoto({ blob, previewUrl });
        }
      },
      "image/jpeg",
      0.92
    );
  };

  const confirmCapturedPhoto = () => {
    if (!capturedPhoto) return;
    const newQueueItem: QueuedImage = {
      id: `captured-${Date.now()}`,
      blob: capturedPhoto.blob,
      previewUrl: capturedPhoto.previewUrl,
      name: `camera-photo-${images.length + uploadQueue.length + 1}.jpg`,
      status: "pending",
      progress: 0,
    };

    stopCamera();
    addImagesToQueueAndUpload([newQueueItem]);
  };

  const handleNativeCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: QueuedImage[] = Array.from(files).map((file, idx) => ({
      id: `native-${Date.now()}-${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      status: "pending",
      progress: 0,
    }));

    addImagesToQueueAndUpload(newItems);
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = "";
  };

  // ----------------------------------------------------------------------------
  // STEP 2: UPLOAD IMAGES (DRAG & DROP + MULTI-SELECT)
  // ----------------------------------------------------------------------------
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: QueuedImage[] = Array.from(files).map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      status: "pending",
      progress: 0,
    }));

    addImagesToQueueAndUpload(newItems);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      setError("Please drop image files (JPG, PNG, WebP).");
      return;
    }

    const newItems: QueuedImage[] = imageFiles.map((file, idx) => ({
      id: `drop-${Date.now()}-${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      status: "pending",
      progress: 0,
    }));

    addImagesToQueueAndUpload(newItems);
  };

  // ----------------------------------------------------------------------------
  // STEP 4: SAVE & UPLOAD TO CLOUDINARY
  // ----------------------------------------------------------------------------
  const addImagesToQueueAndUpload = async (newItems: QueuedImage[]) => {
    if (!activeProductId) {
      setError("Please select a product first.");
      return;
    }

    setUploadQueue((prev) => [...prev, ...newItems]);
    setError(null);
    setIsUploading(true);
    setUploadProgress({ current: 0, total: newItems.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      setUploadProgress({ current: i + 1, total: newItems.length });

      // Update item status in queue
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "uploading", progress: 30 } : q
        )
      );

      try {
        const formData = new FormData();
        if (item.file) {
          formData.append("file", item.file);
        } else if (item.blob) {
          formData.append("file", item.blob, item.name);
        }
        formData.append(
          "altText",
          `${activeProductName} Photo ${images.length + i + 1}`
        );

        // If no images currently exist and this is the first item, set as primary
        if (images.length === 0 && i === 0) {
          formData.append("isPrimary", "true");
        }

        const res = await fetch(
          `/api/admin/products/${activeProductId}/images`,
          {
            method: "POST",
            body: formData,
          }
        );

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Upload failed");
        }

        successCount++;
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "success", progress: 100 } : q
          )
        );
      } catch (err: unknown) {
        failCount++;
        const message =
          err instanceof Error ? err.message : "Failed to upload image.";
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error", progress: 0, errorMessage: message }
              : q
          )
        );
      }
    }

    setIsUploading(false);
    await fetchProductMedia();
    onMediaChanged?.();

    // Remove successful items from queue after brief delay
    setTimeout(() => {
      setUploadQueue((prev) => prev.filter((q) => q.status !== "success"));
    }, 2000);

    if (successCount > 0 && failCount === 0) {
      showNotification(
        `Successfully uploaded and saved ${successCount} photo${
          successCount > 1 ? "s" : ""
        }!`
      );
    } else if (failCount > 0) {
      setError(
        `${failCount} photo${
          failCount > 1 ? "s" : ""
        } failed to upload. Check connection and retry.`
      );
    }
  };

  const retryFailedUpload = (failedItem: QueuedImage) => {
    addImagesToQueueAndUpload([{ ...failedItem, status: "pending" }]);
  };

  // ----------------------------------------------------------------------------
  // STEP 3: REVIEW ACTIONS (PRIMARY, REORDER, REMOVE)
  // ----------------------------------------------------------------------------
  const handleSetPrimary = async (imageId: string) => {
    if (!activeProductId) return;
    try {
      setError(null);
      const res = await fetch(
        `/api/admin/products/${activeProductId}/images/${imageId}/primary`,
        { method: "PATCH" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to set primary.");

      await fetchProductMedia();
      onMediaChanged?.();
      showNotification("Set as primary product photo.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to set primary image."
      );
    }
  };

  const handleMoveImage = async (
    index: number,
    direction: "left" | "right"
  ) => {
    if (!activeProductId) return;
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setImages(reordered);

    try {
      const res = await fetch(
        `/api/admin/products/${activeProductId}/images/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((img) => img.id) }),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to reorder.");
      onMediaChanged?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to reorder images."
      );
      fetchProductMedia();
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!activeProductId) return;
    if (!confirm("Are you sure you want to remove this photo?")) return;

    try {
      setError(null);
      const res = await fetch(
        `/api/admin/products/${activeProductId}/images/${imageId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete image.");

      await fetchProductMedia();
      onMediaChanged?.();
      showNotification("Photo removed.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete image."
      );
    }
  };

  // ----------------------------------------------------------------------------
  // VIDEO MANAGEMENT HANDLERS
  // ----------------------------------------------------------------------------
  const handleAddYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProductId || !youtubeUrl.trim()) return;

    try {
      setIsUploadingVideo(true);
      setError(null);

      const res = await fetch(
        `/api/admin/products/${activeProductId}/videos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoType: VideoType.YOUTUBE,
            url: youtubeUrl.trim(),
            title: youtubeTitle.trim() || `${activeProductName} Video Demo`,
          }),
        }
      );

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to add video.");

      setIsYouTubeModalOpen(false);
      setYoutubeUrl("");
      setYoutubeTitle("");
      await fetchProductMedia();
      onMediaChanged?.();
      showNotification("YouTube video demo added successfully.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to add YouTube video."
      );
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleUploadVideoFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProductId || !videoFile) return;

    try {
      setIsUploadingVideo(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", videoFile);
      formData.append(
        "title",
        videoTitle.trim() || videoFile.name.replace(/\.[^/.]+$/, "")
      );

      const res = await fetch(
        `/api/admin/products/${activeProductId}/videos`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();
      if (!json.success)
        throw new Error(json.error || "Failed to upload video.");

      setIsUploadVideoModalOpen(false);
      setVideoFile(null);
      setVideoTitle("");
      await fetchProductMedia();
      onMediaChanged?.();
      showNotification("Video uploaded to Cloudinary successfully.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to upload video clip."
      );
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!activeProductId) return;
    if (!confirm("Are you sure you want to remove this video?")) return;

    try {
      setError(null);
      const res = await fetch(
        `/api/admin/products/${activeProductId}/videos/${videoId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete video.");

      await fetchProductMedia();
      onMediaChanged?.();
      showNotification("Video removed.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete video."
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Notifications Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 1: PRODUCT SELECTION HEADER */}
      <div className="p-4 bg-muted/40 border border-border rounded-2xl space-y-3">
        {activeProductId && !showProductSearch ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                {images.length > 0 ? (
                  <img
                    src={images.find((i) => i.isPrimary)?.url || images[0].url}
                    alt={activeProductName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-foreground">
                    {activeProductName}
                  </h3>
                  {activeProductBrand && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-semibold">
                      {activeProductBrand}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  {activeProductSku && (
                    <span className="font-mono">SKU: {activeProductSku}</span>
                  )}
                  <span>•</span>
                  <span>
                    {images.length} photo{images.length !== 1 ? "s" : ""}
                  </span>
                  <span>•</span>
                  <span>
                    {videos.length} video{videos.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {allowProductSelection && (
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-background hover:bg-muted border border-border text-foreground transition flex items-center justify-center gap-1.5 self-start sm:self-center shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Switch Product</span>
              </button>
            )}
          </div>
        ) : (
          /* Search / Select Product Bar */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  <span>Step 1: Find a Product</span>
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Search by product name, SKU, model number, or brand to manage
                  photos.
                </p>
              </div>
              {activeProductId && (
                <button
                  type="button"
                  onClick={() => setShowProductSearch(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Type product name, SKU (e.g. PRS-MVL-3B), or brand..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                autoFocus
              />
              {isSearchingProduct && (
                <RefreshCw className="w-4 h-4 text-primary animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Live Search Results */}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
                {searchResults.map((p) => {
                  const thumb = p.primaryImage?.url || (typeof p.primaryImage === "string" ? p.primaryImage : null);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="p-2.5 rounded-xl bg-background hover:bg-primary/5 border border-border hover:border-primary/40 text-left transition flex items-center gap-2.5 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden text-muted-foreground">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {p.sku} {p.brand ? `• ${p.brand.name}` : ""}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {activeProductId ? (
        <>
          {/* MEDIA TYPE TAB NAVIGATION */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("photos")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === "photos"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
              <span>Product Photos</span>
              <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-bold">
                {images.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("videos")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === "videos"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <VideoIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Video Demos</span>
              <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-bold">
                {videos.length}
              </span>
            </button>
          </div>

          {/* ==================================================================== */}
          {/* TAB 1: PRODUCT PHOTOS WORKFLOW                                       */}
          {/* ==================================================================== */}
          {activeTab === "photos" && (
            <div className="space-y-6">
              {/* STEP 2: ADD PHOTOS ACTION CARDS */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Step 2: Add Photos</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    High resolution JPG, PNG, or WebP (up to 10MB)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Action 1: Take Photo with Camera */}
                  <button
                    type="button"
                    onClick={() => startCamera("environment")}
                    className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/50 text-left transition shadow-xs hover:shadow-md flex items-center gap-3.5 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition">
                        Take Photo
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Open device camera or webcam
                      </div>
                    </div>
                  </button>

                  {/* Action 2: Upload Files / Multi-select */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-4 rounded-2xl border-2 border-dashed transition cursor-pointer flex items-center gap-3.5 group ${
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 group-hover:text-primary transition group-hover:scale-105 transform">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition">
                        Upload Images
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Select multiple files or drag & drop here
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleNativeCameraFile}
                  className="hidden"
                />
              </div>

              {/* STEP 4: LIVE UPLOAD PROGRESS */}
              {isUploading && (
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        Uploading photo {uploadProgress.current} of{" "}
                        {uploadProgress.total} to Cloudinary...
                      </span>
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {Math.round(
                        (uploadProgress.current / uploadProgress.total) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{
                        width: `${
                          (uploadProgress.current / uploadProgress.total) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Queue Cards with Retry support */}
              {uploadQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Upload Queue:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {uploadQueue.map((item) => (
                      <div
                        key={item.id}
                        className="relative rounded-xl border border-border bg-card overflow-hidden group shadow-xs"
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-24 object-cover"
                        />
                        <div className="p-2 text-[11px] bg-card/90 border-t border-border flex items-center justify-between">
                          <span className="truncate max-w-[80px] text-muted-foreground font-mono">
                            {item.name}
                          </span>
                          {item.status === "uploading" && (
                            <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                          )}
                          {item.status === "success" && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          )}
                          {item.status === "error" && (
                            <button
                              type="button"
                              onClick={() => retryFailedUpload(item)}
                              title="Retry upload"
                              className="text-rose-400 hover:text-rose-300 font-bold"
                            >
                              <RotateCcw className="w-3 h-3 inline" /> Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & MANAGE PRODUCT PHOTOS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>Step 3: Review & Arrange Photos ({images.length})</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    First / Starred photo is the main catalogue image
                  </span>
                </div>

                {loadingMedia ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs">Loading photos...</span>
                  </div>
                ) : images.length === 0 ? (
                  <div className="py-12 px-4 rounded-2xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                    <div className="text-sm font-semibold text-foreground">
                      No photos added yet
                    </div>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Use <strong>Take Photo</strong> or{" "}
                      <strong>Upload Images</strong> above to add photos of this
                      appliance for your showroom catalogue.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                    {images.map((img, index) => {
                      const isPrimary = Boolean(img.isPrimary);
                      return (
                        <div
                          key={img.id}
                          className={`relative group rounded-2xl border overflow-hidden bg-card transition shadow-xs hover:shadow-md flex flex-col ${
                            isPrimary
                              ? "border-amber-400 ring-2 ring-amber-400/20"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          {/* Image Thumbnail Container */}
                          <div className="relative aspect-square w-full bg-muted/30 overflow-hidden">
                            <img
                              src={img.url}
                              alt={img.altText || activeProductName}
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                              loading="lazy"
                            />

                            {/* Primary Badge */}
                            {isPrimary && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
                                <Star className="w-3 h-3 fill-amber-950" />
                                <span>PRIMARY</span>
                              </div>
                            )}

                            {/* Order Number Badge */}
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center backdrop-blur-xs">
                              {index + 1}
                            </div>

                            {/* Quick Click Preview Overlay */}
                            <button
                              type="button"
                              onClick={() => setPreviewImage(img.url)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-1 text-xs font-semibold cursor-pointer"
                            >
                              <Maximize2 className="w-4 h-4" />
                              <span>Preview</span>
                            </button>
                          </div>

                          {/* Card Action Toolbar */}
                          <div className="p-2 bg-card border-t border-border/80 flex items-center justify-between gap-1 text-xs">
                            {/* Make Primary Button */}
                            {!isPrimary ? (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(img.id)}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition flex items-center gap-1"
                                title="Set as main primary photo"
                              >
                                <Star className="w-3.5 h-3.5" />
                                <span>Set Main</span>
                              </button>
                            ) : (
                              <span className="px-2 py-1 text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                <span>Main</span>
                              </span>
                            )}

                            {/* Reorder and Delete Actions */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveImage(index, "left")}
                                disabled={index === 0}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition"
                                title="Move left"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveImage(index, "right")}
                                disabled={index === images.length - 1}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition"
                                title="Move right"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(img.id)}
                                className="p-1 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition ml-0.5"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 2: PRODUCT VIDEOS & DEMOS                                        */}
          {/* ==================================================================== */}
          {activeTab === "videos" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <VideoIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Product Video Demos & Clips</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Add YouTube demonstration videos or upload short clips to show
                    the appliance in action.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsYouTubeModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Add YouTube Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUploadVideoModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Short Clip</span>
                  </button>
                </div>
              </div>

              {/* Videos Grid */}
              {loadingMedia ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Loading videos...</span>
                </div>
              ) : videos.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                  <Film className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                  <div className="text-sm font-semibold text-foreground">
                    No videos added yet
                  </div>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Add a YouTube product demo or upload a quick video walkthrough
                    to boost customer engagement.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {videos.map((vid) => {
                    const isYT = vid.videoType === VideoType.YOUTUBE;
                    const ytId = isYT ? extractYouTubeVideoId(vid.url) : null;
                    const thumbUrl = ytId
                      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
                      : null;

                    return (
                      <div
                        key={vid.id}
                        className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition flex flex-col group"
                      >
                        {/* Video Thumbnail */}
                        <div
                          className="relative aspect-video bg-black flex items-center justify-center overflow-hidden cursor-pointer"
                          onClick={() => setPreviewVideo(vid)}
                        >
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={vid.title || activeProductName}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <video
                              src={vid.url}
                              className="w-full h-full object-cover opacity-80"
                            />
                          )}

                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition transform">
                              <Play className="w-4 h-4 fill-black ml-0.5" />
                            </div>
                          </div>

                          <span
                            className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isYT
                                ? "bg-red-600 text-white"
                                : "bg-indigo-600 text-white"
                            }`}
                          >
                            {isYT ? "YOUTUBE" : "CLOUDINARY"}
                          </span>
                        </div>

                        {/* Title & Delete */}
                        <div className="p-3 flex items-center justify-between gap-2 border-t border-border">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {vid.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteVideo(vid.id)}
                            className="p-1 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                            title="Remove video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Empty State: Prompt to select product first */
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            Select a Product to Manage Media
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Use the search bar above to select a product from your showroom
            catalogue to start taking photos or uploading images.
          </p>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CAMERA VIEWFINDER MODAL                                              */}
      {/* ==================================================================== */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-2xl space-y-4 p-5 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {capturedPhoto ? "Review Photo" : "Take Product Photo"}
                </h3>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1.5 rounded-full bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cameraError ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3 my-4">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="text-xs text-rose-300 leading-relaxed">
                  {cameraError}
                </p>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold transition"
                >
                  Use Device Camera App
                </button>
              </div>
            ) : capturedPhoto ? (
              /* Captured Photo Preview Stage */
              <div className="space-y-4">
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-border bg-black">
                  <img
                    src={capturedPhoto.previewUrl}
                    alt="Captured preview"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedPhoto(null);
                      startCamera();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>

                  <button
                    type="button"
                    onClick={confirmCapturedPhoto}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Use This Photo</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Live Camera Viewfinder */
              <div className="space-y-4">
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Framing Overlay Guides */}
                  <div className="absolute inset-4 border border-white/30 rounded-xl pointer-events-none" />

                  {/* Flip Camera Button */}
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition backdrop-blur-xs shadow-md"
                    title="Switch camera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>

                {/* Shutter Capture Button */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="w-16 h-16 rounded-full border-4 border-primary/40 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition transform cursor-pointer"
                    title="Capture photo"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-primary-foreground/80 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* YOUTUBE MODAL                                                        */}
      {/* ==================================================================== */}
      {isYouTubeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Play className="w-4 h-4 text-red-500 fill-red-500" />
                <span>Add YouTube Video Demo</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsYouTubeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddYouTube} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  YouTube Video Link <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Video Title (Optional)
                </label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  placeholder={`e.g. ${activeProductName} Feature Walkthrough`}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsYouTubeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingVideo || !youtubeUrl.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingVideo && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Add Video</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* UPLOAD SHORT CLIP MODAL                                              */}
      {/* ==================================================================== */}
      {isUploadVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>Upload Short Video Clip</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadVideoModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadVideoFile} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Video File (MP4, WebM, MOV - Max 50MB){" "}
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Video Title (Optional)
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder={`e.g. 30-sec burner flame demo`}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadVideoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingVideo || !videoFile}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingVideo && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Upload to Cloudinary</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PREVIEW VIDEO MODAL                                                  */}
      {/* ==================================================================== */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-black rounded-2xl overflow-hidden border border-border shadow-2xl space-y-2 p-2">
            <div className="flex items-center justify-between px-3 py-1 text-white">
              <span className="text-xs font-bold truncate">
                {previewVideo.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full">
              {previewVideo.videoType === VideoType.YOUTUBE ? (
                <iframe
                  src={`https://www.youtube.com/embed/${extractYouTubeVideoId(
                    previewVideo.url
                  )}?autoplay=1`}
                  title={previewVideo.title || "YouTube Video"}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={previewVideo.url}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PREVIEW IMAGE MODAL                                                  */}
      {/* ==================================================================== */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
            <img
              src={previewImage}
              alt="Enlarged preview"
              className="w-full h-full object-contain max-h-[85vh] rounded-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
