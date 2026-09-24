import { z } from "zod";

export const movementTypeSchema = z.enum([
  "PURCHASE",
  "SALE",
  "DAMAGED",
  "RETURN",
  "ADJUSTMENT",
]);

export const inventorySchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  lowStockThreshold: z.number().int().min(0, "Threshold cannot be negative").default(5),
});

export const inventoryMovementSchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
  quantity: z.number().int().refine((val) => val !== 0, "Movement quantity cannot be zero"),
  movementType: movementTypeSchema,
  note: z.string().max(1000).optional().nullable(),
  createdById: z.string().cuid("Invalid admin user ID").optional().nullable(),
});

export const updateInventorySchema = z.object({
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export type InventoryInput = z.infer<typeof inventorySchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
