import { z } from "zod";

export const adminRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]);

export const adminUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  role: adminRoleSchema.default("ADMIN"),
  supabaseAuthId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const createAdminUserSchema = adminUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const updateAdminUserSchema = adminUserSchema.partial();

export type AdminUserInput = z.infer<typeof adminUserSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
