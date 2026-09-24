"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { FolderTree, CheckCircle2, AlertCircle } from "lucide-react";
import type { CategoryTreeNode } from "@/types";

interface FlatOption {
  id: string;
  name: string;
  path: string;
  depth: number;
  isDisabled: boolean;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    parentId: string | null;
    description: string | null;
    isActive: boolean;
  }) => Promise<void>;
  categoryToEdit?: {
    id: string;
    name: string;
    parentId: string | null;
    description: string | null;
    isActive: boolean;
  } | null;
  parentCategoryId?: string | null;
  flatCategories: FlatOption[];
}

export function CategoryModal({
  isOpen,
  onClose,
  onSave,
  categoryToEdit,
  parentCategoryId,
  flatCategories,
}: CategoryModalProps) {
  const isEditing = Boolean(categoryToEdit);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
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
        setDescription(categoryToEdit.description || "");
        setIsActive(categoryToEdit.isActive);
      } else {
        setName("");
        setParentId(parentCategoryId || null);
        setDescription("");
        setIsActive(true);
      }
    }
  }, [isOpen, categoryToEdit, parentCategoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a category name.");
      return;
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
          <select
            value={parentId || ""}
            onChange={(e) => setParentId(e.target.value === "" ? null : e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          >
            <option value="">(None - Top Level Root Category)</option>
            {flatCategories.map((cat) => (
              <option
                key={cat.id}
                value={cat.id}
                disabled={cat.isDisabled || (isEditing && cat.id === categoryToEdit?.id)}
              >
                {"— ".repeat(cat.depth)}
                {cat.name} {cat.depth > 0 ? `(${cat.path})` : ""}
                {cat.isDisabled ? " (Cannot select descendant)" : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Place this category inside an existing category (e.g. place "Gas Stoves" under "Cooking Appliances").
          </p>
        </div>

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
