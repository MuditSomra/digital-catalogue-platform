import { z } from "zod";
import { slugify } from "../lib/slugify";

export const productAttributeValueInputSchema = z.object({
  attributeId: z.string().trim().min(1, "Specification ID is required"),
  attributeValueId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  value: z.union([
    z.string().trim().min(1, "Value is required"),
    z.array(z.string().trim().min(1)),
    z.number(),
    z.boolean(),
  ]),
  numericValue: z.number().optional().nullable(),
  booleanValue: z.boolean().optional().nullable(),
});

export const baseProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(255, "Product name cannot exceed 255 characters"),
  slug: z
    .string()
    .trim()
    .max(255)
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
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(100, "SKU cannot exceed 100 characters")
    .transform((val) => val.toUpperCase()),
  modelNumber: z
    .string()
    .trim()
    .max(100, "Model number cannot exceed 100 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  brandId: z.string().trim().min(1, "Please select a brand"),
  categoryId: z.string().trim().min(1, "Please select a category"),
  mrp: z.coerce.number().positive("MRP must be greater than zero"),
  sellingPrice: z.coerce
    .number()
    .positive("Selling price must be greater than zero")
    .optional()
    .nullable()
    .transform((val) => (val === 0 || isNaN(val as number) ? null : val)),
  privatePriceCode: z
    .string()
    .trim()
    .max(100, "Price Code cannot exceed 100 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  warranty: z
    .string()
    .trim()
    .max(255, "Warranty cannot exceed 255 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  attributes: z.array(productAttributeValueInputSchema).optional(),
  attributeValues: z.array(productAttributeValueInputSchema).optional(),
});

export const createProductSchema = baseProductSchema.refine(
  (data) => {
    if (data.sellingPrice != null && data.sellingPrice > data.mrp) {
      return false;
    }
    return true;
  },
  {
    message: "Selling Price cannot exceed MRP",
    path: ["sellingPrice"],
  }
);

export const updateProductSchema = baseProductSchema.partial().refine(
  (data) => {
    if (data.sellingPrice != null && data.mrp != null && data.sellingPrice > data.mrp) {
      return false;
    }
    return true;
  },
  {
    message: "Selling Price cannot exceed MRP",
    path: ["sellingPrice"],
  }
);

export const productFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
  status: z.enum(["all", "active", "inactive", "featured"]).optional().default("all"),
  sortBy: z.enum(["name", "createdAt", "mrp", "sellingPrice"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Backward compatibility alias
export const productSchema = createProductSchema;

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type ProductInput = CreateProductInput;
export type ProductFilterQuery = z.input<typeof productFilterQuerySchema>;
export type ProductAttributeValueInput = z.infer<typeof productAttributeValueInputSchema>;
