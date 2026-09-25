"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, Layers, CornerDownRight, AlertCircle } from "lucide-react";
import type { CategoryTreeNode, FlatCategoryOption } from "@/types";

export interface NormalizedCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children: NormalizedCategoryNode[];
  sortOrder?: number;
  isActive?: boolean;
  isDisabled?: boolean;
}

export interface CascadingCategorySelectProps {
  /**
   * Currently selected category ID.
   */
  value?: string | null;

  /**
   * Callback when selection changes.
   * Passes the final selected category ID (or null/empty) and the node if found.
   */
  onChange: (categoryId: string | null, category?: NormalizedCategoryNode | null) => void;

  /**
   * Category data: can be tree nodes (CategoryTreeNode[]) or flat category list.
   * If not provided, it will automatically fetch from `/api/admin/categories`.
   */
  categories?: CategoryTreeNode[] | FlatCategoryOption[] | any[];

  /**
   * Category ID to exclude along with all its descendants (for category editing to prevent circular hierarchy).
   */
  excludeCategoryId?: string | null;

  /**
   * If true, root level can be selected as null/none (e.g. for parent category selection in CategoryModal).
   * Default: false (for product form where a category must be selected).
   */
  allowRootSelection?: boolean;

  /**
   * Custom label for the root / empty option in the first dropdown.
   * Default: "(None - Top Level Root Category)" if allowRootSelection is true, or "Select Category..." if false.
   */
  rootLabel?: string;

  /**
   * Placeholder label for child dropdowns.
   * E.g. "Select Subcategory..." or custom string.
   */
  subCategoryPlaceholder?: string;

  /**
   * Mode for table filter bars.
   * In filter mode, selecting root sets filter to root, selecting subcategory sets filter to subcategory,
   * and first option is "All Categories", child first option is "All [Parent Name]".
   */
  isFilterMode?: boolean;

  /**
   * Whether to show level labels above each dropdown (e.g., "Main Category", "Subcategory").
   * Default: true for vertical modals, false for filter mode.
   */
  showLevelLabels?: boolean;

  /**
   * Custom labels for levels, e.g. ["Category", "Subcategory", "Sub-subcategory"]
   */
  levelLabels?: string[];

  /**
   * Layout style: "vertical" (stacked with indentation or labels) or "horizontal" (flex row for filter bars) or "responsive".
   * Default: "vertical" (or "horizontal" if isFilterMode=true).
   */
  layout?: "vertical" | "horizontal" | "responsive";

  /**
   * Input sizing: "sm" (for table filter bars) or "md" (for modals/forms).
   * Default: "md" (or "sm" if isFilterMode=true).
   */
  size?: "sm" | "md";

  /**
   * Whether the select is required (for HTML form validation).
   */
  required?: boolean;

  /**
   * Disabled state for all dropdowns.
   */
  disabled?: boolean;

  /**
   * Show a subtle breadcrumb trail chip underneath the dropdowns.
   * Default: false
   */
  showPathPreview?: boolean;

  /**
   * Additional CSS class name for container.
   */
  className?: string;

  /**
   * Custom ID prefix for DOM elements.
   */
  idPrefix?: string;
}

const EMPTY_ARRAY: any[] = [];
const EMPTY_MAP = new Map<string, NormalizedCategoryNode>();

/**
 * Normalizes any category input (Tree array or flat array) into a structured tree + lookup map,
 * and recursively excludes any subtrees rooted at `excludeId`.
 */
function normalizeCategories(
  items: any[] | undefined,
  excludeId?: string | null
): {
  tree: NormalizedCategoryNode[];
  map: Map<string, NormalizedCategoryNode>;
} {
  if (!items || items.length === 0) {
    return { tree: EMPTY_ARRAY, map: EMPTY_MAP };
  }

  const map = new Map<string, NormalizedCategoryNode>();

  // Collect all nodes into map
  function collectNodes(nodes: any[]) {
    for (const node of nodes) {
      if (!node || !node.id) continue;
      if (!map.has(node.id)) {
        map.set(node.id, {
          id: node.id,
          name: node.name,
          parentId: node.parentId || null,
          children: [],
          sortOrder: node.sortOrder ?? 0,
          isActive: node.isActive ?? true,
          isDisabled: Boolean(node.isDisabled),
        });
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        collectNodes(node.children);
      }
    }
  }

  collectNodes(items);

  // Find all excluded IDs (excludeId + all its descendants to prevent circular parenting)
  const excludedIds = new Set<string>();
  if (excludeId) {
    excludedIds.add(excludeId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, node] of map.entries()) {
        if (node.parentId && excludedIds.has(node.parentId) && !excludedIds.has(id)) {
          excludedIds.add(id);
          changed = true;
        }
      }
    }
  }

  // Reset children arrays
  for (const node of map.values()) {
    node.children = [];
  }

  // Build clean hierarchy
  const rootTree: NormalizedCategoryNode[] = [];
  const allNodes = Array.from(map.values()).sort((a, b) => {
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }
    return a.name.localeCompare(b.name);
  });

  for (const node of allNodes) {
    if (excludedIds.has(node.id)) {
      node.isDisabled = true;
      continue;
    }
    if (node.parentId && map.has(node.parentId) && !excludedIds.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else if (!node.parentId || excludedIds.has(node.parentId)) {
      rootTree.push(node);
    }
  }

  return { tree: rootTree, map };
}

/**
 * Resolves the full chain of category IDs from the root down to targetId.
 */
function getAncestorPath(
  targetId: string | null | undefined,
  map: Map<string, NormalizedCategoryNode>
): string[] {
  if (!targetId || !map.has(targetId)) return EMPTY_ARRAY;
  const path: string[] = [];
  let currId: string | null = targetId;
  const visited = new Set<string>();

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    path.unshift(currId);
    const node = map.get(currId);
    currId = node?.parentId || null;
  }
  return path;
}

export function CascadingCategorySelect({
  value,
  onChange,
  categories,
  excludeCategoryId,
  allowRootSelection = false,
  rootLabel,
  subCategoryPlaceholder,
  isFilterMode = false,
  showLevelLabels,
  levelLabels,
  layout,
  size,
  required = false,
  disabled = false,
  showPathPreview = false,
  className = "",
  idPrefix = "cascading-category",
}: CascadingCategorySelectProps) {
  // Determine layout and size defaults
  const effectiveLayout = layout || (isFilterMode ? "responsive" : "vertical");
  const effectiveSize = size || (isFilterMode ? "sm" : "md");
  const shouldShowLabels =
    showLevelLabels !== undefined
      ? showLevelLabels
      : effectiveLayout === "vertical" && !isFilterMode;

  // Internal fetched state in case categories prop was not provided
  const [internalTree, setInternalTree] = useState<CategoryTreeNode[] | null>(null);

  useEffect(() => {
    if (categories === undefined) {
      let isMounted = true;
      async function loadTree() {
        try {
          const res = await fetch("/api/admin/categories");
          const json = await res.json();
          if (isMounted && json.success && json.data?.tree) {
            setInternalTree(json.data.tree);
          }
        } catch (err) {
          console.error("CascadingCategorySelect: Failed to load categories", err);
        }
      }
      loadTree();
      return () => {
        isMounted = false;
      };
    }
  }, [categories]);

  // Normalize data to tree and lookup map
  const rawData = categories !== undefined ? categories : (internalTree || EMPTY_ARRAY);
  const { tree, map } = useMemo(() => {
    return normalizeCategories(rawData, excludeCategoryId);
  }, [rawData, excludeCategoryId]);

  // Selected path state: array of category IDs from level 0 down to deepest selected
  const [selectedPath, setSelectedPath] = useState<string[]>(() => {
    return getAncestorPath(value, map);
  });

  // Keep selectedPath in sync when external `value` or `map` changes
  useEffect(() => {
    if (!value) {
      setSelectedPath((prev) => (prev.length === 0 ? prev : EMPTY_ARRAY));
      return;
    }

    if (map.has(value)) {
      const targetPath = getAncestorPath(value, map);
      setSelectedPath((prev) => {
        if (
          prev.length === targetPath.length &&
          prev.every((id, idx) => id === targetPath[idx])
        ) {
          return prev;
        }
        return targetPath;
      });
    }
  }, [value, map]);

  // Handle change at a specific dropdown level
  const handleLevelChange = useCallback(
    (levelIndex: number, newSelectedId: string) => {
      let newPath: string[];

      if (!newSelectedId) {
        // User selected the placeholder/empty option
        // Truncate path to only parents above this level
        newPath = selectedPath.slice(0, levelIndex);
        setSelectedPath(newPath);

        const effectiveId =
          newPath.length > 0 ? newPath[newPath.length - 1] : null;

        if (isFilterMode) {
          onChange(effectiveId || "", effectiveId ? map.get(effectiveId) || null : null);
        } else if (allowRootSelection) {
          onChange(effectiveId, effectiveId ? map.get(effectiveId) || null : null);
        } else {
          // In required product selection mode, if level 0 cleared, set null/""
          onChange(effectiveId, effectiveId ? map.get(effectiveId) || null : null);
        }
      } else {
        // User selected a valid category at this level
        newPath = [...selectedPath.slice(0, levelIndex), newSelectedId];
        setSelectedPath(newPath);

        const selectedNode = map.get(newSelectedId) || null;
        onChange(newSelectedId, selectedNode);
      }
    },
    [selectedPath, map, onChange, isFilterMode, allowRootSelection]
  );

  // Calculate the list of dropdown levels to render
  const levelsToRender = useMemo(() => {
    const list: Array<{
      level: number;
      label: string;
      placeholder: string;
      selectedId: string;
      options: NormalizedCategoryNode[];
    }> = [];

    if (tree.length === 0) return list;

    // Level 0: Root categories
    const rootPlaceholder = isFilterMode
      ? (rootLabel || "All Categories")
      : allowRootSelection
      ? (rootLabel || "(None - Top Level Root Category)")
      : (rootLabel || "Select Category...");

    const rootSelectedId = selectedPath[0] || "";

    list.push({
      level: 0,
      label: levelLabels?.[0] || "Main Category",
      placeholder: rootPlaceholder,
      selectedId: rootSelectedId,
      options: tree,
    });

    // Subsequent levels
    for (let i = 0; i < selectedPath.length; i++) {
      const parentId = selectedPath[i];
      if (!parentId) break;

      const parentNode = map.get(parentId);
      if (parentNode && parentNode.children && parentNode.children.length > 0) {
        const childSelectedId = selectedPath[i + 1] || "";
        const defaultPlaceholder = isFilterMode
          ? `All ${parentNode.name}`
          : allowRootSelection
          ? (subCategoryPlaceholder || `(No subcategory - Use "${parentNode.name}")`)
          : (subCategoryPlaceholder || "Select Subcategory...");

        list.push({
          level: i + 1,
          label:
            levelLabels?.[i + 1] ||
            (i === 0 ? "Subcategory" : `Subcategory (Level ${i + 2})`),
          placeholder: defaultPlaceholder,
          selectedId: childSelectedId,
          options: parentNode.children,
        });
      }
    }

    return list;
  }, [
    tree,
    map,
    selectedPath,
    isFilterMode,
    allowRootSelection,
    rootLabel,
    subCategoryPlaceholder,
    levelLabels,
  ]);

  // CSS Styles based on size and layout
  const selectSizeClasses =
    effectiveSize === "sm"
      ? "px-3 py-2 text-xs rounded-xl"
      : "px-3.5 py-2.5 text-sm rounded-xl";

  const selectInputClass = `w-full ${selectSizeClasses} bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition min-w-0`;

  const containerLayoutClass =
    effectiveLayout === "vertical"
      ? "space-y-3 w-full"
      : effectiveLayout === "responsive"
      ? "flex flex-wrap items-center gap-2.5 w-full"
      : "flex items-center gap-2.5 w-full overflow-x-auto";

  const levelContainerClass =
    effectiveLayout === "vertical"
      ? "space-y-1.5 w-full"
      : "flex-1 min-w-[170px] max-w-full space-y-1";

  return (
    <div className={`cascading-category-select-wrapper ${className}`}>
      <div className={containerLayoutClass}>
        {levelsToRender.map((lvl, index) => {
          return (
            <div key={lvl.level} className={levelContainerClass}>
              {shouldShowLabels && (
                <label
                  htmlFor={`${idPrefix}-level-${lvl.level}`}
                  className="block text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 truncate"
                >
                  {index > 0 && (
                    <CornerDownRight className="w-3 h-3 text-primary/70 shrink-0 inline" />
                  )}
                  <span>{lvl.label}</span>
                </label>
              )}
              <select
                id={`${idPrefix}-level-${lvl.level}`}
                value={lvl.selectedId}
                onChange={(e) => handleLevelChange(lvl.level, e.target.value)}
                disabled={disabled}
                required={
                  required &&
                  lvl.level === 0 &&
                  !allowRootSelection &&
                  !isFilterMode
                }
                className={selectInputClass}
              >
                {/* Placeholder / Empty Option */}
                <option
                  value=""
                  disabled={
                    !allowRootSelection &&
                    !isFilterMode &&
                    lvl.level === 0 &&
                    required
                  }
                >
                  {lvl.placeholder}
                </option>

                {/* Direct child options for this level */}
                {lvl.options.map((opt) => (
                  <option key={opt.id} value={opt.id} disabled={opt.isDisabled}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Optional Breadcrumb Path Preview */}
      {showPathPreview && selectedPath.length > 0 && (
        <div className="mt-2 flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60">
          <span className="font-medium text-foreground/80">Selected Path:</span>
          {selectedPath.map((id, idx) => {
            const node = map.get(id);
            if (!node) return null;
            return (
              <React.Fragment key={id}>
                {idx > 0 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                )}
                <span
                  className={
                    idx === selectedPath.length - 1
                      ? "font-semibold text-primary"
                      : "text-foreground/70"
                  }
                >
                  {node.name}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
