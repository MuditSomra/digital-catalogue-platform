import { NextRequest } from "next/server";
import {
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/lib/product-service";
import { updateProductSchema } from "@/validations/product";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    return handleApiSuccess(product);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateProductSchema.parse(body);
    const updated = await updateProduct(id, validatedData);
    return handleApiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteProduct(id);
    return handleApiSuccess({ message: "Product deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
