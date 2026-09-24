import { z } from "zod";
import { InventoryMovementType } from "@prisma/client";

export const stockMovementInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  movementType: z.nativeEnum(InventoryMovementType, {
    errorMap: () => ({
      message: "Please select a valid movement type (Purchase, Sale, Damaged, Return, or Adjustment).",
    }),
  }),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .refine((val) => val !== 0, {
      message: "Quantity cannot be zero",
    }),
  note: z
    .string()
    .trim()
    .max(1000, "Note cannot exceed 1000 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
}).refine(
  (data) => {
    // PURCHASE, SALE, DAMAGED, RETURN must have positive quantity in user input
    if (
      (data.movementType === InventoryMovementType.PURCHASE ||
        data.movementType === InventoryMovementType.SALE ||
        data.movementType === InventoryMovementType.DAMAGED ||
        data.movementType === InventoryMovementType.RETURN) &&
      data.quantity <= 0
    ) {
      return false;
    }
    return true;
  },
  {
    message: "Quantity must be greater than zero for Purchase, Sale, Damaged, and Return operations.",
    path: ["quantity"],
  }
);

export const updateLowStockThresholdSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  lowStockThreshold: z.coerce
    .number()
    .int("Threshold must be a whole number")
    .min(0, "Low-stock threshold must be 0 or greater"),
});

export const inventoryFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
  stockStatus: z
    .enum(["all", "in_stock", "low_stock", "out_of_stock"])
    .optional()
    .default("all"),
});

export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;
export type UpdateLowStockThresholdInput = z.infer<typeof updateLowStockThresholdSchema>;
export type InventoryFilterQuery = z.input<typeof inventoryFilterQuerySchema>;
