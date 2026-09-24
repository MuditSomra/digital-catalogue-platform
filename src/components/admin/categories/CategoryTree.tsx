"use client";

import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Layers,
  ArrowUp,
  ArrowDown,
  Tag,
  Package,
  MoreVertical,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { CategoryTreeNode } from "@/types";

interface CategoryTreeProps {
  categories: CategoryTreeNode[];
  selectedCategoryId: string | null;
  onSelectCategory: (category: CategoryTreeNode) => void;
  onAddCategory: (parentId?: string | null) => void;
  onEditCategory: (category: CategoryTreeNode) => void;
  onToggleActive: (category: CategoryTreeNode) => void;
  onDeleteCategory: (category: CategoryTreeNode) => void;
  onAddSpecification?: (categoryId: string, categoryName: string) => void;
  onReorder: (items: { id: string; sortOrder: number }[]) => Promise<void>;
}

interface ActiveMenuState {
  node: CategoryTreeNode;
  siblings: CategoryTreeNode[];
  index: number;
}

export function CategoryTree({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onToggleActive,
  onDeleteCategory,
  onAddSpecification,
  onReorder,
}: CategoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    function collect(nodes: CategoryTreeNode[]) {
      for (const n of nodes) {
        allIds.add(n.id);
        if (n.children.length > 0) collect(n.children);
      }
    }
    collect(categories);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleMove = async (
    siblings: CategoryTreeNode[],
    index: number,
    direction: "up" | "down",
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const copy = [...siblings];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const payload = copy.map((cat, idx) => ({
      id: cat.id,
      sortOrder: idx + 1,
    }));

    await onReorder(payload);
  };

  // Filter helper: returns true if node or any of its descendants match search
  function matchesSearch(node: CategoryTreeNode, q: string): boolean {
    if (!q) return true;
    if (node.name.toLowerCase().includes(q.toLowerCase())) return true;
    return node.children.some((child) => matchesSearch(child, q));
  }

  const renderNode = (
    node: CategoryTreeNode,
    siblings: CategoryTreeNode[],
    index: number,
    depth: number = 0
  ) => {
    if (searchQuery && !matchesSearch(node, searchQuery)) {
      return null;
    }

    const isExpanded = expandedIds.has(node.id) || Boolean(searchQuery);
    const isSelected = selectedCategoryId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none my-1">
        {/* Category Node Row: Compact action button gives maximum horizontal space to readable category names */}
        <div
          onClick={() => onSelectCategory(node)}
          style={{
            paddingLeft: `calc(0.375rem + ${depth} * clamp(8px, 2vw, 14px))`,
          }}
          className={`group flex items-center justify-between min-h-[46px] py-2 pr-2.5 rounded-xl cursor-pointer transition-all duration-150 text-xs border ${
            isSelected
              ? "bg-primary/15 border-primary/30 text-primary font-semibold shadow-xs"
              : "border-border/40 bg-card/40 hover:bg-card hover:border-border/80 text-foreground"
          } ${!node.isActive ? "opacity-60 bg-muted/10" : ""}`}
        >
          {/* Left: Chevron + Folder + Category Name + Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 pr-2">
            {/* Expand / Collapse Chevron Tap Target (Accessible 32px zone) */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="w-7 h-7 sm:w-8 sm:h-8 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 active:bg-muted flex items-center justify-center shrink-0 transition"
                aria-label={isExpanded ? "Collapse branch" : "Expand branch"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 -ml-1 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            {/* Folder Icon */}
            <div className="shrink-0">
              {isExpanded && hasChildren ? (
                <FolderOpen className={`w-4 h-4 ${isSelected ? "text-primary" : "text-amber-400/80"}`} />
              ) : (
                <Folder className={`w-4 h-4 ${isSelected ? "text-primary" : "text-amber-400/80"}`} />
              )}
            </div>

            {/* Category Name & Badges: Wrap gracefully without being crushed by inline buttons */}
            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs sm:text-[13px] font-medium text-foreground group-hover:text-foreground line-clamp-2 break-words leading-tight">
                {node.name}
              </span>

              {/* Status & Count Badges */}
              <div className="inline-flex items-center gap-1 shrink-0">
                {!node.isActive && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                    Disabled
                  </span>
                )}
                {node._count.products > 0 && (
                  <span
                    title={`${node._count.products} products`}
                    className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-0.5 font-normal"
                  >
                    <Package className="w-2.5 h-2.5" />
                    {node._count.products}
                  </span>
                )}
                {node._count.attributes > 0 && (
                  <span
                    title={`${node._count.attributes} dynamic specifications`}
                    className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border flex items-center gap-0.5 font-normal"
                  >
                    <Tag className="w-2.5 h-2.5 text-primary/70" />
                    {node._count.attributes}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Unified Single Overflow Menu Button (⋮) on Desktop, Tablet & Mobile */}
          <div className="shrink-0 flex items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu({ node, siblings, index });
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 active:bg-muted transition"
              aria-label={`Category actions for ${node.name}`}
              title="Category Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Children (Subcategories) with clean nesting guides */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 mt-1 border-l border-border/50 ml-2.5 pl-1 sm:ml-3.5 sm:pl-1.5">
            {node.children.map((child, idx) =>
              renderNode(child, node.children, idx, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full bg-card/60 border border-border rounded-2xl overflow-hidden shadow-xs">
        {/* Search & Tree Header Controls */}
        <div className="p-3.5 border-b border-border space-y-3 bg-card/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-bold text-foreground">Catalogue Hierarchy</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={expandAll}
                className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Expand All
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Collapse
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Categories Tree Node List */}
        <div className="flex-1 p-2 sm:p-3 overflow-y-auto overflow-x-hidden space-y-0.5 max-h-[calc(100vh-260px)] min-h-[350px]">
          {categories.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-xs text-muted-foreground">
                No categories found. Start by creating your first root category.
              </p>
              <button
                type="button"
                onClick={() => onAddCategory(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
              >
                + Add Category
              </button>
            </div>
          ) : (
            categories.map((cat, idx) => renderNode(cat, categories, idx, 0))
          )}
        </div>

        {/* Tree Footer / Quick Add Action */}
        <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground truncate">
            {categories.length} Top Categories
          </span>
          <button
            type="button"
            onClick={() => onAddCategory(null)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Category Actions Dialog / Sheet (Triggered via ⋮ Menu) */}
      {activeMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setActiveMenu(null)}
            aria-hidden="true"
          />

          {/* Action Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden z-10 animate-in slide-in-from-bottom-5 duration-200"
          >
            {/* Action Sheet Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="min-w-0 pr-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Category Actions
                </div>
                <h3 className="text-sm font-bold text-foreground truncate mt-0.5">
                  {activeMenu.node.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveMenu(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                aria-label="Close action menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Sheet List Items */}
            <div className="p-3 space-y-1 max-h-[70vh] overflow-y-auto">
              {/* Select Category to view details */}
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(activeMenu.node);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-primary/15 hover:text-primary transition text-left"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold">View Details & Specifications</div>
                  <div className="text-[11px] text-muted-foreground">Open category panel on right</div>
                </div>
              </button>

              {/* Add Subcategory */}
              <button
                type="button"
                onClick={() => {
                  const nodeId = activeMenu.node.id;
                  setActiveMenu(null);
                  onAddCategory(nodeId);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-muted/70 transition text-left"
              >
                <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Add Subcategory</div>
                  <div className="text-[11px] text-muted-foreground">Create a child category under this one</div>
                </div>
              </button>

              {/* Add Specification */}
              {onAddSpecification && (
                <button
                  type="button"
                  onClick={() => {
                    const node = activeMenu.node;
                    setActiveMenu(null);
                    onAddSpecification(node.id, node.name);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-muted/70 transition text-left"
                >
                  <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">Add Specification</div>
                    <div className="text-[11px] text-muted-foreground">Define a new filter or product attribute</div>
                  </div>
                </button>
              )}

              {/* Edit Category */}
              <button
                type="button"
                onClick={() => {
                  const node = activeMenu.node;
                  setActiveMenu(null);
                  onEditCategory(node);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-muted/70 transition text-left"
              >
                <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold">Edit Category</div>
                  <div className="text-[11px] text-muted-foreground">Rename, change parent or description</div>
                </div>
              </button>

              {/* Move Up */}
              <button
                type="button"
                disabled={activeMenu.index === 0}
                onClick={async () => {
                  const { siblings, index } = activeMenu;
                  setActiveMenu(null);
                  await handleMove(siblings, index, "up");
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-muted/70 disabled:opacity-40 disabled:hover:bg-transparent transition text-left"
              >
                <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                  <ArrowUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold">Move Up</div>
                  <div className="text-[11px] text-muted-foreground">Move higher in display order</div>
                </div>
              </button>

              {/* Move Down */}
              <button
                type="button"
                disabled={activeMenu.index === activeMenu.siblings.length - 1}
                onClick={async () => {
                  const { siblings, index } = activeMenu;
                  setActiveMenu(null);
                  await handleMove(siblings, index, "down");
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-muted/70 disabled:opacity-40 disabled:hover:bg-transparent transition text-left"
              >
                <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                  <ArrowDown className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold">Move Down</div>
                  <div className="text-[11px] text-muted-foreground">Move lower in display order</div>
                </div>
              </button>

              {/* Enable / Disable */}
              <button
                type="button"
                onClick={() => {
                  const node = activeMenu.node;
                  setActiveMenu(null);
                  onToggleActive(node);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-foreground hover:bg-muted/70 transition text-left"
              >
                <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                  {activeMenu.node.isActive ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="font-semibold">
                    {activeMenu.node.isActive ? "Disable Category" : "Enable Category"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {activeMenu.node.isActive ? "Hide from customer view" : "Make visible to customers"}
                  </div>
                </div>
              </button>

              {/* Delete Category */}
              <button
                type="button"
                onClick={() => {
                  const node = activeMenu.node;
                  setActiveMenu(null);
                  onDeleteCategory(node);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition text-left"
              >
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-rose-400">Delete Category</div>
                  <div className="text-[11px] text-rose-400/80">Safely remove if empty</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
