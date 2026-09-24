import { z } from "zod";
import { slugify } from "../lib/slugify";

export const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name must be at least 2 characters")
    .max(100, "Brand name cannot exceed 100 characters"),
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
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  logoUrl: z
    .string()
    .trim()
    .url("Invalid logo URL")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isActive: z.boolean().optional().default(true),
});

export const updateBrandSchema = brandSchema.partial();

export type BrandInput = z.input<typeof brandSchema>;
export type UpdateBrandInput = z.input<typeof updateBrandSchema>;
