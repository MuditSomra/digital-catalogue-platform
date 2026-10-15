/**
 * Product Import Parser & Field Auto-Fill Engine
 *
 * Deterministically parses ChatGPT-extracted kitchen appliance information from
 * packaging or product sheets into structured form fields, dynamic category
 * specifications, and a complete customer-facing Product Overview description.
 *
 * 100% API-free: uses TypeScript, regex pattern matching, and string normalization.
 */

import { slugify } from "./slugify";
import { cleanListPrefix, parseAccessoryLine } from "./product-overview-parser";
import type { BrandOption } from "@/types";

// ==============================================================================
// 1. TYPES & INTERFACES
// ==============================================================================

export interface ParsedAccessory {
  accessory: string;
  quantity: string | null;
}

export interface RawSpecification {
  label: string;
  value: string;
}

export interface ExtractedProductData {
  /** Product Name / Title */
  name?: string;
  /** Extracted Brand Name */
  brandName?: string;
  /** Manufacturer Model Number */
  modelNumber?: string;
  /** SKU / Inventory Code */
  sku?: string;
  /** Maximum Retail Price as numeric string */
  mrp?: string;
  /** Selling Price / Offer Price as numeric string */
  sellingPrice?: string;
  /** Internal / Private Shop Price Code (e.g. P850, 821+70) */
  privatePriceCode?: string;
  /** Main Category Name (e.g. Cooking Appliances) */
  categoryName?: string;
  /** Subcategory Name (e.g. Gas Stoves, Kitchen Chimneys) */
  subcategoryName?: string;
  /** Warranty string (e.g. 2 Years Comprehensive) */
  warranty?: string;
  /** Normalized specifications dictionary: lowercase label -> value */
  specifications: Record<string, string>;
  /** Preserved raw specification pairs in order */
  rawSpecifications: RawSpecification[];
  /** Bulleted Key Features */
  keyFeatures: string[];
  /** Included Accessories with quantities */
  accessories: ParsedAccessory[];
  /** Leading introduction text or overview paragraph */
  introText?: string;
  /** Additional notes, installation info, or disclaimers */
  notes?: string;
  /** Complete customer-facing description formatted for ProductOverview renderer */
  formattedDescription: string;
  /** Preserved raw pasted text for staff reference */
  originalText: string;
}

export interface CategoryAttributeItem {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  type: string;
  unit: string | null;
  isFilterable: boolean;
  isRequired: boolean;
  sortOrder: number;
  predefinedValues: Array<{
    id: string;
    attributeId: string;
    value: string;
    label: string;
    sortOrder: number;
  }>;
}

export interface ImportMatchResult {
  /** Matched brand record, or null */
  matchedBrand: BrandOption | null;
  /** Matched category record or node, or null */
  matchedCategory: any | null;
  /** Dynamic attribute values mapped: attributeId -> value or optionId */
  attributeValues: Record<string, any>;
  /** Fields successfully populated */
  populatedFields: string[];
  /** Fields or specs needing manual review */
  reviewFields: string[];
  /** Existing fields preserved (not overwritten) */
  preservedFields: string[];
}

// ==============================================================================
// 2. READY-TO-COPY CHATGPT PROMPT TEMPLATE
// ==============================================================================

export const CHATGPT_PRODUCT_EXTRACTION_PROMPT = `You are a product data extraction specialist for a premium kitchen appliance showroom. Your task is to extract accurate product information from photos of product boxes, labels, stickers, manuals, and the product itself.

1. ABSOLUTE ACCURACY: NEVER INVENT INFORMATION
- Extract only information that is actually visible and verifiable in the supplied images or text.
- Never invent, assume, infer, estimate, autocomplete, or guess any product information.
- Never use websites, internet searches, memory, or general product knowledge to fill gaps.
- Do not create promotional language or make the product sound better than the packaging states.
- If information is absent, output N/A.
- If partially visible or ambiguous, mark the uncertain part as [unclear].
- Preserve units, numbers, symbols, and wording as closely as possible to the source.

2. CAREFULLY INSPECT HANDWRITTEN MARKINGS
- Inspect all corners, edges, and blank spaces for marker/pen markings.
- Extract every clearly readable handwritten code or marking.
- If a handwritten marking is clearly an internal shop price code (e.g. P850, 821+70), put it in Private Price Code.
- If meaning is unclear, record it under Additional Notes as a handwritten marking.
- Preserve exact characters without performing arithmetic.

3. WARRANTY: EXTRACT COMPLETE WORDING
- Extract the complete warranty wording exactly as visible, preserving all durations, conditions, exclusions, and component-specific coverage (e.g., "2 years comprehensive warranty and 5 years on motor"). Never shorten or guess.

4. PRICES AND PRIVATE SHOP CODES
- Keep MRP, Selling Price, and Private Price Code separate.
- Do not confuse model numbers, barcodes, or serial numbers with MRP or prices.
- Do not calculate discounts or invent selling prices. If not printed, output N/A.

5. EXACT OUTPUT STRUCTURE (Return ONLY these labels in this order):
Product Name: [Full product name with brand, model, and key descriptor]
Brand: [Brand name, e.g. Prestige, Faber, Bosch, Philips, Glen, Elica]
Model Number: [Manufacturer model number printed on box]
SKU: [SKU code if printed on barcode label, otherwise N/A]
MRP: [Printed Maximum Retail Price, e.g. 8500]
Selling Price: [Offer price if explicitly printed, otherwise N/A]
Private Price Code: [Handwritten shop code or private code, e.g. P850 or 821+70, otherwise N/A]
Warranty: [Complete warranty statement, e.g. 2 Years Comprehensive Warranty and 5 Years on Motor]
Category: [Main Category and Subcategory, e.g. Cooking Appliances > Gas Stoves]

Specifications:
- [Specification Name]: [Value with units, e.g. Burner Count: 3, Width: 60 cm, Suction Capacity: 1200 m³/hr, Cooktop Material: Toughened Glass, Ignition Type: Automatic, Motor Power: 750 W, Number of Jars: 3 Jars, Auto Clean: Yes]

Key Features:
- [Verified key feature 1]
- [Verified key feature 2]
- [Verified key feature 3]

Included Accessories:
- [Accessory 1] - [Quantity, e.g. 1 Pc]
- [Accessory 2] - [Quantity]

Additional Notes:
- [Any installation tips, care instructions, handwritten markings, or package notes]

Product Overview:
Write a clean, customer-facing description containing only the product introduction, verified technical specifications, key features, included accessories, and complete warranty wording. Do not include information from Additional Notes, such as handwritten markings, private price codes, manufacturer contact details, internal remarks, or packaging disclaimers. Do not repeat MRP or selling price unless specifically required.`;

// ==============================================================================
// 3. REGEX & NORMALIZATION HELPERS
// ==============================================================================

const ACCESSORIES_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:included\s+accessories|accessories\s+included|in(?:side)?\s+the\s+box|what'?s\s+in\s+the\s+box|box\s+contents|package\s+contents|items\s+included)(?:\*\*)?:?\s*(.*)$/i;

const FEATURES_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:key\s+features|product\s+features|features|highlights)(?:\*\*)?:?\s*(.*)$/i;

const SPECS_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:product\s+specifications|technical\s+specifications|general\s+specifications|specifications|specs|specifications\s*&?\s*details)(?:\*\*)?:?\s*(.*)$/i;

const NOTES_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:important\s+note|additional\s+notes?|notes?|please\s+note|disclaimer|caution|warning|terms\s*(?:&|and)\s*conditions|installation\s+notes?|additional\s+info(?:rmation)?)(?:\*\*)?:?\s*(.*)$/i;

const INTRO_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:product\s+overview|product\s+information|overview|about\s+the\s+product|product\s+description|description)(?:\*\*)?:?\s*(.*)$/i;

/**
 * Checks if a string contains valid data (not N/A, None, -, unknown, etc.).
 */
export function isValidValue(str?: string | null): boolean {
  if (!str) return false;
  const trimmed = str.trim().toLowerCase();
  return (
    trimmed !== "" &&
    trimmed !== "n/a" &&
    trimmed !== "na" &&
    trimmed !== "none" &&
    trimmed !== "nil" &&
    trimmed !== "-" &&
    trimmed !== "--" &&
    trimmed !== "unknown" &&
    trimmed !== "not specified" &&
    trimmed !== "not available" &&
    trimmed !== "tbd" &&
    trimmed !== "null" &&
    trimmed !== "undefined"
  );
}

/**
 * Normalizes text for comparison (lowercased, punctuation-free, collapsed spaces).
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses numeric price from string, stripping currency symbols, commas, and trailing /-.
 */
export function parsePrice(str?: string | null): string | undefined {
  if (!isValidValue(str)) return undefined;
  // Remove currency signs (₹, $, Rs, INR), commas, spaces, and /-
  const cleaned = str!
    .replace(/[₹\$,\s]|rs\.?|inr|\/\-/gi, "")
    .trim();
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num >= 0) {
    // Return clean numeric string without unnecessary decimals if whole
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
  }
  return undefined;
}

/**
 * Parses private price code safely preserving alphanumeric and composite forms (e.g. P850, 821+70, 693).
 */
export function parsePriceCode(str?: string | null): string | undefined {
  if (!isValidValue(str)) return undefined;
  const cleaned = str!.replace(/^\*\*|\*\*$/g, "").trim();
  return cleaned || undefined;
}

/**
 * Checks if a line is a polite ChatGPT preamble to omit.
 */
function isConversationalPreamble(line: string): boolean {
  const norm = line.toLowerCase().trim();
  return (
    norm.startsWith("here is") ||
    norm.startsWith("here are") ||
    norm.startsWith("based on the") ||
    norm.startsWith("certainly") ||
    norm.startsWith("sure!") ||
    norm.startsWith("below is") ||
    norm.startsWith("below are") ||
    norm.startsWith("i have extracted") ||
    norm.startsWith("as requested") ||
    norm.startsWith("please find")
  );
}

/**
 * Splits a line on the first colon into label and value.
 */
function splitFirstColon(rawLine: string): { label: string; value: string } | null {
  const line = cleanListPrefix(rawLine);
  const colonIndex = line.indexOf(":");
  if (colonIndex <= 0) return null;

  const rawLabel = line.slice(0, colonIndex).trim();
  const rawValue = line.slice(colonIndex + 1).trim();

  // Strip markdown bold wrappers like **Brand:**
  const label = rawLabel.replace(/^\*\*|\*\*$/g, "").trim();
  const value = rawValue.replace(/^\*\*|\*\*$/g, "").trim();

  if (!label || label.length > 60 || label.includes(".")) {
    return null;
  }
  return { label, value };
}

/**
 * Parses a markdown table line like `| Label | Value |`
 */
function parseTableRow(rawLine: string): { label: string; value: string } | null {
  const trimmed = rawLine.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;

  // Split by |
  const parts = trimmed
    .split("|")
    .map((p) => p.trim())
    .filter((p, idx, arr) => idx > 0 && idx < arr.length - 1);

  if (parts.length < 2) return null;

  const label = parts[0].replace(/^\*\*|\*\*$/g, "").trim();
  const value = parts[1].replace(/^\*\*|\*\*$/g, "").trim();

  // Ignore header divider rows like `| --- | --- |`
  if (/^[\-\:\s]+$/.test(label) || /^[\-\:\s]+$/.test(value)) {
    return null;
  }

  // Ignore table header row like `| Specification | Value |` or `| Field | Details |`
  const normLabel = label.toLowerCase();
  if (
    (normLabel === "specification" ||
      normLabel === "specifications" ||
      normLabel === "field" ||
      normLabel === "attribute" ||
      normLabel === "parameter" ||
      normLabel === "item") &&
    (parts[1].toLowerCase().includes("value") ||
      parts[1].toLowerCase().includes("detail") ||
      parts[1].toLowerCase().includes("description"))
  ) {
    return null;
  }

  if (!label || label.length > 60) return null;
  return { label, value };
}

// ==============================================================================
// 4. MAIN PRODUCT IMPORT PARSER
// ==============================================================================

/**
 * Parses any raw ChatGPT response or product sheet into structured fields,
 * dynamic specifications, and a Product Overview formatted description.
 */
export function parseProductImport(rawText: string): ExtractedProductData {
  const text = rawText ? rawText.trim() : "";
  if (!text) {
    return {
      specifications: {},
      rawSpecifications: [],
      keyFeatures: [],
      accessories: [],
      formattedDescription: "",
      originalText: "",
    };
  }

  const lines = text.split(/\r?\n/);

  let extractedName: string | undefined;
  let extractedBrand: string | undefined;
  let extractedModel: string | undefined;
  let extractedSku: string | undefined;
  let extractedMrp: string | undefined;
  let extractedSellingPrice: string | undefined;
  let extractedPriceCode: string | undefined;
  let extractedCategory: string | undefined;
  let extractedSubcategory: string | undefined;
  let extractedWarranty: string | undefined;

  const specifications: Record<string, string> = {};
  const rawSpecifications: RawSpecification[] = [];
  const keyFeatures: string[] = [];
  const accessories: ParsedAccessory[] = [];
  const introLines: string[] = [];
  const noteLines: string[] = [];
  const overviewLines: string[] = [];

  let currentSection: "initial" | "specs" | "features" | "accessories" | "notes" | "overview" = "initial";

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Skip empty lines or markdown separator lines like `---` or `===`
    if (!trimmed || /^[\-\=\*_]{3,}$/.test(trimmed)) {
      continue;
    }

    // Skip polite conversational preambles
    if (isConversationalPreamble(trimmed)) {
      continue;
    }

    // Check for section transitions
    const overviewMatch = trimmed.match(
      /^(?:#+\s*)?(?:\*\*)?(?:product\s+overview)(?:\*\*)?:?\s*(.*)$/i
    );
    if (overviewMatch) {
      currentSection = "overview";
      if (overviewMatch[1]?.trim()) {
        overviewLines.push(overviewMatch[1].trim());
      }
      continue;
    }

    const notesMatch = trimmed.match(NOTES_HEADER_REGEX);
    if (notesMatch) {
      currentSection = "notes";
      if (notesMatch[1]?.trim()) {
        noteLines.push(notesMatch[1].trim());
      }
      continue;
    }

    const accMatch = trimmed.match(ACCESSORIES_HEADER_REGEX);
    if (accMatch) {
      currentSection = "accessories";
      if (accMatch[1]?.trim()) {
        const item = parseAccessoryLine(accMatch[1]);
        if (item.accessory) accessories.push(item);
      }
      continue;
    }

    const featMatch = trimmed.match(FEATURES_HEADER_REGEX);
    if (featMatch) {
      currentSection = "features";
      if (featMatch[1]?.trim()) {
        const feat = cleanListPrefix(featMatch[1]);
        if (feat) keyFeatures.push(feat);
      }
      continue;
    }

    const specsMatch = trimmed.match(SPECS_HEADER_REGEX);
    if (specsMatch) {
      currentSection = "specs";
      if (specsMatch[1]?.trim()) {
        const parsed = splitFirstColon(specsMatch[1]) || parseTableRow(specsMatch[1]);
        if (parsed && isValidValue(parsed.value)) {
          specifications[normalizeString(parsed.label)] = parsed.value;
          rawSpecifications.push(parsed);
        }
      }
      continue;
    }

    const introMatch = trimmed.match(INTRO_HEADER_REGEX);
    if (introMatch) {
      currentSection = "initial";
      if (introMatch[1]?.trim()) {
        introLines.push(introMatch[1].trim());
      }
      continue;
    }

    // Heading # title at top of text: if no product name yet, can be product name
    if (
      !extractedName &&
      currentSection === "initial" &&
      introLines.length === 0 &&
      rawSpecifications.length === 0
    ) {
      const h1Match = trimmed.match(/^#+\s*(.+)$/);
      if (h1Match) {
        const candidate = h1Match[1].replace(/^\*\*|\*\*$/g, "").trim();
        if (
          candidate &&
          !candidate.toLowerCase().includes("product information") &&
          !candidate.toLowerCase().includes("overview")
        ) {
          extractedName = candidate;
          continue;
        }
      }
    }

    // Handle section-specific lines
    if (currentSection === "overview") {
      overviewLines.push(trimmed);
      continue;
    }

    if (currentSection === "notes") {
      const cleanLine = cleanListPrefix(trimmed);
      if (cleanLine) noteLines.push(cleanLine);
      continue;
    }

    if (currentSection === "accessories") {
      const item = parseAccessoryLine(trimmed);
      if (item.accessory && isValidValue(item.accessory)) {
        accessories.push(item);
      }
      continue;
    }

    if (currentSection === "features") {
      const feat = cleanListPrefix(trimmed);
      if (feat && isValidValue(feat)) {
        keyFeatures.push(feat);
      }
      continue;
    }

    // Section is initial or specs: look for Key: Value pair or Table row
    const pair = splitFirstColon(trimmed) || parseTableRow(trimmed);

    if (pair) {
      const normLabel = normalizeString(pair.label);
      const val = pair.value.trim();

      // Check known top-level form fields
      if (/^(?:product\s*name|name|product\s*title|model\s*name|title|appliance\s*name)$/.test(normLabel)) {
        if (isValidValue(val)) extractedName = val;
        continue;
      }
      if (/^(?:brand\s*name|brand|manufacturer|make|company)$/.test(normLabel)) {
        if (isValidValue(val)) extractedBrand = val;
        continue;
      }
      if (/^(?:model\s*number|model\s*no|model\s*code|model|item\s*model\s*number)$/.test(normLabel)) {
        if (isValidValue(val)) extractedModel = val;
        continue;
      }
      if (/^(?:sku\s*code|sku|product\s*code|item\s*code|barcode|article\s*no)$/.test(normLabel)) {
        if (isValidValue(val)) extractedSku = val;
        continue;
      }
      if (/^(?:m\s*r\s*p|maximum\s*retail\s*price|mrp\s*inr|mrp\s*rs|mrp|list\s*price)$/.test(normLabel)) {
        if (isValidValue(val)) extractedMrp = parsePrice(val);
        continue;
      }
      if (/^(?:selling\s*price|offer\s*price|discounted\s*price|special\s*price|deal\s*price|sale\s*price|our\s*price)$/.test(normLabel)) {
        if (isValidValue(val)) extractedSellingPrice = parsePrice(val);
        continue;
      }
      if (/^(?:private\s*price\s*code|price\s*code|private\s*code|shop\s*code|internal\s*code)$/.test(normLabel)) {
        if (isValidValue(val)) extractedPriceCode = parsePriceCode(val);
        continue;
      }
      if (/^(?:category|main\s*category|product\s*category|department)$/.test(normLabel)) {
        if (isValidValue(val)) extractedCategory = val;
        continue;
      }
      if (/^(?:subcategory|sub\s*category|sub\s*cat|appliance\s*type|type\s*of\s*appliance)$/.test(normLabel)) {
        if (isValidValue(val)) extractedSubcategory = val;
        continue;
      }
      if (/^(?:warranty\s*period|warranty\s*details|warranty\s*information|warranty|guarantee)$/.test(normLabel)) {
        if (isValidValue(val)) extractedWarranty = val;
        continue;
      }

      // Check generic "price" only if MRP was already captured or if label specifies price
      if (normLabel === "price") {
        if (extractedMrp && !extractedSellingPrice && isValidValue(val)) {
          extractedSellingPrice = parsePrice(val);
        } else if (!extractedMrp && isValidValue(val)) {
          extractedMrp = parsePrice(val);
        }
        continue;
      }

      // Otherwise, record as technical / dynamic specification
      if (isValidValue(val)) {
        specifications[normLabel] = val;
        rawSpecifications.push(pair);
      }
    } else {
      // Unstructured prose line
      if (currentSection === "initial" && rawSpecifications.length === 0) {
        // Collect into intro text
        introLines.push(trimmed);
      } else {
        noteLines.push(cleanListPrefix(trimmed));
      }
    }
  }

  // Synthesize complete customer-facing Product Overview description
  const descriptionSections: string[] = [];

  const introText = introLines.join("\n\n").trim() || undefined;
  if (introText) {
    descriptionSections.push(introText);
  }

  if (rawSpecifications.length > 0) {
    const specLines = rawSpecifications.map((s) => `${s.label}: ${s.value}`);
    descriptionSections.push(`Specifications:\n${specLines.join("\n")}`);
  }

  if (keyFeatures.length > 0) {
    const featLines = keyFeatures.map((f) => `- ${f}`);
    descriptionSections.push(`Key Features:\n${featLines.join("\n")}`);
  }

  if (accessories.length > 0) {
    const accLines = accessories.map((a) =>
      a.quantity ? `- ${a.accessory} – ${a.quantity}` : `- ${a.accessory}`
    );
    descriptionSections.push(`Included Accessories:\n${accLines.join("\n")}`);
  }

  // Preserve Additional Notes in data object for staff reference, but exclude from customer-facing Product Overview
  const notesText = noteLines.join("\n").trim() || undefined;

  const rawExplicitOverview = overviewLines.join("\n").trim();
  // Strip any trailing Additional Notes/Information block if present in the explicit overview
  const explicitOverview = rawExplicitOverview
    ? rawExplicitOverview
        .replace(
          /(?:\r?\n|^)(?:#+\s*)?(?:\*\*)?(?:additional\s+notes?|additional\s+info(?:rmation)?|notes?)(?:\*\*)?:?[\s\S]*$/i,
          ""
        )
        .trim()
    : "";

  let formattedDescription = "";

  if (explicitOverview) {
    if (
      explicitOverview.toLowerCase().includes("specifications:") ||
      explicitOverview.toLowerCase().includes("key features:")
    ) {
      formattedDescription = explicitOverview;
    } else {
      // Put clean explicit overview text at top of formatted sections
      descriptionSections.unshift(explicitOverview);
      formattedDescription = descriptionSections.join("\n\n");
    }
  } else {
    formattedDescription = descriptionSections.join("\n\n");
  }

  return {
    name: extractedName,
    brandName: extractedBrand,
    modelNumber: extractedModel,
    sku: extractedSku,
    mrp: extractedMrp,
    sellingPrice: extractedSellingPrice,
    privatePriceCode: extractedPriceCode,
    categoryName: extractedCategory,
    subcategoryName: extractedSubcategory,
    warranty: extractedWarranty,
    specifications,
    rawSpecifications,
    keyFeatures,
    accessories,
    introText,
    notes: notesText,
    formattedDescription,
    originalText: text,
  };
}

// ==============================================================================
// 5. BRAND MATCHING ENGINE
// ==============================================================================

/**
 * Matches an extracted brand name against actual database brand options.
 * Never creates new brands. If ambiguous or missing, flags for manual selection.
 */
export function matchBrand(
  extractedBrand: string | undefined,
  brands: BrandOption[]
): {
  matchedBrand: BrandOption | null;
  isAmbiguous: boolean;
  matchReason?: string;
} {
  if (!extractedBrand || !isValidValue(extractedBrand) || brands.length === 0) {
    return { matchedBrand: null, isAmbiguous: false };
  }

  const normExtracted = normalizeString(extractedBrand);

  // 1. Exact match on name or slug
  for (const b of brands) {
    if (
      normalizeString(b.name) === normExtracted ||
      b.slug.toLowerCase() === normExtracted ||
      slugify(b.name) === slugify(extractedBrand)
    ) {
      return { matchedBrand: b, isAmbiguous: false, matchReason: `Exact match: "${b.name}"` };
    }
  }

  // 2. Conservative substring / word boundary match
  // e.g. "Prestige India" or "Prestige Kitchenware" -> "Prestige"
  const candidates: BrandOption[] = [];
  for (const b of brands) {
    const bNorm = normalizeString(b.name);
    if (!bNorm) continue;

    // Check if brand name is a standalone word in extracted string
    const wordRegex = new RegExp(`\\b${bNorm}\\b`, "i");
    if (wordRegex.test(normExtracted)) {
      candidates.push(b);
    }
  }

  if (candidates.length === 1) {
    return {
      matchedBrand: candidates[0],
      isAmbiguous: false,
      matchReason: `Identified "${candidates[0].name}" in brand text`,
    };
  }

  if (candidates.length > 1) {
    return {
      matchedBrand: null,
      isAmbiguous: true,
      matchReason: `Multiple brands matched (${candidates.map((c) => c.name).join(", ")}). Please select manually.`,
    };
  }

  return {
    matchedBrand: null,
    isAmbiguous: false,
    matchReason: `No existing brand matched "${extractedBrand}". Please select or add via "Add New Brand".`,
  };
}

// ==============================================================================
// 6. CATEGORY HIERARCHY MATCHING ENGINE
// ==============================================================================

export interface FlattenedCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isLeaf: boolean;
  depth: number;
  pathText: string;
}

/**
 * Flattens any category tree into a flat searchable array with path info.
 */
export function flattenCategoryHierarchy(items: any[], currentDepth = 0, parentPath = ""): FlattenedCategory[] {
  const result: FlattenedCategory[] = [];

  for (const item of items) {
    if (!item || !item.id) continue;
    const pathText = parentPath ? `${parentPath} > ${item.name}` : item.name;
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    result.push({
      id: item.id,
      name: item.name,
      slug: item.slug,
      parentId: item.parentId || null,
      isLeaf: !hasChildren,
      depth: currentDepth,
      pathText,
    });

    if (hasChildren) {
      result.push(...flattenCategoryHierarchy(item.children, currentDepth + 1, pathText));
    }
  }

  return result;
}

/**
 * Matches extracted category & subcategory against database category records.
 * Prioritizes leaf categories (subcategories) as required by CascadingCategorySelect.
 */
export function matchCategory(
  extractedCategory: string | undefined,
  extractedSubcategory: string | undefined,
  productName: string | undefined,
  rawCategories: any[]
): {
  matchedCategory: FlattenedCategory | null;
  isAmbiguous: boolean;
  matchReason?: string;
} {
  const flatCats = flattenCategoryHierarchy(rawCategories);
  if (flatCats.length === 0) {
    return { matchedCategory: null, isAmbiguous: false };
  }

  // Focus candidates on non-root categories (depth > 0 or leaf)
  const selectableCats = flatCats.filter((c) => c.depth > 0 || c.isLeaf);

  const subNorm = extractedSubcategory ? normalizeString(extractedSubcategory) : "";
  const catNorm = extractedCategory ? normalizeString(extractedCategory) : "";
  const nameNorm = productName ? normalizeString(productName) : "";

  // 1. Try matching subcategory directly
  if (subNorm) {
    // Exact name match on leaf/selectable category
    const exactSub = selectableCats.filter((c) => normalizeString(c.name) === subNorm);
    if (exactSub.length === 1) {
      return {
        matchedCategory: exactSub[0],
        isAmbiguous: false,
        matchReason: `Matched subcategory "${exactSub[0].pathText}"`,
      };
    }

    // Singular / plural tolerance (e.g. "Gas Stove" vs "Gas Stoves", "Chimney" vs "Kitchen Chimneys")
    const subClean = subNorm.replace(/s$/, "");
    const fuzzySub = selectableCats.filter((c) => {
      const cClean = normalizeString(c.name).replace(/s$/, "");
      return cClean === subClean || cClean.includes(subClean) || subClean.includes(cClean);
    });

    if (fuzzySub.length === 1) {
      return {
        matchedCategory: fuzzySub[0],
        isAmbiguous: false,
        matchReason: `Matched subcategory "${fuzzySub[0].pathText}"`,
      };
    }

    // If multiple candidates, disambiguate using parent category if provided
    if (fuzzySub.length > 1 && catNorm) {
      const parentFiltered = fuzzySub.filter((c) =>
        normalizeString(c.pathText).includes(catNorm)
      );
      if (parentFiltered.length === 1) {
        return {
          matchedCategory: parentFiltered[0],
          isAmbiguous: false,
          matchReason: `Matched "${parentFiltered[0].pathText}"`,
        };
      }
    }
  }

  // 2. Try matching main category if subcategory was missing or not matched
  if (catNorm) {
    const exactCat = selectableCats.filter((c) => normalizeString(c.name) === catNorm);
    if (exactCat.length === 1) {
      return {
        matchedCategory: exactCat[0],
        isAmbiguous: false,
        matchReason: `Matched category "${exactCat[0].pathText}"`,
      };
    }
  }

  // 3. Fallback: Keyword inference from Product Name
  if (nameNorm) {
    const keywordMatches: Array<{ cat: FlattenedCategory; score: number }> = [];

    for (const c of selectableCats) {
      const cNorm = normalizeString(c.name);
      // Give higher weight to longer specific names like "built-in hobs" over "gas stoves"
      if (nameNorm.includes(cNorm)) {
        keywordMatches.push({ cat: c, score: cNorm.length });
      } else {
        const cSingular = cNorm.replace(/s$/, "");
        if (cSingular.length > 3 && nameNorm.includes(cSingular)) {
          keywordMatches.push({ cat: c, score: cSingular.length });
        }
      }
    }

    if (keywordMatches.length > 0) {
      keywordMatches.sort((a, b) => b.score - a.score);
      // If top score is strictly higher than next, we have an unambiguous winner
      if (
        keywordMatches.length === 1 ||
        keywordMatches[0].score > keywordMatches[1].score
      ) {
        return {
          matchedCategory: keywordMatches[0].cat,
          isAmbiguous: false,
          matchReason: `Inferred from product title: "${keywordMatches[0].cat.pathText}"`,
        };
      }
    }
  }

  return {
    matchedCategory: null,
    isAmbiguous: false,
    matchReason: "Could not unambiguously match category. Please select from the dropdown.",
  };
}

// ==============================================================================
// 7. DYNAMIC SPECIFICATION & DROPDOWN MATCHING ENGINE
// ==============================================================================

/**
 * Standard alias mapping for common kitchen appliance specifications.
 */
const ATTRIBUTE_ALIASES: Record<string, string[]> = {
  "burner-count": ["burner count", "no of burners", "number of burners", "burners", "burner"],
  "cooktop-material": [
    "cooktop material",
    "top material",
    "surface material",
    "body material",
    "material",
    "finish",
  ],
  "ignition": ["ignition", "ignition type", "auto ignition", "ignition mode"],
  "burner-material": ["burner material", "burners material", "brass burners"],
  "gas-type": ["gas type", "gas compatibility", "fuel type"],
  "installation-type": [
    "installation type",
    "mount type",
    "mounting type",
    "installation",
    "type of installation",
  ],
  "width": ["width", "size", "dimension", "dimensions", "chimney size", "cooktop size"],
  "suction-capacity": [
    "suction capacity",
    "suction power",
    "suction",
    "air flow",
    "air suction capacity",
    "max suction",
  ],
  "filter-type": ["filter type", "filter", "filters", "chimney filter"],
  "control-type": ["control type", "controls", "control", "switch type", "operation mode"],
  "auto-clean": [
    "auto clean",
    "autoclean",
    "auto clean technology",
    "auto cleaning",
    "thermal auto clean",
  ],
  "mount-type": ["mount type", "mounting type", "installation type", "chimney type"],
  "microwave-type": ["type", "microwave type", "oven type"],
  "microwave-capacity": ["capacity", "volume", "cavity capacity", "oven capacity"],
  "microwave-power": ["power", "wattage", "output power", "microwave power"],
  "microwave-control-type": ["control type", "controls", "control"],
  "microwave-child-lock": ["child lock", "child safety lock", "safety lock"],
  "motor-power": ["motor power", "power", "wattage", "motor wattage", "motor"],
  "number-of-jars": ["number of jars", "no of jars", "jars", "jar count"],
  "jar-material": ["jar material", "jars material"],
  "speed-settings": ["speed settings", "speeds", "speed", "no of speeds"],
  "pulse-function": ["pulse function", "pulse", "incher", "incher feature"],
};

/**
 * Matches an extracted specification value to a dynamic category attribute
 * according to its type (SELECT, MULTI_SELECT, BOOLEAN, NUMBER, RANGE, TEXT).
 */
export function matchAttributeValue(
  attr: CategoryAttributeItem,
  rawValue: string
): {
  matchedValue: any;
  isMatched: boolean;
  displayLabel: string;
} {
  const normVal = normalizeString(rawValue);

  // 1. SELECT (Single option from predefinedValues)
  if (attr.type === "SELECT") {
    // Exact match on option value or label
    for (const opt of attr.predefinedValues) {
      if (
        normalizeString(opt.value) === normVal ||
        normalizeString(opt.label) === normVal
      ) {
        return {
          matchedValue: opt.id,
          isMatched: true,
          displayLabel: opt.label || opt.value,
        };
      }
    }

    // Number-only option match (e.g. option is "3", rawValue is "3 Burners" or "3")
    for (const opt of attr.predefinedValues) {
      const optNumMatch = opt.value.match(/^\d+$/);
      if (optNumMatch) {
        const valNumMatch = rawValue.match(/\b\d+\b/);
        if (valNumMatch && valNumMatch[0] === optNumMatch[0]) {
          return {
            matchedValue: opt.id,
            isMatched: true,
            displayLabel: opt.label || opt.value,
          };
        }
      }
    }

    // Match by distinct numeric value with units (e.g. option is "60 cm", "1200 m³/hr", "750W", "3 Jars")
    const valNumbers = rawValue.match(/\b\d+\b/g);
    if (valNumbers) {
      for (const numStr of valNumbers) {
        const numMatches = attr.predefinedValues.filter((opt) => {
          const optNum = opt.value.match(/\b\d+\b/);
          return optNum && optNum[0] === numStr;
        });
        if (numMatches.length === 1) {
          return {
            matchedValue: numMatches[0].id,
            isMatched: true,
            displayLabel: numMatches[0].label || numMatches[0].value,
          };
        }
      }
    }

    // Substring / Keyword match for common appliance terms
    for (const opt of attr.predefinedValues) {
      const optNorm = normalizeString(opt.value);
      // e.g. "Baffle Filter" vs "Baffle", "Automatic" vs "Auto", "Touch Control" vs "Touch"
      if (
        (optNorm.length > 3 && normVal.includes(optNorm)) ||
        (normVal.length > 3 && optNorm.includes(normVal))
      ) {
        return {
          matchedValue: opt.id,
          isMatched: true,
          displayLabel: opt.label || opt.value,
        };
      }
    }

    // Domain-specific synonym mappings
    for (const opt of attr.predefinedValues) {
      const optLower = opt.value.toLowerCase();
      if (optLower === "automatic" && /\bauto\b|\bautomatic\b/i.test(rawValue)) {
        return { matchedValue: opt.id, isMatched: true, displayLabel: opt.label || opt.value };
      }
      if (optLower === "manual" && /\bmanual\b/i.test(rawValue)) {
        return { matchedValue: opt.id, isMatched: true, displayLabel: opt.label || opt.value };
      }
      if (optLower === "glass" && /\bglass\b|\btoughened\b/i.test(rawValue)) {
        return { matchedValue: opt.id, isMatched: true, displayLabel: opt.label || opt.value };
      }
      if (optLower === "stainless steel" && /\bsteel\b|\bss\b/i.test(rawValue)) {
        return { matchedValue: opt.id, isMatched: true, displayLabel: opt.label || opt.value };
      }
      if (optLower === "touch control" && /\btouch\b/i.test(rawValue)) {
        return { matchedValue: opt.id, isMatched: true, displayLabel: opt.label || opt.value };
      }
      if (
        optLower.includes("motion") &&
        (/\bgesture\b|\bmotion\b|\bsensor\b/i.test(rawValue))
      ) {
        return { matchedValue: opt.id, isMatched: true, displayLabel: opt.label || opt.value };
      }
    }

    return { matchedValue: undefined, isMatched: false, displayLabel: "" };
  }

  // 2. MULTI_SELECT (Multiple options)
  if (attr.type === "MULTI_SELECT") {
    const matchedIds: string[] = [];
    const matchedLabels: string[] = [];

    for (const opt of attr.predefinedValues) {
      const optNorm = normalizeString(opt.value);
      if (normVal.includes(optNorm) || optNorm.includes(normVal)) {
        matchedIds.push(opt.id);
        matchedLabels.push(opt.label || opt.value);
      }
    }

    if (matchedIds.length > 0) {
      return {
        matchedValue: matchedIds,
        isMatched: true,
        displayLabel: matchedLabels.join(", "),
      };
    }
    return { matchedValue: undefined, isMatched: false, displayLabel: "" };
  }

  // 3. BOOLEAN (Yes/No, True/False)
  if (attr.type === "BOOLEAN") {
    if (
      /\b(?:yes|true|1|available|included|enabled|with)\b/i.test(rawValue) &&
      !/\b(?:no|not|without)\b/i.test(rawValue)
    ) {
      return { matchedValue: true, isMatched: true, displayLabel: "Yes" };
    }
    if (/\b(?:no|false|0|not available|none|without)\b/i.test(rawValue)) {
      return { matchedValue: false, isMatched: true, displayLabel: "No" };
    }
    return { matchedValue: undefined, isMatched: false, displayLabel: "" };
  }

  // 4. NUMBER (Numeric value with units safely extracted)
  if (attr.type === "NUMBER") {
    const numMatch = rawValue.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const parsedNum = parseFloat(numMatch[1]);
      if (!isNaN(parsedNum)) {
        return {
          matchedValue: parsedNum,
          isMatched: true,
          displayLabel: `${parsedNum}${attr.unit ? " " + attr.unit : ""}`,
        };
      }
    }
    return { matchedValue: undefined, isMatched: false, displayLabel: "" };
  }

  // 5. RANGE (e.g. 500 - 1000)
  if (attr.type === "RANGE") {
    const cleanRange = rawValue.replace(/[^\d\-\s\.]/g, "").trim();
    if (cleanRange) {
      return {
        matchedValue: cleanRange,
        isMatched: true,
        displayLabel: cleanRange,
      };
    }
    return { matchedValue: undefined, isMatched: false, displayLabel: "" };
  }

  // 6. TEXT (Freeform string)
  if (attr.type === "TEXT") {
    const textVal = rawValue.trim();
    if (textVal) {
      return {
        matchedValue: textVal,
        isMatched: true,
        displayLabel: textVal,
      };
    }
    return { matchedValue: undefined, isMatched: false, displayLabel: "" };
  }

  return { matchedValue: undefined, isMatched: false, displayLabel: "" };
}

/**
 * Maps all extracted specifications to the dynamic attributes of the selected category.
 */
export function matchDynamicCategoryAttributes(
  extractedSpecs: Record<string, string>,
  rawSpecs: RawSpecification[],
  categoryAttributes: CategoryAttributeItem[]
): {
  attributeValues: Record<string, any>;
  populatedSpecs: Array<{ attrName: string; valueDisplay: string }>;
  unmappedSpecs: Array<{ label: string; value: string }>;
} {
  const attributeValues: Record<string, any> = {};
  const populatedSpecs: Array<{ attrName: string; valueDisplay: string }> = [];
  const matchedSpecKeys = new Set<string>();

  for (const attr of categoryAttributes) {
    const attrNorm = normalizeString(attr.name);
    const attrSlug = attr.slug.toLowerCase();
    const aliases = ATTRIBUTE_ALIASES[attrSlug] || [];

    // Find if any extracted specification matches this attribute
    let matchedRawValue: string | undefined;
    let matchedKey: string | undefined;

    for (const [key, val] of Object.entries(extractedSpecs)) {
      if (matchedSpecKeys.has(key)) continue;

      // Exact match on normalized attribute name
      if (key === attrNorm) {
        matchedRawValue = val;
        matchedKey = key;
        break;
      }

      // Check configured domain aliases
      if (aliases.some((alias) => key === alias || key.includes(alias) || alias.includes(key))) {
        matchedRawValue = val;
        matchedKey = key;
        break;
      }

      // Substring match
      if (
        (attrNorm.length > 4 && key.includes(attrNorm)) ||
        (key.length > 4 && attrNorm.includes(key))
      ) {
        matchedRawValue = val;
        matchedKey = key;
        break;
      }
    }

    if (matchedRawValue && matchedKey) {
      const matchResult = matchAttributeValue(attr, matchedRawValue);
      if (matchResult.isMatched) {
        attributeValues[attr.id] = matchResult.matchedValue;
        populatedSpecs.push({
          attrName: attr.name,
          valueDisplay: matchResult.displayLabel,
        });
        matchedSpecKeys.add(matchedKey);
      }
    }
  }

  // Specifications that did not map to a database attribute record
  const unmappedSpecs = rawSpecs.filter(
    (s) => !matchedSpecKeys.has(normalizeString(s.label))
  );

  return {
    attributeValues,
    populatedSpecs,
    unmappedSpecs,
  };
}
