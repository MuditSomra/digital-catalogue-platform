import { z } from "zod";

export const brandSchema = z.object({
  name: z.string().min(2, "Brand name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().max(1000).optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateBrandSchema = brandSchema.partial();

export type BrandInput = z.infer<typeof brandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
