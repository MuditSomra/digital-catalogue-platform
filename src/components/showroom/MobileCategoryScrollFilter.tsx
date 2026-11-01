"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { CategoryTreeNode } from "@/types";

interface MobileCategoryScrollFilterProps {
  categories: CategoryTreeNode[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  onOpenAllFilters: () => void;
  hasActiveFilters?: boolean;
}

interface ChipItem {
  key: string;
  type: "all_filters" | "main_category" | "subcategory";
  id: string;
  label: string;
  isSelected: boolean;
  category?: CategoryTreeNode;
}

export function MobileCategoryScrollFilter({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onOpenAllFilters,
  hasActiveFilters = false,
}: MobileCategoryScrollFilterProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);

  // 1. Identify all main categories dynamically (root nodes where parentId === null or undefined)
  const mainCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    const roots = categories.filter((c) => !c.parentId && c.isActive !== false);
    return roots.length > 0 ? roots : categories;
  }, [categories]);

  // 2. Identify currently active main category (contains selectedCategoryId or defaults to first main category)
  const selectedMainCategory = useMemo(() => {
    if (!mainCategories || mainCategories.length === 0) return null;

    if (selectedCategoryId) {
      for (const mainCat of mainCategories) {
        if (mainCat.id === selectedCategoryId) return mainCat;
        const isDescendant = (node: CategoryTreeNode): boolean => {
          if (node.id === selectedCategoryId) return true;
          return (node.children || []).some(isDescendant);
        };
        if ((mainCat.children || []).some(isDescendant)) {
          return mainCat;
        }
      }
    }

    return mainCategories[0];
  }, [mainCategories, selectedCategoryId]);

  // 3. Retrieve only immediate/direct child categories belonging to the selected main category
  const directSubcategories = useMemo(() => {
    if (!selectedMainCategory) return [];
    return (selectedMainCategory.children || []).filter((c) => c.isActive !== false);
  }, [selectedMainCategory]);

  // 4. Construct one continuous sequence of chips:
  // Sequence: All Filters -> All main categories -> direct subcategories of active main category
  const chips: ChipItem[] = useMemo(() => {
    const list: ChipItem[] = [];

    // Chip 1: All Filters button
    list.push({
      key: "all_filters",
      type: "all_filters",
      id: "all_filters",
      label: "All Filters",
      isSelected: false,
    });

    // Chip 2..N: All main-category chips in database order
    // The main-category chip itself acts as the "All products under this main category" filter
    mainCategories.forEach((cat) => {
      const isSelected = selectedCategoryId === cat.id;
      list.push({
        key: `main_${cat.id}`,
        type: "main_category",
        id: cat.id,
        label: cat.name,
        isSelected,
        category: cat,
      });
    });

    // Chip N+1..End: Direct subcategory chips belonging to the currently selected main category
    directSubcategories.forEach((sub) => {
      const isSelected = selectedCategoryId === sub.id;
      list.push({
        key: `sub_${sub.id}`,
        type: "subcategory",
        id: sub.id,
        label: sub.name,
        isSelected,
        category: sub,
      });
    });

    return list;
  }, [mainCategories, directSubcategories, selectedCategoryId]);

  // 5. Handle chip click interactions
  const handleChipClick = (chip: ChipItem) => {
    if (chip.type === "all_filters") {
      onOpenAllFilters();
      return;
    }

    if (chip.type === "main_category" || chip.type === "subcategory") {
      onSelectCategory(chip.id);
      return;
    }
  };

  // 6. Measure horizontal scroll bounds and calculate scroll indicator progress
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 1) {
      setCanScroll(true);
      setScrollProgress(Math.min(1, Math.max(0, el.scrollLeft / maxScroll)));
    } else {
      setCanScroll(false);
      setScrollProgress(0);
    }
  }, []);

  const handleScroll = () => {
    updateScrollState();
  };

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState, chips]);

  // 7. Auto-scroll to ensure selected category chip is brought into view
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Use requestAnimationFrame to ensure layout positions have updated
    const raf = requestAnimationFrame(() => {
      const activeEl = container.querySelector('[data-selected="true"]') as HTMLElement | null;
      if (activeEl) {
        const containerLeft = container.scrollLeft;
        const containerRight = containerLeft + container.clientWidth;
        const elLeft = activeEl.offsetLeft;
        const elRight = elLeft + activeEl.offsetWidth;

        if (elLeft < containerLeft) {
          container.scrollTo({ left: Math.max(0, elLeft - 20), behavior: "smooth" });
        } else if (elRight > containerRight) {
          container.scrollTo({ left: elRight - container.clientWidth + 20, behavior: "smooth" });
        }
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [selectedCategoryId]);

  return (
    <div className="w-full">
      {/* 2-Row Horizontal Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 -mx-4 px-4 sm:-mx-6 sm:px-6"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="grid grid-flow-col auto-cols-max gap-2"
          style={{
            gridTemplateRows: "repeat(2, 34px)",
          }}
        >
          {chips.map((chip) => {
            if (chip.type === "all_filters") {
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={onOpenAllFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 h-[34px] rounded-full bg-[#16852B] hover:bg-[#137425] active:bg-[#0f5c1d] text-white text-xs font-semibold shadow-xs shrink-0 cursor-pointer transition select-none"
                  title="Open all filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
                  <span>All Filters</span>
                  {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />
                  )}
                </button>
              );
            }

            if (chip.isSelected) {
              return (
                <button
                  key={chip.key}
                  type="button"
                  data-selected="true"
                  onClick={() => handleChipClick(chip)}
                  className="inline-flex items-center justify-center px-3.5 h-[34px] rounded-full bg-[#16852B] text-white text-xs font-semibold border border-[#16852B] shadow-2xs shrink-0 cursor-pointer transition select-none"
                >
                  <span>{chip.label}</span>
                </button>
              );
            }

            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="inline-flex items-center justify-center px-3.5 h-[34px] rounded-full bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 hover:border-slate-300 shadow-2xs shrink-0 cursor-pointer transition select-none"
              >
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtle Horizontal Scroll Indicator */}
      {canScroll && (
        <div className="flex justify-center mt-2">
          <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-[#16852B] rounded-full transition-transform duration-75"
              style={{
                width: "18px",
                transform: `translateX(${scrollProgress * (48 - 18)}px)`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
