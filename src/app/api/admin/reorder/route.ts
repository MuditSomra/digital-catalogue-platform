import { NextRequest } from "next/server";
import { z } from "zod";
import { reorderCategories } from "@/lib/category-service";
import {
  reorderCategoryAttributes,
  reorderAttributeValues,
} from "@/lib/attribute-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const reorderPayloadSchema = z.object({
  type: z.enum(["category", "attribute", "option"], {
    errorMap: () => ({ message: "Type must be 'category', 'attribute', or 'option'" }),
  }),
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, items } = reorderPayloadSchema.parse(body);

    if (type === "category") {
      await reorderCategories(items);
    } else if (type === "attribute") {
      await reorderCategoryAttributes(items);
    } else if (type === "option") {
      await reorderAttributeValues(items);
    }

    return handleApiSuccess({ message: "Items reordered successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
