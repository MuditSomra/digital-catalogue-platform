"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Tag,
  Layers,
  Sparkles,
  Info,
  DollarSign,
  ShieldCheck,
  Percent,
  Image as ImageIcon,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import type {
  BrandOption,
  ProductAdminDetailView,
  ProductListItem,
  AttributeType,
  CategoryTreeNode,
  FlatCategoryOption,
} from "@/types";
import {
  parseProductImport,
  matchBrand,
  matchCategory,
  matchDynamicCategoryAttributes,
  isValidValue,
  CHATGPT_PRODUCT_EXTRACTION_PROMPT,
} from "@/lib/product-import-parser";
import { BrandModal } from "./BrandModal";
import { ProductMediaManager } from "./ProductMediaManager";
import { CascadingCategorySelect } from "@/components/ui/CascadingCategorySelect";

interface PredefinedValue {
  id: string;
  attributeId: string;
  value: string;
  label: string;
  sortOrder: number;
}

interface CategoryAttributeItem {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  type: AttributeType;
  unit: string | null;
  isFilterable: boolean;
  isRequired: boolean;
  sortOrder: number;
  predefinedValues: PredefinedValue[];
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  productToEdit?: ProductAdminDetailView | ProductListItem | null;
  categories: CategoryTreeNode[] | FlatCategoryOption[] | any[];
  brands: BrandOption[];
  onBrandCreated: (newBrand: BrandOption) => void;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  categories,
  brands,
  onBrandCreated,
}: ProductFormModalProps) {
  const isEditing = Boolean(productToEdit);

  // Form State
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [description, setDescription] = useState("");
  const [mrp, setMrp] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  const [privatePriceCode, setPrivatePriceCode] = useState("");
  const [warranty, setWarranty] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // Dynamic Specifications State
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttributeItem[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(null);
  const [categoryChangedWarning, setCategoryChangedWarning] = useState(false);

  // Tab State (Details vs Media)
  const [activeTab, setActiveTab] = useState<"details" | "media">("details");

  // Inline Brand Modal
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product Import State
  const [importText, setImportText] = useState("");
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [overwriteManualFields, setOverwriteManualFields] = useState(false);
  const [isImportExpanded, setIsImportExpanded] = useState(true);
  const [importSummary, setImportSummary] = useState<{
    populated: string[];
    preserved: string[];
    review: string[];
  } | null>(null);

  // Initialize/Reset form when modal opens or productToEdit changes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setCategoryChangedWarning(false);
      setActiveTab("details");
      setImportText("");
      setImportError(null);
      setImportSummary(null);
      setPromptCopied(false);
      setOverwriteManualFields(false);
      return;
    }

    setActiveTab("details");
    setImportError(null);
    setImportSummary(null);

    if (productToEdit) {
      setName(productToEdit.name || "");
      setBrandId(productToEdit.brandId || "");
      setCategoryId(productToEdit.categoryId || "");
      setInitialCategoryId(productToEdit.categoryId || "");
      setSku(productToEdit.sku || "");
      setModelNumber(productToEdit.modelNumber || "");
      setDescription(productToEdit.description || "");
      setMrp(productToEdit.mrp !== undefined ? String(productToEdit.mrp) : "");
      setSellingPrice(
        productToEdit.sellingPrice !== null && productToEdit.sellingPrice !== undefined
          ? String(productToEdit.sellingPrice)
          : ""
      );
      setPrivatePriceCode(productToEdit.privatePriceCode || "");
      setWarranty(productToEdit.warranty || "");
      setIsActive(productToEdit.isActive ?? true);
      setIsFeatured(productToEdit.isFeatured ?? false);
      setCategoryChangedWarning(false);

      // Prepopulate attribute values if full product detail is provided
      if ("attributeValues" in productToEdit && Array.isArray((productToEdit as any).attributeValues)) {
        const initialAttrVals: Record<string, any> = {};
        for (const pav of (productToEdit as any).attributeValues) {
          const attrId = pav.attributeId;
          const attrType = pav.attribute?.type;

          if (attrType === "MULTI_SELECT") {
            if (!initialAttrVals[attrId]) initialAttrVals[attrId] = [];
            if (pav.attributeValueId) {
              initialAttrVals[attrId].push(pav.attributeValueId);
            } else if (pav.value) {
              initialAttrVals[attrId].push(pav.value);
            }
          } else if (attrType === "SELECT") {
            initialAttrVals[attrId] = pav.attributeValueId || pav.value;
          } else if (attrType === "BOOLEAN") {
            initialAttrVals[attrId] = pav.booleanValue !== null ? pav.booleanValue : pav.value === "Yes";
          } else if (attrType === "NUMBER") {
            initialAttrVals[attrId] = pav.numericValue !== null ? pav.numericValue : pav.value;
          } else {
            initialAttrVals[attrId] = pav.value;
          }
        }
        setAttributeValues(initialAttrVals);
      } else {
        setAttributeValues({});
      }
    } else {
      // New product mode
      setName("");
      setBrandId(brands.length > 0 ? brands[0].id : "");
      setCategoryId(categories.length > 0 ? categories[0].id : "");
      setInitialCategoryId(null);
      setSku("");
      setModelNumber("");
      setDescription("");
      setMrp("");
      setSellingPrice("");
      setPrivatePriceCode("");
      setWarranty("1 Year Comprehensive");
      setIsActive(true);
      setIsFeatured(false);
      setAttributeValues({});
      setCategoryChangedWarning(false);
    }
    setError(null);
  }, [isOpen, productToEdit, brands, categories]);

  // Load category attributes dynamically when categoryId changes
  useEffect(() => {
    if (!categoryId) {
      setCategoryAttributes([]);
      return;
    }

    let isMounted = true;

    async function loadAttributes() {
      try {
        setLoadingAttributes(true);
        const res = await fetch(`/api/admin/categories/${categoryId}/attributes`);
        if (!res.ok) throw new Error("Failed to load specifications for category.");
        const json = await res.json();
        if (isMounted) {
          const attrs: CategoryAttributeItem[] = json.data || [];
          setCategoryAttributes(attrs);

          // If category changed from original edit category, warn user
          if (initialCategoryId && categoryId !== initialCategoryId) {
            setCategoryChangedWarning(true);
          } else {
            setCategoryChangedWarning(false);
          }
        }
      } catch (err) {
        console.error("Error loading specifications:", err);
      } finally {
        if (isMounted) setLoadingAttributes(false);
      }
    }

    loadAttributes();

    return () => {
      isMounted = false;
    };
  }, [categoryId, initialCategoryId]);

  // Calculate live discount percentage and savings
  const discountInfo = useMemo((): {
    isError: boolean;
    message?: string;
    percent?: number;
    savings?: number;
  } | null => {
    const numMrp = parseFloat(mrp);
    const numSelling = parseFloat(sellingPrice);

    if (isNaN(numMrp) || numMrp <= 0) return null;
    if (isNaN(numSelling) || numSelling <= 0 || numSelling >= numMrp) {
      if (numSelling > numMrp) {
        return { isError: true, message: "Selling price cannot exceed MRP" };
      }
      return null;
    }

    const discount = ((numMrp - numSelling) / numMrp) * 100;
    const savings = numMrp - numSelling;
    return {
      isError: false,
      percent: Math.round(discount * 10) / 10,
      savings,
    };
  }, [mrp, sellingPrice]);

  const [categoryName, setCategoryName] = useState<string>("");

  // Find category name for dynamic specifications header
  const selectedCategoryName = useMemo(() => {
    if (categoryName) return categoryName;
    if (!categoryId) return "Category";
    function findName(items: any[]): string | null {
      for (const item of items) {
        if (item.id === categoryId) return item.name;
        if (item.children && Array.isArray(item.children)) {
          const sub = findName(item.children);
          if (sub) return sub;
        }
      }
      return null;
    }
    return findName(categories) || "Category";
  }, [categories, categoryId, categoryName]);

  // Handle Dynamic Attribute Value Changes
  const handleAttributeChange = (attrId: string, val: any) => {
    setAttributeValues((prev) => ({
      ...prev,
      [attrId]: val,
    }));
  };

  const handleMultiSelectToggle = (attrId: string, optionVal: string) => {
    setAttributeValues((prev) => {
      const currentList: string[] = Array.isArray(prev[attrId]) ? prev[attrId] : [];
      if (currentList.includes(optionVal)) {
        return { ...prev, [attrId]: currentList.filter((item) => item !== optionVal) };
      } else {
        return { ...prev, [attrId]: [...currentList, optionVal] };
      }
    });
  };

  // Copy standardized showroom prompt for ChatGPT
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHATGPT_PRODUCT_EXTRACTION_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy ChatGPT prompt to clipboard:", err);
    }
  };

  // Clear pasted import text and summary
  const handleClearImport = () => {
    setImportText("");
    setImportError(null);
    setImportSummary(null);
  };

  // API-free auto-fill handler for pasted product information
  const handleAutoFill = async () => {
    if (!importText.trim()) return;
    setIsAutoFilling(true);
    setImportError(null);

    try {
      const parsed = parseProductImport(importText);

      const populatedList: string[] = [];
      const preservedList: string[] = [];
      const reviewList: string[] = [];

      // Helper to safely assign standard text fields
      const applyField = (
        fieldName: string,
        extractedVal: string | undefined,
        currentVal: string,
        setter: (v: string) => void,
        displayName: string = fieldName
      ) => {
        if (extractedVal && isValidValue(extractedVal)) {
          if (!overwriteManualFields && currentVal && currentVal.trim() && currentVal.trim() !== extractedVal.trim()) {
            preservedList.push(`${displayName} (kept manual input: "${currentVal}")`);
          } else {
            setter(extractedVal);
            populatedList.push(`${displayName}: "${extractedVal}"`);
          }
        } else {
          if (!currentVal) {
            reviewList.push(`${displayName}: not found in source`);
          }
        }
      };

      // 1. Basic Fields
      applyField("Product Name", parsed.name, name, setName);
      applyField("Model Number", parsed.modelNumber, modelNumber, setModelNumber);
      applyField("SKU", parsed.sku, sku, setSku);
      applyField("MRP", parsed.mrp, mrp, setMrp, "MRP (₹)");
      applyField("Selling Price", parsed.sellingPrice, sellingPrice, setSellingPrice, "Selling Price (₹)");
      applyField("Private Price Code", parsed.privatePriceCode, privatePriceCode, setPrivatePriceCode);
      applyField("Warranty", parsed.warranty, warranty, setWarranty);

      // 2. Product Overview Description
      if (parsed.formattedDescription) {
        if (!overwriteManualFields && description && description.trim() && description.trim() !== parsed.formattedDescription.trim()) {
          preservedList.push("Description / Product Overview (kept existing manual input)");
        } else {
          setDescription(parsed.formattedDescription);
          populatedList.push("Product Overview (Specification Table & Features)");
        }
      }

      // 3. Brand Matching
      const brandMatch = matchBrand(parsed.brandName, brands);
      if (brandMatch.matchedBrand) {
        if (!overwriteManualFields && brandId && brandId !== brandMatch.matchedBrand.id) {
          preservedList.push(`Brand (kept manual selection)`);
        } else {
          setBrandId(brandMatch.matchedBrand.id);
          populatedList.push(`Brand: ${brandMatch.matchedBrand.name}`);
        }
      } else {
        if (brandMatch.isAmbiguous) {
          reviewList.push(`Brand: ${brandMatch.matchReason}`);
        } else if (parsed.brandName) {
          reviewList.push(`Brand: "${parsed.brandName}" not found in catalogue brands`);
        } else {
          reviewList.push("Brand: not identified in source");
        }
      }

      // 4. Category & Subcategory Matching
      const catMatch = matchCategory(
        parsed.categoryName,
        parsed.subcategoryName,
        parsed.name || name,
        categories
      );

      let activeCatId = categoryId;
      if (catMatch.matchedCategory) {
        const matchedCatId = catMatch.matchedCategory.id;
        if (!overwriteManualFields && categoryId && categoryId !== matchedCatId) {
          preservedList.push(`Category (kept manual selection: ${selectedCategoryName})`);
          activeCatId = categoryId;
        } else {
          setCategoryId(matchedCatId);
          setCategoryName(catMatch.matchedCategory.name);
          activeCatId = matchedCatId;
          populatedList.push(`Category: ${catMatch.matchedCategory.pathText}`);
        }
      } else {
        if (catMatch.isAmbiguous) {
          reviewList.push(`Category: ${catMatch.matchReason}`);
        } else if (parsed.subcategoryName || parsed.categoryName) {
          reviewList.push(
            `Category: "${parsed.subcategoryName || parsed.categoryName}" not matched to catalogue tree`
          );
        } else {
          reviewList.push("Category: not identified in source");
        }
      }

      // 5. Dynamic Specifications & Dropdowns for Category
      if (activeCatId) {
        try {
          setLoadingAttributes(true);
          const res = await fetch(`/api/admin/categories/${activeCatId}/attributes`);
          if (res.ok) {
            const json = await res.json();
            const targetAttrs: CategoryAttributeItem[] = json.data || [];
            setCategoryAttributes(targetAttrs);

            if (targetAttrs.length > 0) {
              const dynamicMatch = matchDynamicCategoryAttributes(
                parsed.specifications,
                parsed.rawSpecifications,
                targetAttrs
              );

              setAttributeValues((prev) => {
                const updated = { ...prev };
                for (const [attrId, val] of Object.entries(dynamicMatch.attributeValues)) {
                  if (
                    overwriteManualFields ||
                    updated[attrId] === undefined ||
                    updated[attrId] === null ||
                    updated[attrId] === "" ||
                    (Array.isArray(updated[attrId]) && updated[attrId].length === 0)
                  ) {
                    updated[attrId] = val;
                  }
                }
                return updated;
              });

              for (const pop of dynamicMatch.populatedSpecs) {
                populatedList.push(`Spec: ${pop.attrName} (${pop.valueDisplay})`);
              }

              // Specs in source that didn't match a DB category attribute
              for (const unmapped of dynamicMatch.unmappedSpecs) {
                reviewList.push(
                  `Specification "${unmapped.label}: ${unmapped.value}" retained in Product Overview (no matching category attribute)`
                );
              }
            }
          }
        } catch (catErr) {
          console.error("Error loading category specifications during auto-fill:", catErr);
        } finally {
          setLoadingAttributes(false);
        }
      }

      setImportSummary({
        populated: populatedList,
        preserved: preservedList,
        review: reviewList,
      });
    } catch (err: any) {
      setImportError(err.message || "Failed to parse product information.");
    } finally {
      setIsAutoFilling(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!name.trim()) {
      setError("Please enter a product name.");
      return;
    }
    if (!brandId) {
      setError("Please select a brand.");
      return;
    }
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }
    if (!sku.trim()) {
      setError("Please enter a SKU.");
      return;
    }

    const parsedMrp = parseFloat(mrp);
    if (isNaN(parsedMrp) || parsedMrp <= 0) {
      setError("Please enter a valid MRP greater than ₹0.");
      return;
    }

    let parsedSellingPrice: number | null = null;
    if (sellingPrice.trim()) {
      parsedSellingPrice = parseFloat(sellingPrice);
      if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
        setError("Please enter a valid Selling Price.");
        return;
      }
      if (parsedSellingPrice > parsedMrp) {
        setError("Selling price cannot be higher than MRP.");
        return;
      }
    }

    // Dynamic attribute validation for required specifications
    for (const attr of categoryAttributes) {
      if (attr.isRequired) {
        const val = attributeValues[attr.id];
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          setError(`Please provide a value for required specification "${attr.name}".`);
          return;
        }
      }
    }

    // Format dynamic specifications into payload array
    const formattedAttributeValues: Array<{
      attributeId: string;
      attributeValueId?: string;
      value?: string;
      numericValue?: number;
      booleanValue?: boolean;
    }> = [];

    for (const attr of categoryAttributes) {
      const rawVal = attributeValues[attr.id];
      if (rawVal === undefined || rawVal === null || rawVal === "") continue;

      if (attr.type === "MULTI_SELECT" && Array.isArray(rawVal)) {
        for (const item of rawVal) {
          // Find if item is an ID in predefinedValues
          const matchedOpt = attr.predefinedValues.find(
            (o) => o.id === item || o.value === item
          );
          formattedAttributeValues.push({
            attributeId: attr.id,
            attributeValueId: matchedOpt ? matchedOpt.id : undefined,
            value: matchedOpt ? matchedOpt.value : String(item),
          });
        }
      } else if (attr.type === "SELECT") {
        const matchedOpt = attr.predefinedValues.find(
          (o) => o.id === rawVal || o.value === rawVal
        );
        formattedAttributeValues.push({
          attributeId: attr.id,
          attributeValueId: matchedOpt ? matchedOpt.id : undefined,
          value: matchedOpt ? matchedOpt.value : String(rawVal),
        });
      } else if (attr.type === "BOOLEAN") {
        const boolVal = rawVal === true || rawVal === "true" || rawVal === "Yes";
        formattedAttributeValues.push({
          attributeId: attr.id,
          value: boolVal ? "Yes" : "No",
          booleanValue: boolVal,
        });
      } else if (attr.type === "NUMBER" || attr.type === "RANGE") {
        const numVal = parseFloat(rawVal);
        formattedAttributeValues.push({
          attributeId: attr.id,
          value: String(rawVal),
          numericValue: isNaN(numVal) ? undefined : numVal,
        });
      } else {
        // TEXT
        formattedAttributeValues.push({
          attributeId: attr.id,
          value: String(rawVal).trim(),
        });
      }
    }

    const payload = {
      name: name.trim(),
      brandId,
      categoryId,
      sku: sku.trim(),
      modelNumber: modelNumber.trim() || null,
      description: description.trim() || null,
      mrp: parsedMrp,
      sellingPrice: parsedSellingPrice,
      privatePriceCode: privatePriceCode.trim() || null,
      warranty: warranty.trim() || null,
      isActive,
      isFeatured,
      attributeValues: formattedAttributeValues,
    };

    try {
      setLoading(true);
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save product. Please check your inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? "Edit Product" : "Add New Product"}
        description={
          isEditing
            ? "Update product details, pricing, and category specifications."
            : "Enter product details to add a new appliance to your showroom catalogue."
        }
        maxWidth="3xl"
      >
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === "details"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Details & Specifications</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === "media"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Product Media (Images & Videos)</span>
            </button>
          </div>

          {activeTab === "media" ? (
            productToEdit && "id" in productToEdit && productToEdit.id ? (
              <ProductMediaManager
                productId={productToEdit.id}
                productName={name || productToEdit.name}
                productSku={sku || ("sku" in productToEdit ? productToEdit.sku : "")}
                allowProductSelection={false}
              />
            ) : (
              <div className="p-8 border-2 border-dashed border-border bg-muted/20 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Save Product First</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Please fill in the basic details and click &quot;Create Product&quot; to save this appliance to your database first. You can then immediately upload images and add video clips.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  Return to Details & Pricing
                </button>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Banner */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{error}</div>
                </div>
              )}

          {/* Category Change Warning */}
          {categoryChangedWarning && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Category Changed:</strong> Specifications that were specific to the previous category will be safely replaced with the specifications for <strong>{selectedCategoryName}</strong> upon saving.
              </div>
            </div>
          )}

          {/* IMPORT PRODUCT INFORMATION (ChatGPT / Box Photo Import) */}
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/5 via-card to-card p-4 sm:p-5 shadow-xs space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <span>Import Product Information</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 lowercase tracking-normal">
                      API-free Auto-Fill
                    </span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Paste ChatGPT-extracted box details to automatically populate product fields, category specifications, and overview tables.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-background hover:bg-muted text-foreground border border-border transition flex items-center gap-1.5 shadow-2xs"
                  title="Copy the recommended prompt to send to ChatGPT with your box photo"
                >
                  {promptCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-bold">Prompt Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-primary" />
                      <span>Copy ChatGPT Prompt</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsImportExpanded(!isImportExpanded)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition"
                  title={isImportExpanded ? "Collapse section" : "Expand section"}
                >
                  {isImportExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {isImportExpanded && (
              <div className="space-y-3.5 pt-1">
                {/* Import Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Paste Product Information
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`Paste complete ChatGPT response here...\n\nExample:\nProduct Name: Prestige Royale Plus 3-Burner Auto Gas Stove\nBrand: Prestige\nModel Number: PR-40281\nMRP: ₹ 8,495\nCategory: Cooking Appliances > Gas Stoves\n\nSpecifications:\n- Burner Count: 3\n- Cooktop Material: Toughened Glass\n- Ignition Type: Automatic`}
                    rows={5}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/50 resize-y"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Pasted source text is preserved so you can reference original box details while reviewing fields below.
                  </p>
                </div>

                {/* Action Buttons & Options */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={overwriteManualFields}
                        onChange={(e) => setOverwriteManualFields(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary/40 w-3.5 h-3.5"
                      />
                      <span>Allow overwriting non-empty fields</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {importText && (
                      <button
                        type="button"
                        onClick={handleClearImport}
                        disabled={isAutoFilling}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Text</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleAutoFill}
                      disabled={!importText.trim() || isAutoFilling}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {isAutoFilling ? (
                        <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Auto-fill Fields</span>
                    </button>
                  </div>
                </div>

                {/* Import Error */}
                {importError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Import Summary Results */}
                {importSummary && (
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="font-bold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Auto-Fill Results</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Review and edit values below before saving
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Populated Fields */}
                      {importSummary.populated.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Populated Fields ({importSummary.populated.length})</span>
                          </div>
                          <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                            {importSummary.populated.map((item, idx) => (
                              <li key={idx} className="leading-snug">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Preserved Manual Fields */}
                      {importSummary.preserved.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-1.5">
                          <div className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" />
                            <span>Preserved Existing Values ({importSummary.preserved.length})</span>
                          </div>
                          <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                            {importSummary.preserved.map((item, idx) => (
                              <li key={idx} className="leading-snug">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Needs Manual Review */}
                      {importSummary.review.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1.5 md:col-span-2">
                          <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Needs Manual Review ({importSummary.review.length})</span>
                          </div>
                          <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                            {importSummary.review.map((item, idx) => (
                              <li key={idx} className="leading-snug">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Layers className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Basic Information
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Prestige Marvel Plus 3 Burner Toughened Glass Gas Stove"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                  required
                />
              </div>

              {/* Brand Selection with inline Add Brand button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    Brand <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBrandModalOpen(true)}
                    className="text-[11px] font-semibold text-primary hover:text-primary/80 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add New Brand</span>
                  </button>
                </div>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  required
                >
                  <option value="" disabled>Select Brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Hierarchy Selection */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Category <span className="text-rose-400">*</span>
                </label>
                <CascadingCategorySelect
                  value={categoryId}
                  onChange={(newCatId, node) => {
                    setCategoryId(newCatId || "");
                    if (node) {
                      setCategoryName(node.name);
                    }
                  }}
                  categories={categories}
                  allowRootSelection={false}
                  rootLabel="Select Main Category..."
                  subCategoryPlaceholder="Select Subcategory..."
                  required={true}
                  showPathPreview={true}
                  idPrefix="product-form-cat"
                />
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  SKU (Stock Keeping Unit) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. PRS-MVL-3B-BLK"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Unique internal inventory code for this item.
                </p>
              </div>

              {/* Model Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Model Number <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  placeholder="e.g. Marvel Plus 3B GT 03"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                />
                <p className="text-[11px] text-muted-foreground">
                  Manufacturer model number printed on the product or box.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    Product Overview / Description <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Formatted as specification tables & feature bullets in showroom
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Elegant black toughened glass cooktop with high efficiency brass burners and spill-proof design..."
                  rows={5}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60 resize-y"
                />
                <p className="text-[11px] text-muted-foreground">
                  Preserves all specifications, key features, and accessories from pasted source. Editable before saving.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: PRICING & PRICE CODE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Pricing & Price Code
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* MRP */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  MRP (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    placeholder="e.g. 8500"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Maximum Retail Price printed on box.</p>
              </div>

              {/* Selling Price */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Selling Price (₹) <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="e.g. 6800"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Offer / discounted price for customers.</p>
              </div>

              {/* Price Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Price Code <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={privatePriceCode}
                  onChange={(e) => setPrivatePriceCode(e.target.value)}
                  placeholder="e.g. P850"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                />
                <p className="text-[11px] text-muted-foreground">Shop pricing code (visible to customers).</p>
              </div>
            </div>

            {/* Real-time Discount & Validation Notice */}
            {discountInfo && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  discountInfo.isError
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                }`}
              >
                {discountInfo.isError ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{discountInfo.message}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Automatic Discount: <strong>{discountInfo.percent}% OFF</strong>
                      </span>
                    </div>
                    <div className="font-semibold text-emerald-200">
                      Customer Saves: ₹{(discountInfo.savings ?? 0).toLocaleString("en-IN")}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: WARRANTY & STATUS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Warranty & Status
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Warranty */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Warranty Information <span className="text-muted-foreground text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  placeholder="e.g. 2 Years on Product, 5 Years on Burners"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Active Switch */}
              <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Active Status</div>
                  <div className="text-[11px] text-muted-foreground">
                    Show this product in store catalogue.
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

              {/* Featured Switch */}
              <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Featured Product</div>
                  <div className="text-[11px] text-muted-foreground">
                    Highlight on showcase & homepage.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 4: DYNAMIC SPECIFICATIONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Specifications for {selectedCategoryName}
                </h4>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {categoryAttributes.length} dynamic specification(s)
              </span>
            </div>

            {loadingAttributes ? (
              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Loading specifications for {selectedCategoryName}...</span>
              </div>
            ) : categoryAttributes.length === 0 ? (
              <div className="p-6 rounded-xl bg-muted/20 border border-border text-center text-xs text-muted-foreground">
                No custom specifications have been configured for this category yet. You can manage specifications in the Categories admin page.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryAttributes.map((attr) => {
                  const currentVal = attributeValues[attr.id];

                  return (
                    <div
                      key={attr.id}
                      className={`space-y-1.5 p-3 rounded-xl border border-border/70 bg-card/60 ${
                        attr.type === "MULTI_SELECT" || attr.type === "TEXT"
                          ? "md:col-span-2"
                          : ""
                      }`}
                    >
                      {/* Label + Required Tag */}
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-foreground">
                          {attr.name}
                          {attr.unit && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({attr.unit})
                            </span>
                          )}
                          {attr.isRequired && (
                            <span className="text-rose-400 ml-1">*</span>
                          )}
                        </label>
                        {attr.isRequired && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Required
                          </span>
                        )}
                      </div>

                      {/* RENDER BY ATTRIBUTE TYPE */}
                      {attr.type === "SELECT" && (
                        <select
                          value={currentVal || ""}
                          onChange={(e) => handleAttributeChange(attr.id, e.target.value)}
                          className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                          required={attr.isRequired}
                        >
                          <option value="">Select option...</option>
                          {attr.predefinedValues.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label || opt.value}
                            </option>
                          ))}
                        </select>
                      )}

                      {attr.type === "MULTI_SELECT" && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {attr.predefinedValues.map((opt) => {
                            const isChecked = Array.isArray(currentVal)
                              ? currentVal.includes(opt.id) || currentVal.includes(opt.value)
                              : false;

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleMultiSelectToggle(attr.id, opt.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                                  isChecked
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                                }`}
                              >
                                {isChecked && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                <span>{opt.label || opt.value}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {attr.type === "BOOLEAN" && (
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAttributeChange(attr.id, true)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              currentVal === true || currentVal === "true" || currentVal === "Yes"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttributeChange(attr.id, false)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              currentVal === false || currentVal === "false" || currentVal === "No"
                                ? "bg-muted-foreground/30 text-foreground border-border"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            No
                          </button>
                        </div>
                      )}

                      {attr.type === "NUMBER" && (
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={currentVal !== undefined && currentVal !== null ? currentVal : ""}
                            onChange={(e) => handleAttributeChange(attr.id, e.target.value)}
                            placeholder={`e.g. 750`}
                            className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                            required={attr.isRequired}
                          />
                          {attr.unit && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                              {attr.unit}
                            </span>
                          )}
                        </div>
                      )}

                      {attr.type === "RANGE" && (
                        <div className="relative">
                          <input
                            type="text"
                            value={currentVal !== undefined && currentVal !== null ? currentVal : ""}
                            onChange={(e) => handleAttributeChange(attr.id, e.target.value)}
                            placeholder="e.g. 500 - 1000"
                            className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                            required={attr.isRequired}
                          />
                          {attr.unit && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                              {attr.unit}
                            </span>
                          )}
                        </div>
                      )}

                      {attr.type === "TEXT" && (
                        <input
                          type="text"
                          value={currentVal !== undefined && currentVal !== null ? currentVal : ""}
                          onChange={(e) => handleAttributeChange(attr.id, e.target.value)}
                          placeholder={`Enter ${attr.name.toLowerCase()}...`}
                          className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                          required={attr.isRequired}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3 sticky bottom-0 bg-card/95 backdrop-blur-xs py-2 -mx-2 px-2">
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
              <span>{isEditing ? "Save Product Changes" : "Create Product"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  </Modal>

      {/* Inline Brand Creation Modal */}
      <BrandModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        onBrandCreated={(brand: BrandOption) => {
          onBrandCreated(brand);
          setBrandId(brand.id);
        }}
      />
    </>
  );
}
