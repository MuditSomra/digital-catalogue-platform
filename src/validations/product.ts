import { z } from "zod";

export const videoTypeSchema = z.enum(["CLOUDINARY", "YOUTUBE"]);

export const productImageSchema = z.object({
  url: z.string().url("Invalid image URL"),
  publicId: z.string().optional().nullable(),
  altText: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const productVideoSchema = z.object({
  videoType: videoTypeSchema,
  url: z.string().min(1, "Video URL/ID is required"),
  title: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export const productAttributeValueInputSchema = z.object({
  attributeId: z.string().cuid("Invalid attribute ID"),
  attributeValueId: z.string().cuid().optional().nullable(),
  value: z.string().min(1, "Value is required"),
  numericValue: z.number().optional().nullable(),
  booleanValue: z.boolean().optional().nullable(),
});

export const baseProductSchema = z.object({
  name: z.string().min(3, "Product name must be at least 3 characters").max(255),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  sku: z
    .string()
    .min(3, "SKU must be at least 3 characters")
    .max(100)
    .regex(/^[A-Za-z0-9-_]+$/, "SKU must contain only letters, numbers, hyphens, and underscores"),
  modelNumber: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  brandId: z.string().cuid("Invalid brand ID"),
  categoryId: z.string().cuid("Invalid category ID"),
  mrp: z.number().positive("MRP must be greater than zero"),
  sellingPrice: z.number().positive("Selling price must be greater than zero").optional().nullable(),
  privatePriceCode: z.string().max(100).optional().nullable(),
  warranty: z.string().max(255).optional().nullable(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  attributeValues: z.array(productAttributeValueInputSchema).optional(),
  images: z.array(productImageSchema).optional(),
  videos: z.array(productVideoSchema).optional(),
});

export const productSchema = baseProductSchema.refine(
  (data) => {
    if (data.sellingPrice != null && data.sellingPrice > data.mrp) {
      return false;
    }
    return true;
  },
  {
    message: "Selling price cannot exceed MRP",
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
    message: "Selling price cannot exceed MRP",
    path: ["sellingPrice"],
  }
);

export type ProductInput = z.infer<typeof productSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
export type ProductVideoInput = z.infer<typeof productVideoSchema>;
export type ProductAttributeValueInput = z.infer<typeof productAttributeValueInputSchema>;
