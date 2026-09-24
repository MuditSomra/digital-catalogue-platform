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
  onReorder: (items: { id: string; sortOrder: number }[]) => Promise<void>;
}

export function CategoryTree({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onToggleActive,
  onDeleteCategory,
  onReorder,
}: CategoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id))
  );
  const [searchQuery, setSearchQuery] = useState("");

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
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
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
      <div key={node.id} className="select-none">
        {/* Category Node Row */}
        <div
          onClick={() => onSelectCategory(node)}
          style={{ paddingLeft: `${Math.max(8, depth * 20 + 8)}px` }}
          className={`group flex items-center justify-between py-2 pr-3 rounded-xl cursor-pointer transition-all duration-150 text-xs border ${
            isSelected
              ? "bg-primary/15 border-primary/30 text-primary font-semibold shadow-xs"
              : "border-transparent hover:bg-card hover:border-border/80 text-foreground"
          } ${!node.isActive ? "opacity-60 bg-muted/10" : ""}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Expand / Collapse Chevron */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                aria-label={isExpanded ? "Collapse branch" : "Expand branch"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="w-5.5 h-3.5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              </div>
            )}

            {/* Folder Icon */}
            {isExpanded && hasChildren ? (
              <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-amber-400/80"}`} />
            ) : (
              <Folder className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-amber-400/80"}`} />
            )}

            {/* Category Name */}
            <span className="truncate text-xs">{node.name}</span>

            {/* Status & Counts Badges */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {!node.isActive && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                  Disabled
                </span>
              )}
              {node._count.products > 0 && (
                <span
                  title={`${node._count.products} products`}
                  className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
                >
                  <Package className="w-2.5 h-2.5" />
                  {node._count.products}
                </span>
              )}
              {node._count.attributes > 0 && (
                <span
                  title={`${node._count.attributes} dynamic specifications`}
                  className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border flex items-center gap-1"
                >
                  <Tag className="w-2.5 h-2.5 text-primary/70" />
                  {node._count.attributes}
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Buttons (Always visible or on hover) */}
          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
            {/* Move Up / Down */}
            <button
              type="button"
              onClick={(e) => handleMove(siblings, index, "up", e)}
              disabled={index === 0}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:hover:bg-transparent"
              title="Move category up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleMove(siblings, index, "down", e)}
              disabled={index === siblings.length - 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:hover:bg-transparent"
              title="Move category down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>

            {/* Add Subcategory under this node */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddCategory(node.id);
              }}
              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
              title="Add subcategory under this category"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Edit Category */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditCategory(node);
              }}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="Edit category"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Status */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive(node);
              }}
              className={`p-1 rounded transition ${
                node.isActive
                  ? "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                  : "text-amber-400 hover:text-emerald-400 hover:bg-emerald-500/10"
              }`}
              title={node.isActive ? "Disable category" : "Enable category"}
            >
              {node.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Delete Category */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCategory(node);
              }}
              className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="Delete category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Children (Subcategories) */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5 mt-0.5 border-l border-border/40 ml-4 pl-1">
            {node.children.map((child, idx) =>
              renderNode(child, node.children, idx, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card/60 border border-border rounded-2xl overflow-hidden shadow-xs">
      {/* Search & Tree Header Controls */}
      <div className="p-3.5 border-b border-border space-y-3 bg-card/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Catalogue Hierarchy</span>
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
            className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Categories Tree Node List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-0.5 max-h-[calc(100vh-280px)] min-h-[400px]">
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
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              + Add Category
            </button>
          </div>
        ) : (
          categories.map((cat, idx) => renderNode(cat, categories, idx, 0))
        )}
      </div>

      {/* Tree Footer / Quick Add Action */}
      <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {categories.length} Top-level Categories
        </span>
        <button
          type="button"
          onClick={() => onAddCategory(null)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Top Category</span>
        </button>
      </div>
    </div>
  );
}
