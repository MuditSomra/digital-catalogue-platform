import { NextRequest } from "next/server";
import { getProducts, createProduct } from "@/lib/product-service";
import {
  createProductSchema,
  productFilterQuerySchema,
} from "@/validations/product";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = productFilterQuerySchema.parse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 10,
      search: searchParams.get("search") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      brandId: searchParams.get("brandId") || undefined,
      status: searchParams.get("status") || "all",
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const result = await getProducts(query);
    return handleApiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createProductSchema.parse(body);
    const product = await createProduct(validatedData);
    return handleApiSuccess(product, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
