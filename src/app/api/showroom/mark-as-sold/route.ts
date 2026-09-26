import { NextRequest } from "next/server";
import { verifyOwnerPin } from "@/lib/pin-service";
import { recordStockMovement } from "@/lib/inventory-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { InventoryMovementType } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const markAsSoldSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits"),
  note: z.string().max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity, pin, note } = markAsSoldSchema.parse(body);

    // 1. Verify owner PIN (checks lockout & failure thresholds)
    await verifyOwnerPin(pin);

    // 2. Atomically record the sale via inventory service
    const result = await recordStockMovement({
      productId,
      movementType: InventoryMovementType.SALE,
      quantity,
      note: note?.trim() || "Showroom Quick Sale (Mark as Sold)",
    });

    return handleApiSuccess({
      success: true,
      product: {
        id: productId,
        newQuantity: result.inventory.quantity,
        stockStatus: result.inventory.stockStatus,
      },
      movement: result.movement,
      message: `Successfully recorded sale of ${quantity} unit(s). Remaining stock: ${result.inventory.quantity}.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
