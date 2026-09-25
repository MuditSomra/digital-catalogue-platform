"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Play,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Link as LinkIcon,
  Film,
  Edit2,
  Eye,
} from "lucide-react";
import type { ProductImageItem, ProductVideoItem } from "@/types";
import { VideoType } from "@prisma/client";
import { extractYouTubeVideoId } from "@/validations/media";

interface ProductMediaManagerProps {
  productId: string;
  productName: string;
  onMediaChanged?: () => void;
}

export function ProductMediaManager({
  productId,
  productName,
  onMediaChanged,
}: ProductMediaManagerProps) {
  // State
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [videos, setVideos] = useState<ProductVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Uploading state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Modals & sub-dialogs
  const [isLinkImageModalOpen, setIsLinkImageModalOpen] = useState(false);
  const [linkImageUrl, setLinkImageUrl] = useState("");
  const [linkImageAlt, setLinkImageAlt] = useState("");

  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");

  const [isLinkVideoModalOpen, setIsLinkVideoModalOpen] = useState(false);
  const [linkVideoUrl, setLinkVideoUrl] = useState("");
  const [linkVideoTitle, setLinkVideoTitle] = useState("");

  const [previewVideo, setPreviewVideo] = useState<ProductVideoItem | null>(null);
  const [previewImage, setPreviewImage] = useState<ProductImageItem | null>(null);

  const [editingAltImageId, setEditingAltImageId] = useState<string | null>(null);
  const [editingAltText, setEditingAltText] = useState("");

  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingVideoTitle, setEditingVideoTitle] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch Media Data
  const fetchMedia = async () => {
    try {
      setLoading(true);
      setError(null);

      const [imagesRes, videosRes] = await Promise.all([
        fetch(`/api/admin/products/${productId}/images`),
        fetch(`/api/admin/products/${productId}/videos`),
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
      console.error("Failed to load product media:", err);
      setError("Failed to load product media. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchMedia();
    }
  }, [productId]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ----------------------------------------------------------------------------
  // IMAGE HANDLERS
  // ----------------------------------------------------------------------------

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingImage(true);
      setError(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("altText", `${productName} photo ${images.length + i + 1}`);

        const res = await fetch(`/api/admin/products/${productId}/images`, {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to upload image.");
        }
      }

      await fetchMedia();
      onMediaChanged?.();
      showNotification("Image(s) uploaded successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleLinkImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkImageUrl.trim()) return;

    try {
      setIsUploadingImage(true);
      setError(null);

      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: linkImageUrl.trim(),
          altText: linkImageAlt.trim() || productName,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to add image link.");
      }

      setIsLinkImageModalOpen(false);
      setLinkImageUrl("");
      setLinkImageAlt("");
      await fetchMedia();
      onMediaChanged?.();
      showNotification("Image added successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSetPrimaryImage = async (imageId: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/admin/products/${productId}/images/${imageId}/primary`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to set primary image.");

      await fetchMedia();
      onMediaChanged?.();
      showNotification("Primary product image updated.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to set primary image.");
    }
  };

  const handleMoveImage = async (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Optimistic update
    setImages(reordered);

    try {
      const res = await fetch(`/api/admin/products/${productId}/images/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((img) => img.id) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to reorder images.");

      onMediaChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reorder images.");
      fetchMedia();
    }
  };

  const handleSaveAltText = async (imageId: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: editingAltText.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update image details.");

      setEditingAltImageId(null);
      await fetchMedia();
      onMediaChanged?.();
      showNotification("Image description saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update image.");
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to remove this image?")) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete image.");

      await fetchMedia();
      onMediaChanged?.();
      showNotification("Image removed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete image.");
    }
  };

  // ----------------------------------------------------------------------------
  // VIDEO HANDLERS
  // ----------------------------------------------------------------------------

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    try {
      setIsUploadingVideo(true);
      setError(null);

      const res = await fetch(`/api/admin/products/${productId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoType: VideoType.YOUTUBE,
          url: youtubeUrl.trim(),
          title: youtubeTitle.trim() || `${productName} Demo`,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to add YouTube video.");
      }

      setIsYouTubeModalOpen(false);
      setYoutubeUrl("");
      setYoutubeTitle("");
      await fetchMedia();
      onMediaChanged?.();
      showNotification("YouTube video added successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add YouTube video.");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingVideo(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

      const res = await fetch(`/api/admin/products/${productId}/videos`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to upload video clip.");
      }

      await fetchMedia();
      onMediaChanged?.();
      showNotification("Video clip uploaded to Cloudinary successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload video.");
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const handleLinkVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkVideoUrl.trim()) return;

    try {
      setIsUploadingVideo(true);
      setError(null);

      const res = await fetch(`/api/admin/products/${productId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoType: VideoType.CLOUDINARY,
          url: linkVideoUrl.trim(),
          title: linkVideoTitle.trim() || `${productName} Short Clip`,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to link video.");
      }

      setIsLinkVideoModalOpen(false);
      setLinkVideoUrl("");
      setLinkVideoTitle("");
      await fetchMedia();
      onMediaChanged?.();
      showNotification("Video added successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add video.");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleMoveVideo = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;

    const reordered = [...videos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setVideos(reordered);

    try {
      const res = await fetch(`/api/admin/products/${productId}/videos/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((v) => v.id) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to reorder videos.");

      onMediaChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reorder videos.");
      fetchMedia();
    }
  };

  const handleSaveVideoTitle = async (videoId: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/admin/products/${productId}/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingVideoTitle.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update video title.");

      setEditingVideoId(null);
      await fetchMedia();
      onMediaChanged?.();
      showNotification("Video title updated.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update video.");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to remove this video?")) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/products/${productId}/videos/${videoId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete video.");

      await fetchMedia();
      onMediaChanged?.();
      showNotification("Video removed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete video.");
    }
  };

  // Preview YouTube computed ID
  const ytVideoId = extractYouTubeVideoId(youtubeUrl);

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="font-medium">{successMsg}</div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileUpload}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoFileUpload}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* SECTION 1: PRODUCT IMAGES */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Product Images ({images.length})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                First image or marked primary will appear on showroom cards and search results.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLinkImageModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition flex items-center gap-1.5"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link Image URL</span>
            </button>

            <button
              type="button"
              disabled={isUploadingImage}
              onClick={() => imageInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUploadingImage ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploadingImage ? "Uploading..." : "Upload Image"}</span>
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && images.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
            Loading images...
          </div>
        ) : images.length === 0 ? (
          /* Empty State */
          <div
            onClick={() => imageInputRef.current?.click()}
            className="p-8 border-2 border-dashed border-border/80 hover:border-primary/50 bg-card/50 hover:bg-muted/30 rounded-2xl text-center cursor-pointer transition space-y-2 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground group-hover:text-primary group-hover:scale-105 transition">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-foreground">No images uploaded yet</h4>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Click to upload JPG, PNG, or WebP images from your computer, or use the Link Image URL button.
            </p>
          </div>
        ) : (
          /* Images Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={`relative group bg-card border rounded-xl overflow-hidden shadow-xs transition flex flex-col ${
                  image.isPrimary
                    ? "border-amber-500/50 ring-2 ring-amber-500/20"
                    : "border-border hover:border-border/80"
                }`}
              >
                {/* Image Preview */}
                <div
                  className="aspect-square bg-muted/30 relative overflow-hidden flex items-center justify-center cursor-pointer"
                  onClick={() => setPreviewImage(image)}
                >
                  <img
                    src={image.url}
                    alt={image.altText || productName}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />

                  {/* Primary Badge */}
                  {image.isPrimary && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[10px] shadow-sm flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Primary</span>
                    </div>
                  )}

                  {/* Quick Zoom Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <span className="p-1.5 rounded-lg bg-black/60 text-white text-xs flex items-center gap-1 font-medium">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </span>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="p-2.5 bg-card border-t border-border flex flex-col gap-1.5 text-xs">
                  {/* Alt text row */}
                  {editingAltImageId === image.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingAltText}
                        onChange={(e) => setEditingAltText(e.target.value)}
                        placeholder="Description (alt text)..."
                        className="w-full px-2 py-1 bg-background border border-border rounded text-[11px] text-foreground focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveAltText(image.id)}
                        className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                        title="Save"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAltImageId(null)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[120px]" title={image.altText || "No description"}>
                        {image.altText || <span className="italic">No description</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAltImageId(image.id);
                          setEditingAltText(image.altText || "");
                        }}
                        className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                        title="Edit description"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Actions bar: Reorder, Set Primary, Delete */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                    {/* Reorder Arrows */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveImage(index, "left")}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === images.length - 1}
                        onClick={() => handleMoveImage(index, "right")}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                        title="Move Right"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Set Primary Button */}
                    {!image.isPrimary ? (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImage(image.id)}
                        className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 hover:underline transition"
                        title="Make this the primary showcase image"
                      >
                        Set Primary
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-500">
                        Primary
                      </span>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                      title="Remove Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: PRODUCT VIDEOS */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <VideoIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Product Videos ({videos.length})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Add YouTube videos for feature walk-throughs or upload short Cloudinary clips.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsYouTubeModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add YouTube Video</span>
            </button>

            <button
              type="button"
              disabled={isUploadingVideo}
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUploadingVideo ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploadingVideo ? "Uploading Clip..." : "Upload Short Clip"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLinkVideoModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              title="Link Existing Video URL"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video List */}
        {videos.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-border/80 bg-card/50 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Film className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-foreground">No videos added yet</h4>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Add YouTube review/demo links or short 15-second product clips to showcase this appliance in action.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="p-3 bg-card border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-border/80 transition"
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail / Play trigger */}
                  <div
                    onClick={() => setPreviewVideo(video)}
                    className="w-20 h-14 shrink-0 rounded-lg bg-black/80 relative overflow-hidden border border-border flex items-center justify-center cursor-pointer group"
                  >
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title || "Video thumbnail"}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <Film className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition">
                      <div className="w-6 h-6 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-md">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          video.videoType === VideoType.YOUTUBE
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}
                      >
                        {video.videoType === VideoType.YOUTUBE ? "YouTube Video" : "Cloudinary Clip"}
                      </span>
                      {video.youtubeVideoId && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ID: {video.youtubeVideoId}
                        </span>
                      )}
                    </div>

                    {editingVideoId === video.id ? (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <input
                          type="text"
                          value={editingVideoTitle}
                          onChange={(e) => setEditingVideoTitle(e.target.value)}
                          placeholder="Video Title..."
                          className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveVideoTitle(video.id)}
                          className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          title="Save Title"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingVideoId(null)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-foreground truncate max-w-[280px]">
                          {video.title || "Product Showcase Video"}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVideoId(video.id);
                            setEditingVideoTitle(video.title || "");
                          }}
                          className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                          title="Edit Title"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                      {video.url}
                    </div>
                  </div>
                </div>

                {/* Right: Controls (Reorder, Play, Delete) */}
                <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <div className="flex items-center gap-0.5 bg-muted/40 p-1 rounded-lg border border-border/50">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveVideo(index, "up")}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === videos.length - 1}
                      onClick={() => handleMoveVideo(index, "down")}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewVideo(video)}
                    className="p-2 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition text-xs flex items-center gap-1"
                    title="Watch Preview"
                  >
                    <Play className="w-3.5 h-3.5 text-primary" />
                    <span>Watch</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteVideo(video.id)}
                    className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
                    title="Remove Video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DIALOGS & MODALS */}
      {/* ========================================================================= */}

      {/* 1. Add YouTube Video Modal */}
      {isYouTubeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <VideoIcon className="w-4 h-4" />
                <span>Add YouTube Video</span>
              </div>
              <button
                type="button"
                onClick={() => setIsYouTubeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleYouTubeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  YouTube Video Link or ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or youtu.be/xxx"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Supports standard watch links, youtu.be, shorts, and embed links.
                </p>
              </div>

              {/* Live Preview of YouTube Thumbnail */}
              {ytVideoId && (
                <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                    Detected Video Preview
                  </span>
                  <div className="aspect-video rounded-lg overflow-hidden border border-border/80 bg-black relative flex items-center justify-center">
                    <img
                      src={`https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`}
                      alt="YouTube Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Video Title (Optional)
                </label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  placeholder="e.g. 3-Burner Auto Ignition Demo"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsYouTubeModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingVideo || !ytVideoId}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingVideo ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Add YouTube Video</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Link Image URL Modal */}
      {isLinkImageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <LinkIcon className="w-4 h-4" />
                <span>Link Product Image URL</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkImageModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLinkImageSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Direct Image URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="url"
                  value={linkImageUrl}
                  onChange={(e) => setLinkImageUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Alt Text / Description (Optional)
                </label>
                <input
                  type="text"
                  value={linkImageAlt}
                  onChange={(e) => setLinkImageAlt(e.target.value)}
                  placeholder="e.g. Front angled burner view"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLinkImageModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage || !linkImageUrl.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition disabled:opacity-50"
                >
                  Save Image Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Link Video URL Modal */}
      {isLinkVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Film className="w-4 h-4" />
                <span>Link Video URL</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkVideoModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLinkVideoSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Direct Video URL (Cloudinary / MP4) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="url"
                  value={linkVideoUrl}
                  onChange={(e) => setLinkVideoUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Video Title (Optional)
                </label>
                <input
                  type="text"
                  value={linkVideoTitle}
                  onChange={(e) => setLinkVideoTitle(e.target.value)}
                  placeholder="e.g. 15s Showroom Feature Clip"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLinkVideoModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingVideo || !linkVideoUrl.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition disabled:opacity-50"
                >
                  Save Video Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Full Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] bg-card border border-border rounded-2xl overflow-hidden shadow-2xl p-2 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.altText || productName}
              className="max-h-[75vh] w-auto mx-auto object-contain rounded-xl"
            />
            {previewImage.altText && (
              <p className="text-center text-xs text-muted-foreground mt-2 px-4 py-1">
                {previewImage.altText}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 5. Video Player Preview Modal (No Autoplay by Default) */}
      {previewVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-bold text-foreground truncate max-w-[400px]">
                {previewVideo.title || "Video Preview"}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              {previewVideo.videoType === VideoType.YOUTUBE && previewVideo.youtubeVideoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${previewVideo.youtubeVideoId}?autoplay=1`}
                  title={previewVideo.title || "YouTube Video"}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={previewVideo.url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
