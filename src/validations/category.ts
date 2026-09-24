import { z } from "zod";
import { slugify } from "../lib/slugify";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name cannot exceed 100 characters"),
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
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  parentId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  sortOrder: z.coerce.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name cannot exceed 100 characters")
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
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  parentId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

// Backward compatibility alias
export const categorySchema = createCategorySchema;

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type CategoryInput = CreateCategoryInput;
