"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { FolderTree, CheckCircle2, AlertCircle, Lock, Hash } from "lucide-react";
import type { CategoryTreeNode, FlatCategoryOption } from "@/types";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    parentId: string | null;
    description: string | null;
    isActive: boolean;
    skuPrefix?: string | null;
  }) => Promise<void>;
  categoryToEdit?: {
    id: string;
    name: string;
    parentId: string | null;
    description: string | null;
    isActive: boolean;
    skuPrefix?: string | null;
    skuLastNumber?: number | null;
  } | null;
  parentCategoryId?: string | null;
  flatCategories?: FlatCategoryOption[];
  categories?: CategoryTreeNode[] | FlatCategoryOption[];
}

export function CategoryModal({
  isOpen,
  onClose,
  onSave,
  categoryToEdit,
  parentCategoryId,
  flatCategories,
  categories,
}: CategoryModalProps) {
  const isEditing = Boolean(categoryToEdit);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [skuPrefix, setSkuPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setParentId(categoryToEdit.parentId);
        setSkuPrefix(categoryToEdit.skuPrefix || "");
        setDescription(categoryToEdit.description || "");
        setIsActive(categoryToEdit.isActive);
      } else {
        setName("");
        setParentId(parentCategoryId || null);
        setSkuPrefix("");
        setDescription("");
        setIsActive(true);
      }
    }
  }, [isOpen, categoryToEdit, parentCategoryId]);

  // Determine if the category being created or edited is Level 2 (immediate child of Root)
  const isLevel2 = useMemo(() => {
    // If editing and category already has a skuPrefix, it is Level 2
    if (isEditing && categoryToEdit?.skuPrefix) {
      return true;
    }

    if (!parentId) {
      // Root category (Level 1)
      return false;
    }

    // Check in flatCategories
    if (flatCategories && flatCategories.length > 0) {
      const parentCat = flatCategories.find((c) => c.id === parentId);
      if (parentCat) {
        return parentCat.parentId === null || parentCat.depth === 0;
      }
    }

    // Check in categories tree
    if (categories && Array.isArray(categories)) {
      return categories.some(
        (node: any) => node.id === parentId && (node.parentId === null || !node.parentId)
      );
    }

    return false;
  }, [parentId, flatCategories, categories, isEditing, categoryToEdit]);

  // If editing an existing Level 2 category that has already generated SKUs, lock prefix
  const isPrefixLocked = Boolean(isEditing && ((categoryToEdit?.skuLastNumber ?? 0) > 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a category name.");
      return;
    }

    let cleanPrefix: string | null = null;
    if (isLevel2) {
      const trimmed = skuPrefix.trim().toUpperCase();
      if (!trimmed) {
        setError("Please enter a SKU Prefix for this Level 2 product category.");
        return;
      }
      if (!/^[A-Z]{2,5}$/.test(trimmed)) {
        setError("SKU Prefix must be 2 to 5 uppercase letters (e.g. GAS, CHM, MIX).");
        return;
      }
      cleanPrefix = trimmed;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        id: categoryToEdit?.id,
        name: name.trim(),
        parentId: parentId || null,
        description: description.trim() || null,
        isActive,
        skuPrefix: isLevel2 ? cleanPrefix : null,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save category. Please check your inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Category" : "Add New Category"}
      description={
        isEditing
          ? "Update category name, parent hierarchy, or description."
          : "Create a new category or subcategory for your appliance showroom."
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Category Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Category Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gas Stoves, Built-in Hobs, Mixer Grinders"
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
            required
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            The customer-facing name displayed in menus and catalogue navigation.
          </p>
        </div>

        {/* Parent Category */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Parent Category</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Optional (leave as Root for main category)
            </span>
          </label>
          <CascadingCategorySelect
            value={parentId}
            onChange={(newParentId) => setParentId(newParentId)}
            categories={categories || flatCategories}
            excludeCategoryId={categoryToEdit?.id}
            allowRootSelection={true}
            rootLabel="(None - Top Level Root Category)"
            subCategoryPlaceholder="(No subcategory - Use this category as parent)"
            showPathPreview={true}
            idPrefix="cat-modal-parent"
          />
          <p className="text-[11px] text-muted-foreground">
            Place this category inside an existing category (e.g. place "Gas Stoves" under "Cooking Appliances").
          </p>
        </div>

        {/* SKU Prefix (Level 2 categories only) */}
        {isLevel2 ? (
          <div className="space-y-1.5 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span>SKU Prefix</span>
                <span className="text-rose-400">*</span>
              </label>
              {isPrefixLocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Lock className="w-3 h-3" /> Locked ({categoryToEdit?.skuLastNumber ?? 0} SKUs generated)
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Preview: <strong className="text-foreground">{skuPrefix ? `${skuPrefix.toUpperCase()}-001` : "PREFIX-001"}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={skuPrefix}
                onChange={(e) => setSkuPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                placeholder="e.g. GAS, CHM, MIX, VAC"
                maxLength={5}
                disabled={isPrefixLocked}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60 disabled:opacity-60 disabled:cursor-not-allowed"
                required={isLevel2}
              />
              {isPrefixLocked && (
                <Lock className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3" />
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isPrefixLocked
                ? "This prefix cannot be changed because products have already been assigned sequential SKUs with it."
                : "Enter 2 to 5 uppercase letters. All products in this Level 2 category will automatically be assigned sequential SKUs (e.g. GAS-001, GAS-002)."}
            </p>
          </div>
        ) : parentId ? (
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-primary shrink-0" />
            <span>This subcategory will inherit its SKU prefix and sequence from its parent Level 2 category.</span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-muted/20 border border-border text-xs text-muted-foreground flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>Root category: used to group product categories. Product SKUs are assigned at Level 2.</span>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Description <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. High performance 2, 3, and 4 burner stainless steel and glass cooktops"
            rows={3}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60 resize-none"
          />
        </div>

        {/* Status Toggle */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-foreground">Category Status</div>
            <div className="text-[11px] text-muted-foreground">
              Active categories are visible to customers and available for products.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isEditing ? "Save Changes" : "Create Category"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
