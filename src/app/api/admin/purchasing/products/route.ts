import { NextRequest, NextResponse } from "next/server";
import { requireApiOwnerAuth } from "@/lib/auth-server";
import { createProductWithInitialQuotation, PurchasingError } from "@/lib/purchasing-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createProductWithQuotationSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  sku: z.string().trim().min(2, "SKU must be at least 2 characters"),
  modelNumber: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  brandId: z.string().min(1, "Please select a brand"),
  categoryId: z.string().min(1, "Please select a primary category"),
  categoryIds: z.array(z.string()).optional().default([]),
  mrp: z.number().positive("MRP must be greater than 0"),
  sellingPrice: z.number().positive("Selling price must be greater than 0").nullable().optional(),
  privatePriceCode: z.string().trim().nullable().optional(),
  warranty: z.string().trim().nullable().optional(),
  initialQuotation: z.object({
    supplierName: z.string().trim().min(1, "Supplier name is required"),
    quotedPrice: z.number().positive("Quoted price must be greater than 0"),
    quotationDate: z.string().optional(),
    validUntil: z.string().nullable().optional(),
    moq: z.number().int().positive().nullable().optional(),
    leadTimeDays: z.number().int().positive().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Owner-only RBAC
    const auth = await requireApiOwnerAuth();
    if (!auth.isValid) {
      return auth.response;
    }

    const body = await request.json();

    // Support both nested initialQuotation or flat quotation fields
    let initialQuotation = body.initialQuotation;
    if (!initialQuotation && body.supplierName && body.quotedPrice) {
      initialQuotation = {
        supplierName: body.supplierName,
        quotedPrice: body.quotedPrice,
        quotationDate: body.quotationDate,
        validUntil: body.validUntil,
        moq: body.moq,
        leadTimeDays: body.leadTimeDays,
        notes: body.notes,
      };
    }

    const normalizedBody = {
      ...body,
      categoryIds: body.additionalCategoryIds || body.categoryIds || [],
      initialQuotation,
    };

    const validated = createProductWithQuotationSchema.parse(normalizedBody);

    const result = await createProductWithInitialQuotation({
      ...validated,
      createdById: auth.user.id,
    });

    return handleApiSuccess(result, 201);
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
