/**
 * Product Overview Parser
 *
 * Deterministically parses product description text into structured specification tables,
 * key feature bullet points, included accessories tables, and readable notes.
 *
 * Designed for showroom/catalogue workflows where product specs are extracted from
 * packaging or images via ChatGPT in `Label: Value` format and pasted into the Description field.
 */

export interface SpecificationRow {
  label: string;
  value: string;
}

export interface AccessoryRow {
  accessory: string;
  quantity: string | null;
}

export interface ParsedProductOverview {
  /** Leading unstructured intro paragraphs or text before structured sections */
  introText?: string;
  /** Primary specifications table rows (Label: Value) */
  specifications: SpecificationRow[];
  /** Bulleted key features list */
  keyFeatures: string[];
  /** Included accessories table rows (Accessory, Quantity) */
  accessories: AccessoryRow[];
  /** Trailing unstructured lines or notes */
  trailingNotes?: string;
  /** Whether any structured content (specs, features, or accessories) was successfully parsed */
  isStructured: boolean;
  /** Original raw description text for fallback */
  rawText: string;
}

// Section heading matchers
const ACCESSORIES_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:included\s+accessories|accessories\s+included|in(?:side)?\s+the\s+box|what'?s\s+in\s+the\s+box|box\s+contents|package\s+contents|items\s+included)(?:\*\*)?:?\s*(.*)$/i;

const FEATURES_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:key\s+features|product\s+features|features|highlights)(?:\*\*)?:?\s*(.*)$/i;

const SPECS_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:product\s+specifications|technical\s+specifications|general\s+specifications|specifications|specs|product\s+overview|overview)(?:\*\*)?:?\s*(.*)$/i;

const NOTES_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*\*)?(?:important\s+note|notes?|please\s+note|disclaimer|caution|warning|terms\s*(?:&|and)\s*conditions|installation\s+note|additional\s+info(?:rmation)?)(?:\*\*)?:?\s*(.*)$/i;

/**
 * Strips leading list bullets, dashes, numbers, and markdown symbols from a line.
 */
export function cleanListPrefix(line: string): string {
  return line
    .replace(/^[\*\-•–—]\s*/, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .trim();
}

/**
 * Parses an accessory line into accessory name and optional quantity.
 * Handles separators like en-dash, em-dash, hyphen, colon, 'x', and parenthesized quantities,
 * without splitting accessory names that lack quantities.
 */
export function parseAccessoryLine(rawLine: string): AccessoryRow {
  const line = cleanListPrefix(rawLine);
  if (!line) {
    return { accessory: "", quantity: null };
  }

  // Trailing quantity pattern:
  // e.g. "Main Hood – 1", "Baffle Filters - 2", "Wall Mounting Screws — 4", "Duct Pipe: 1", "Screws x 4"
  // Supports units like "1 Pc", "2 Nos", "4 Pieces", "1 Unit", etc.
  const trailingMatch = line.match(
    /^(.+?)\s*(?:[\–\—\-:]|\bx|\bqty:?)\s*(\d+(?:\s*(?:pcs|pc|nos|no|pieces|piece|units?|sets?|pairs?))?)$/i
  );
  if (trailingMatch && trailingMatch[1].trim() && trailingMatch[2].trim()) {
    return {
      accessory: trailingMatch[1].trim(),
      quantity: trailingMatch[2].trim(),
    };
  }

  // Parenthesized quantity pattern:
  // e.g. "Mounting Screws (4)", "Charcoal Filters (2 pcs)", "Ducting Kit (Qty: 1)"
  const parenMatch = line.match(
    /^(.+?)\s*\((?:qty:?\s*)?(\d+(?:\s*(?:pcs|pc|nos|no|pieces|piece|units?|sets?|pairs?))?)\)$/i
  );
  if (parenMatch && parenMatch[1].trim() && parenMatch[2].trim()) {
    return {
      accessory: parenMatch[1].trim(),
      quantity: parenMatch[2].trim(),
    };
  }

  // Leading quantity pattern:
  // e.g. "1 x Main Hood", "2x Baffle Filters", "4 - Wall Screws"
  const leadingMatch = line.match(
    /^(\d+(?:\s*(?:pcs|pc|nos|no|pieces|piece|units?|sets?|pairs?))?)\s*(?:x|\*|\-|\–|\—)\s*(.+)$/i
  );
  if (leadingMatch && leadingMatch[1].trim() && leadingMatch[2].trim()) {
    return {
      accessory: leadingMatch[2].trim(),
      quantity: leadingMatch[1].trim(),
    };
  }

  // No identifiable quantity: preserve the entire text as accessory name
  return {
    accessory: line,
    quantity: null,
  };
}

/**
 * Attempts to parse a line as `Label: Value`.
 * Splits at the first colon only, preserving any colons within the value.
 * Validates that the label is reasonable (not a prose sentence).
 */
export function parseSpecificationLine(rawLine: string): SpecificationRow | null {
  const line = cleanListPrefix(rawLine);
  const colonIndex = line.indexOf(":");
  if (colonIndex <= 0) return null;

  const rawLabel = line.slice(0, colonIndex).trim();
  const rawValue = line.slice(colonIndex + 1).trim();

  // Strip markdown bold wrappers like **Brand:** or **Brand**
  const label = rawLabel.replace(/^\*\*|\*\*$/g, "").trim();
  const value = rawValue.replace(/^\*\*|\*\*$/g, "").trim();

  // Validate that label is a plausible specification attribute name
  // Must be non-empty, concise (<= 55 characters), and not a full sentence with period
  if (!label || label.length > 55 || label.includes(".")) {
    return null;
  }

  // Value must be non-empty
  if (!value) {
    return null;
  }

  return { label, value };
}

/**
 * Deterministically parses a product description into structured tables and sections.
 */
export function parseProductOverview(rawDescription?: string | null): ParsedProductOverview {
  const rawText = rawDescription?.trim() || "";
  if (!rawText) {
    return {
      specifications: [],
      keyFeatures: [],
      accessories: [],
      isStructured: false,
      rawText: "",
    };
  }

  const lines = rawText.split(/\r?\n/);
  const specifications: SpecificationRow[] = [];
  const keyFeatures: string[] = [];
  const accessories: AccessoryRow[] = [];
  const introLines: string[] = [];
  const trailingLines: string[] = [];

  let currentSection: "initial" | "specs" | "features" | "accessories" | "notes" = "initial";

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Blank lines
    if (!trimmed) {
      if (currentSection === "initial" && introLines.length > 0 && specifications.length === 0) {
        // Preserve paragraph separation in intro
        if (introLines[introLines.length - 1] !== "") {
          introLines.push("");
        }
      }
      continue;
    }

    // Check for section transitions
    const notesMatch = trimmed.match(NOTES_HEADER_REGEX);
    if (notesMatch) {
      currentSection = "notes";
      trailingLines.push(trimmed);
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
        const spec = parseSpecificationLine(specsMatch[1]);
        if (spec) specifications.push(spec);
      }
      continue;
    }

    // Handle lines according to current section
    if (currentSection === "notes") {
      trailingLines.push(trimmed);
      continue;
    }

    if (currentSection === "accessories") {
      const item = parseAccessoryLine(trimmed);
      if (item.accessory) {
        accessories.push(item);
      }
      continue;
    }

    if (currentSection === "features") {
      const feat = cleanListPrefix(trimmed);
      if (feat) {
        keyFeatures.push(feat);
      }
      continue;
    }

    // currentSection is "initial" or "specs"
    const spec = parseSpecificationLine(trimmed);
    if (spec) {
      specifications.push(spec);
      currentSection = "specs";
    } else {
      if (specifications.length === 0) {
        introLines.push(trimmed);
      } else {
        trailingLines.push(trimmed);
      }
    }
  }

  const isStructured =
    specifications.length > 0 || accessories.length > 0 || keyFeatures.length > 0;

  const introText = introLines.join("\n").trim() || undefined;
  const trailingNotes = trailingLines.join("\n").trim() || undefined;

  return {
    introText,
    specifications,
    keyFeatures,
    accessories,
    trailingNotes,
    isStructured,
    rawText,
  };
}
