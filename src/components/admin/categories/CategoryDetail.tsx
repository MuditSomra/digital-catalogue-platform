"use client";

import React, { useState } from "react";
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Tag,
  CheckCircle2,
  Filter,
  Star,
  ArrowUp,
  ArrowDown,
  ListFilter,
  ChevronRight,
  Sparkles,
  Package,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  CategoryDetailView,
  AttributeType,
  ATTRIBUTE_TYPE_LABELS,
} from "@/types";

interface CategoryDetailProps {
  category: CategoryDetailView | null;
  loading: boolean;
  onEditCategory: (category: CategoryDetailView) => void;
  onAddSubcategory: (parentId: string) => void;
  onToggleActive: (category: CategoryDetailView) => void;
  onDeleteCategory: (category: CategoryDetailView) => void;
  onAddSpecification: (categoryId: string, categoryName: string) => void;
  onEditSpecification: (attribute: CategoryDetailView["attributes"][number]) => void;
  onDeleteSpecification: (attribute: CategoryDetailView["attributes"][number]) => void;
  onManageOptions: (attribute: CategoryDetailView["attributes"][number]) => void;
  onReorderSpecifications: (items: { id: string; sortOrder: number }[]) => Promise<void>;
}

export function CategoryDetail({
  category,
  loading,
  onEditCategory,
  onAddSubcategory,
  onToggleActive,
  onDeleteCategory,
  onAddSpecification,
  onEditSpecification,
  onDeleteSpecification,
  onManageOptions,
  onReorderSpecifications,
}: CategoryDetailProps) {
  const [reordering, setReordering] = useState(false);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading category details...</p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="bg-card/40 border border-dashed border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
          <Layers className="w-7 h-7" />
        </div>
        <div className="max-w-sm space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            No Category Selected
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Click on any category in the tree on the left to view its details, manage subcategories, and configure dynamic product specifications.
          </p>
        </div>
      </div>
    );
  }

  const handleMoveSpec = async (
    index: number,
    direction: "up" | "down"
  ) => {
    const list = [...category.attributes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const payload = list.map((attr, idx) => ({
      id: attr.id,
      sortOrder: idx + 1,
    }));

    try {
      setReordering(true);
      await onReorderSpecifications(payload);
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Category Overview Card */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
        {/* Breadcrumb path */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {category.breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
              <span
                className={
                  idx === category.breadcrumbs.length - 1
                    ? "font-semibold text-primary"
                    : "hover:text-foreground transition"
                }
              >
                {crumb.name}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Title, Status, and Top Actions */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {category.name}
              </h2>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  category.isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {category.isActive ? "Active" : "Disabled"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              {category.description || "No description set for this category."}
            </p>
          </div>

          {/* Quick Category Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAddSubcategory(category.id)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subcategory</span>
            </button>

            <button
              type="button"
              onClick={() => onEditCategory(category)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleActive(category)}
              className="p-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition"
              title={category.isActive ? "Disable category" : "Enable category"}
            >
              {category.isActive ? (
                <Eye className="w-4 h-4 text-emerald-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onDeleteCategory(category)}
              className="p-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
              title="Delete category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Statistics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-foreground">{category._count.children}</div>
              <div className="text-[11px] text-muted-foreground">Subcategories</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-foreground">{category._count.products}</div>
              <div className="text-[11px] text-muted-foreground">Assigned Products</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-foreground">{category.attributes.length}</div>
              <div className="text-[11px] text-muted-foreground">Specifications</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Dynamic Specifications Section */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Dynamic Specifications
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Define the attributes, filters, and choices available for products in &quot;{category.name}&quot;.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onAddSpecification(category.id, category.name)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Specification</span>
          </button>
        </div>

        {/* Specifications List */}
        {category.attributes.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border text-muted-foreground space-y-3 bg-muted/5">
            <SlidersHorizontal className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <div className="max-w-sm mx-auto space-y-1">
              <p className="text-xs font-semibold text-foreground">
                No specifications created yet
              </p>
              <p className="text-[11px] text-muted-foreground">
                Add dynamic specifications (e.g. Burner Count, Material, Power, Ignition) to enable filters and structured specs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddSpecification(category.id, category.name)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition border border-border"
            >
              + Add First Specification
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {category.attributes.map((attr, index) => {
              const isSelectType =
                attr.type === AttributeType.SELECT || attr.type === AttributeType.MULTI_SELECT;

              return (
                <div
                  key={attr.id}
                  className="p-4 rounded-xl bg-background border border-border hover:border-border/80 transition space-y-3 group"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {attr.name}
                        </span>

                        {/* Human Friendly Type Badge */}
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-foreground font-medium border border-border">
                          {ATTRIBUTE_TYPE_LABELS[attr.type]}
                        </span>

                        {/* Unit Badge */}
                        {attr.unit && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                            Unit: {attr.unit}
                          </span>
                        )}

                        {/* Customer Filter Badge */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            attr.isFilterable
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          <Filter className="w-2.5 h-2.5" />
                          Filter: {attr.isFilterable ? "ON" : "OFF"}
                        </span>

                        {/* Required Badge */}
                        {attr.isRequired && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Required: YES
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Move Up / Down */}
                      <button
                        type="button"
                        onClick={() => handleMoveSpec(index, "up")}
                        disabled={index === 0 || reordering}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:hover:bg-transparent transition"
                        title="Move specification up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSpec(index, "down")}
                        disabled={index === category.attributes.length - 1 || reordering}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:hover:bg-transparent transition"
                        title="Move specification down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Manage Options button (if select type) */}
                      {isSelectType && (
                        <button
                          type="button"
                          onClick={() => onManageOptions(attr)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition flex items-center gap-1"
                          title="Configure choices"
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          <span>Options ({attr.predefinedValues.length})</span>
                        </button>
                      )}

                      {/* Edit Specification */}
                      <button
                        type="button"
                        onClick={() => onEditSpecification(attr)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Edit specification"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Specification */}
                      <button
                        type="button"
                        onClick={() => onDeleteSpecification(attr)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete specification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Options Chips Preview (for Select types) */}
                  {isSelectType && (
                    <div className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] text-muted-foreground font-medium mr-1">
                        Choices:
                      </span>
                      {attr.predefinedValues.length === 0 ? (
                        <span className="text-[11px] text-amber-400/80 italic">
                          No options added yet. Click &quot;Options&quot; to add choices.
                        </span>
                      ) : (
                        attr.predefinedValues.map((opt) => (
                          <span
                            key={opt.id}
                            className="px-2 py-0.5 rounded-md bg-secondary text-foreground text-[11px] border border-border"
                          >
                            {opt.label}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
