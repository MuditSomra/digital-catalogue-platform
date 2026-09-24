"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CategoryTree } from "@/components/admin/categories/CategoryTree";
import { CategoryDetail } from "@/components/admin/categories/CategoryDetail";
import { CategoryModal } from "@/components/admin/categories/CategoryModal";
import { SpecificationModal } from "@/components/admin/categories/SpecificationModal";
import { OptionsModal } from "@/components/admin/categories/OptionsModal";
import { DeleteConfirmModal } from "@/components/admin/categories/DeleteConfirmModal";
import { useToast } from "@/components/ui/ToastContext";
import {
  CategoryTreeNode,
  CategoryDetailView,
  AttributeType,
} from "@/types";
import { Layers, Plus, RefreshCw } from "lucide-react";

interface FlatOption {
  id: string;
  name: string;
  path: string;
  depth: number;
  isDisabled: boolean;
}

export default function AdminCategoriesPage() {
  const { success, error } = useToast();

  // Data states
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [flatOptions, setFlatOptions] = useState<FlatOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetailView | null>(null);

  // Loading states
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Category Modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<{
    id: string;
    name: string;
    parentId: string | null;
    description: string | null;
    isActive: boolean;
  } | null>(null);
  const [parentForNewCategory, setParentForNewCategory] = useState<string | null>(null);

  // Specification Modal state
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [specToEdit, setSpecToEdit] = useState<{
    id: string;
    name: string;
    type: AttributeType;
    unit: string | null;
    isFilterable: boolean;
    isRequired: boolean;
  } | null>(null);
  const [categoryForNewSpec, setCategoryForNewSpec] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Options Modal state
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [specForOptions, setSpecForOptions] = useState<{
    id: string;
    name: string;
    type: string;
    predefinedValues: {
      id: string;
      attributeId: string;
      value: string;
      label: string;
      sortOrder: number;
    }[];
  } | null>(null);

  // Delete Confirm Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "category" | "specification" | "option";
    childCount?: number;
    productCount?: number;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Fetch complete category tree and flat list
  const fetchCatalogueTree = useCallback(async (preferredSelectId?: string | null) => {
    try {
      setLoadingTree(true);
      const res = await fetch("/api/admin/categories");
      const json = await res.json();

      if (json.success) {
        setTree(json.data.tree);
        setFlatOptions(json.data.flat);

        // Auto-select preferred or first category if none selected
        if (preferredSelectId) {
          setSelectedCategoryId(preferredSelectId);
        } else if (json.data.tree.length > 0) {
          // Look for "Gas Stoves" or pick first child / root
          let defaultId = json.data.tree[0].id;
          if (json.data.tree[0].children && json.data.tree[0].children.length > 0) {
            const firstSub = json.data.tree[0].children[0];
            if (firstSub.children && firstSub.children.length > 0) {
              defaultId = firstSub.children[0].id; // e.g. Gas Stoves
            } else {
              defaultId = firstSub.id;
            }
          }
          setSelectedCategoryId((prev) => prev || defaultId);
        }
      } else {
        error("Failed to load categories", json.error);
      }
    } catch {
      error("Connection Error", "Could not load categories from server.");
    } finally {
      setLoadingTree(false);
    }
  }, [error]);

  // Fetch category detail when selected
  const fetchCategoryDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/admin/categories/${id}`);
      const json = await res.json();

      if (json.success) {
        setSelectedCategoryDetail(json.data);
      } else {
        error("Failed to load category details", json.error);
      }
    } catch {
      error("Connection Error", "Could not load category details.");
    } finally {
      setLoadingDetail(false);
    }
  }, [error]);

  // Initial load
  useEffect(() => {
    fetchCatalogueTree();
  }, [fetchCatalogueTree]);

  // Load detail whenever selectedCategoryId changes
  useEffect(() => {
    if (selectedCategoryId) {
      fetchCategoryDetail(selectedCategoryId);
    }
  }, [selectedCategoryId, fetchCategoryDetail]);

  // ============================================================================
  // Category Operations
  // ============================================================================

  const handleOpenAddCategory = (parentId?: string | null) => {
    setCategoryToEdit(null);
    setParentForNewCategory(parentId !== undefined ? parentId : selectedCategoryId);
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: { id: string; name: string; parentId: string | null; description: string | null; isActive: boolean }) => {
    setCategoryToEdit(cat);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (data: {
    id?: string;
    name: string;
    parentId: string | null;
    description: string | null;
    isActive: boolean;
  }) => {
    if (data.id) {
      // Update
      const res = await fetch(`/api/admin/categories/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          parentId: data.parentId,
          description: data.description,
          isActive: data.isActive,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to update category.");
      }
      success("Category Updated", `"${data.name}" has been updated successfully.`);
      await fetchCatalogueTree(data.id);
      await fetchCategoryDetail(data.id);
    } else {
      // Create
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          parentId: data.parentId,
          description: data.description,
          isActive: data.isActive,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create category.");
      }
      success("Category Created", `"${data.name}" has been created successfully.`);
      await fetchCatalogueTree(json.data.id);
      setSelectedCategoryId(json.data.id);
    }
  };

  const handleToggleCategoryActive = async (cat: { id: string; name: string; isActive: boolean }) => {
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        success(
          cat.isActive ? "Category Disabled" : "Category Enabled",
          `"${cat.name}" is now ${cat.isActive ? "disabled" : "active"}.`
        );
        await fetchCatalogueTree(cat.id);
        if (selectedCategoryId === cat.id) {
          await fetchCategoryDetail(cat.id);
        }
      } else {
        error("Action Failed", json.error);
      }
    } catch {
      error("Connection Error", "Could not update category status.");
    }
  };

  const handleDeleteCategory = (cat: { id: string; name: string; _count?: { children: number; products: number } }) => {
    setDeleteTarget({
      id: cat.id,
      name: cat.name,
      type: "category",
      childCount: cat._count?.children || 0,
      productCount: cat._count?.products || 0,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/categories/${cat.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to delete category.");
        }
        success("Category Deleted", `"${cat.name}" has been removed.`);
        setSelectedCategoryId(null);
        setSelectedCategoryDetail(null);
        await fetchCatalogueTree();
      },
    });
    setDeleteModalOpen(true);
  };

  const handleReorderCategories = async (items: { id: string; sortOrder: number }[]) => {
    try {
      const res = await fetch("/api/admin/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", items }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchCatalogueTree(selectedCategoryId);
      } else {
        error("Reorder Failed", json.error);
      }
    } catch {
      error("Connection Error", "Could not save category order.");
    }
  };

  // ============================================================================
  // Dynamic Specification Operations
  // ============================================================================

  const handleOpenAddSpec = (categoryId: string, categoryName: string) => {
    setSpecToEdit(null);
    setCategoryForNewSpec({ id: categoryId, name: categoryName });
    setSpecModalOpen(true);
  };

  const handleOpenEditSpec = (attr: CategoryDetailView["attributes"][number]) => {
    setSpecToEdit(attr);
    setCategoryForNewSpec({ id: attr.categoryId, name: selectedCategoryDetail?.name || "" });
    setSpecModalOpen(true);
  };

  const handleSaveSpec = async (data: {
    id?: string;
    categoryId: string;
    name: string;
    type: AttributeType;
    unit: string | null;
    isFilterable: boolean;
    isRequired: boolean;
    initialOptions?: string[];
  }) => {
    if (data.id) {
      // Update
      const res = await fetch(`/api/admin/attributes/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          unit: data.unit,
          isFilterable: data.isFilterable,
          isRequired: data.isRequired,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to update specification.");
      }
      success("Specification Saved", `"${data.name}" has been updated.`);
      await fetchCategoryDetail(data.categoryId);
    } else {
      // Create
      const res = await fetch(`/api/admin/categories/${data.categoryId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          unit: data.unit,
          isFilterable: data.isFilterable,
          isRequired: data.isRequired,
          initialOptions: data.initialOptions,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create specification.");
      }
      success("Specification Added", `"${data.name}" has been created.`);
      await fetchCategoryDetail(data.categoryId);
      await fetchCatalogueTree(data.categoryId);
    }
  };

  const handleDeleteSpec = (attr: CategoryDetailView["attributes"][number]) => {
    setDeleteTarget({
      id: attr.id,
      name: attr.name,
      type: "specification",
      productCount: attr._count?.productAttributeValues || 0,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/attributes/${attr.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to delete specification.");
        }
        success("Specification Removed", `"${attr.name}" has been deleted.`);
        if (selectedCategoryId) {
          await fetchCategoryDetail(selectedCategoryId);
          await fetchCatalogueTree(selectedCategoryId);
        }
      },
    });
    setDeleteModalOpen(true);
  };

  const handleReorderSpecifications = async (items: { id: string; sortOrder: number }[]) => {
    try {
      const res = await fetch("/api/admin/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "attribute", items }),
      });
      const json = await res.json();
      if (json.success) {
        if (selectedCategoryId) {
          await fetchCategoryDetail(selectedCategoryId);
        }
      } else {
        error("Reorder Failed", json.error);
      }
    } catch {
      error("Connection Error", "Could not reorder specifications.");
    }
  };

  // ============================================================================
  // Option Values Operations
  // ============================================================================

  const handleOpenManageOptions = (attr: CategoryDetailView["attributes"][number]) => {
    setSpecForOptions({
      id: attr.id,
      name: attr.name,
      type: attr.type,
      predefinedValues: attr.predefinedValues,
    });
    setOptionsModalOpen(true);
  };

  const handleAddOption = async (attributeId: string, value: string, label: string) => {
    const res = await fetch(`/api/admin/attributes/${attributeId}/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, label }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to add option.");
    }
    success("Option Added", `Added "${label}".`);
    if (selectedCategoryId) {
      await fetchCategoryDetail(selectedCategoryId);
      // Refresh modal state
      setSpecForOptions((prev) =>
        prev
          ? {
              ...prev,
              predefinedValues: [...prev.predefinedValues, json.data],
            }
          : null
      );
    }
  };

  const handleUpdateOption = async (optionId: string, value: string, label: string) => {
    const res = await fetch(`/api/admin/attribute-values/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, label }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to update option.");
    }
    success("Option Updated", `Updated to "${label}".`);
    if (selectedCategoryId) {
      await fetchCategoryDetail(selectedCategoryId);
      setSpecForOptions((prev) =>
        prev
          ? {
              ...prev,
              predefinedValues: prev.predefinedValues.map((o) =>
                o.id === optionId ? { ...o, value, label } : o
              ),
            }
          : null
      );
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    const res = await fetch(`/api/admin/attribute-values/${optionId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to delete option.");
    }
    success("Option Deleted", "Option removed successfully.");
    if (selectedCategoryId) {
      await fetchCategoryDetail(selectedCategoryId);
      setSpecForOptions((prev) =>
        prev
          ? {
              ...prev,
              predefinedValues: prev.predefinedValues.filter((o) => o.id !== optionId),
            }
          : null
      );
    }
  };

  const handleReorderOptions = async (items: { id: string; sortOrder: number }[]) => {
    const res = await fetch("/api/admin/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "option", items }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to reorder options.");
    }
    if (selectedCategoryId) {
      await fetchCategoryDetail(selectedCategoryId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-primary" />
            <span>Category & Specification Management</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Organize your showroom categories and configure dynamic specifications, options, and customer filters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchCatalogueTree(selectedCategoryId)}
            disabled={loadingTree}
            className="p-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition flex items-center gap-1.5"
            title="Refresh catalogue structure"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTree ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddCategory(null)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Root Category</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Category Hierarchy Tree (5 cols) */}
        <div className="lg:col-span-5 h-full">
          <CategoryTree
            categories={tree}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={(cat) => setSelectedCategoryId(cat.id)}
            onAddCategory={(parentId) => handleOpenAddCategory(parentId)}
            onEditCategory={(cat) => handleOpenEditCategory(cat)}
            onToggleActive={(cat) => handleToggleCategoryActive(cat)}
            onDeleteCategory={(cat) => handleDeleteCategory(cat)}
            onReorder={handleReorderCategories}
          />
        </div>

        {/* Right Column: Selected Category Details & Dynamic Specifications (7 cols) */}
        <div className="lg:col-span-7">
          <CategoryDetail
            category={selectedCategoryDetail}
            loading={loadingDetail}
            onEditCategory={(cat) => handleOpenEditCategory(cat)}
            onAddSubcategory={(parentId) => handleOpenAddCategory(parentId)}
            onToggleActive={(cat) => handleToggleCategoryActive(cat)}
            onDeleteCategory={(cat) => handleDeleteCategory(cat)}
            onAddSpecification={(catId, catName) => handleOpenAddSpec(catId, catName)}
            onEditSpecification={(attr) => handleOpenEditSpec(attr)}
            onDeleteSpecification={(attr) => handleDeleteSpec(attr)}
            onManageOptions={(attr) => handleOpenManageOptions(attr)}
            onReorderSpecifications={handleReorderSpecifications}
          />
        </div>
      </div>

      {/* Category Add/Edit Modal */}
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        categoryToEdit={categoryToEdit}
        parentCategoryId={parentForNewCategory}
        flatCategories={flatOptions}
      />

      {/* Dynamic Specification Modal */}
      <SpecificationModal
        isOpen={specModalOpen}
        onClose={() => setSpecModalOpen(false)}
        onSave={handleSaveSpec}
        attributeToEdit={specToEdit}
        categoryId={categoryForNewSpec?.id || selectedCategoryId || ""}
        categoryName={categoryForNewSpec?.name || selectedCategoryDetail?.name || ""}
      />

      {/* Options Management Modal */}
      <OptionsModal
        isOpen={optionsModalOpen}
        onClose={() => setOptionsModalOpen(false)}
        specification={specForOptions}
        onAddOption={handleAddOption}
        onUpdateOption={handleUpdateOption}
        onDeleteOption={handleDeleteOption}
        onReorderOptions={handleReorderOptions}
      />

      {/* Safe Deletion Confirm Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }}
          onConfirm={deleteTarget.onConfirm}
          title={`Delete ${deleteTarget.type === "category" ? "Category" : "Specification"}`}
          itemName={deleteTarget.name}
          itemType={deleteTarget.type}
          childCount={deleteTarget.childCount}
          productCount={deleteTarget.productCount}
        />
      )}
    </div>
  );
}
