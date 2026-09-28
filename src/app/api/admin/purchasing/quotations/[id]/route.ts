import { NextRequest, NextResponse } from "next/server";
import { requireApiOwnerAuth } from "@/lib/auth-server";
import { updateSupplierQuotation, deleteSupplierQuotation, PurchasingError } from "@/lib/purchasing-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateQuotationSchema = z.object({
  supplierName: z.string().trim().min(1, "Supplier name cannot be empty").optional(),
  quotedPrice: z.number().positive("Quoted price must be greater than 0").optional(),
  quotationDate: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  moq: z.number().int().positive().nullable().optional(),
  leadTimeDays: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Enforce Owner-only RBAC
    const auth = await requireApiOwnerAuth();
    if (!auth.isValid) {
      return auth.response;
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateQuotationSchema.parse(body);

    const updated = await updateSupplierQuotation(id, validated);

    return handleApiSuccess(updated);
  } catch (error) {
    if (error instanceof PurchasingError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PURCHASING_ERROR",
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Enforce Owner-only RBAC
    const auth = await requireApiOwnerAuth();
    if (!auth.isValid) {
      return auth.response;
    }

    const { id } = await params;
    await deleteSupplierQuotation(id);

    return handleApiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof PurchasingError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PURCHASING_ERROR",
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }
    return handleApiError(error);
  }
}
