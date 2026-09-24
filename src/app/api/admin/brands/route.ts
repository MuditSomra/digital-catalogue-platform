import { NextRequest } from "next/server";
import { getBrands, createBrand } from "@/lib/product-service";
import { brandSchema } from "@/validations/brand";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const brands = await getBrands();
    return handleApiSuccess(brands);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = brandSchema.parse(body);
    const brand = await createBrand(validatedData);
    return handleApiSuccess(brand, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
