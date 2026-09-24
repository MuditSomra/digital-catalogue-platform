import { z } from "zod";
import { slugify } from "../lib/slugify";

export const attributeTypeSchema = z.enum(
  ["SELECT", "MULTI_SELECT", "TEXT", "NUMBER", "BOOLEAN", "RANGE"],
  {
    errorMap: () => ({
      message: "Please choose a valid specification type from the list",
    }),
  }
);

export const createCategoryAttributeSchema = z.object({
  categoryId: z.string().trim().min(1, "Category ID is required"),
  name: z
    .string()
    .trim()
    .min(2, "Specification name must be at least 2 characters")
    .max(100, "Specification name cannot exceed 100 characters"),
  slug: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((val, ctx) => {
      if (!val || val.length === 0) return undefined;
      const cleaned = slugify(val);
      if (!cleaned || cleaned.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slug must contain at least 2 alphanumeric characters",
        });
        return z.NEVER;
      }
      return cleaned;
    }),
  type: attributeTypeSchema,
  unit: z
    .string()
    .trim()
    .max(30, "Unit cannot exceed 30 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isFilterable: z.boolean().optional().default(true),
  isRequired: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
  // Optional initial options when creating a SELECT or MULTI_SELECT specification
  initialOptions: z.array(z.string().trim().min(1)).optional(),
});

export const updateCategoryAttributeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Specification name must be at least 2 characters")
    .max(100, "Specification name cannot exceed 100 characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((val, ctx) => {
      if (!val || val.length === 0) return undefined;
      const cleaned = slugify(val);
      if (!cleaned || cleaned.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slug must contain at least 2 alphanumeric characters",
        });
        return z.NEVER;
      }
      return cleaned;
    }),
  type: attributeTypeSchema.optional(),
  unit: z
    .string()
    .trim()
    .max(30, "Unit cannot exceed 30 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isFilterable: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const createAttributeValueSchema = z.object({
  attributeId: z.string().trim().min(1, "Specification ID is required"),
  value: z
    .string()
    .trim()
    .min(1, "Option value is required")
    .max(100, "Option value cannot exceed 100 characters"),
  label: z
    .string()
    .trim()
    .min(1, "Option display label is required")
    .max(100, "Option display label cannot exceed 100 characters")
    .optional()
    .transform((val) => {
      return val && val.length > 0 ? val : undefined;
    }),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const updateAttributeValueSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, "Option value is required")
    .max(100, "Option value cannot exceed 100 characters")
    .optional(),
  label: z
    .string()
    .trim()
    .min(1, "Option display label is required")
    .max(100, "Option display label cannot exceed 100 characters")
    .optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const reorderItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int(),
    })
  ),
});

// Backward compatibility aliases
export const categoryAttributeSchema = createCategoryAttributeSchema;
export const attributeValueSchema = createAttributeValueSchema;

export type CreateCategoryAttributeInput = z.input<typeof createCategoryAttributeSchema>;
export type UpdateCategoryAttributeInput = z.input<typeof updateCategoryAttributeSchema>;
export type CreateAttributeValueInput = z.input<typeof createAttributeValueSchema>;
export type UpdateAttributeValueInput = z.input<typeof updateAttributeValueSchema>;

export type CategoryAttributeInput = CreateCategoryAttributeInput;
export type AttributeValueInput = CreateAttributeValueInput;
