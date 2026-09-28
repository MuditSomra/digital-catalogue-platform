import { NextRequest, NextResponse } from "next/server";
import { requireApiOwnerAuth } from "@/lib/auth-server";
import { getProductQuotations, createSupplierQuotation, PurchasingError } from "@/lib/purchasing-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createQuotationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  supplierName: z.string().trim().min(1, "Supplier name is required"),
  quotedPrice: z.number().positive("Quoted price must be greater than 0"),
  quotationDate: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  moq: z.number().int().positive().nullable().optional(),
  leadTimeDays: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    // 1. Enforce Owner-only RBAC
    const auth = await requireApiOwnerAuth();
    if (!auth.isValid) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const search = searchParams.get("search") || undefined;
    const sortBy = searchParams.get("sortBy") || "lowest_price";

    // Parse any attribute filter query parameters (prefix attr_)
    const attributeFilters: Record<string, string[]> = {};
    searchParams.forEach((val, key) => {
      if (key.startsWith("attr_")) {
        const attrSlug = key.replace("attr_", "");
        attributeFilters[attrSlug] = val.split(",").filter(Boolean);
      }
    });

    const result = await getProductQuotations({
      categoryId,
      search,
      sortBy,
      attributeFilters: Object.keys(attributeFilters).length > 0 ? attributeFilters : null,
    });

    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Owner-only RBAC
    const auth = await requireApiOwnerAuth();
    if (!auth.isValid) {
      return auth.response;
    }

    const body = await request.json();
    const validated = createQuotationSchema.parse(body);

    const quotation = await createSupplierQuotation({
      ...validated,
      createdById: auth.user.id,
    });

    return handleApiSuccess(quotation, 201);
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
