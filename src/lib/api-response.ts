import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CategoryServiceError } from "./category-service";
import { AttributeServiceError } from "./attribute-service";
import { ProductServiceError } from "./product-service";
import { InventoryServiceError } from "./inventory-service";

export function handleApiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (
    error instanceof CategoryServiceError ||
    error instanceof AttributeServiceError ||
    error instanceof ProductServiceError ||
    error instanceof InventoryServiceError
  ) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const message = error.errors.map((e) => e.message).join(". ");
    return NextResponse.json(
      {
        success: false,
        error: message || "Invalid input data. Please check the entered fields.",
        details: error.errors,
      },
      { status: 400 }
    );
  }

  // Handle generic prisma constraint errors with friendly fallback
  if (typeof error === "object" && error !== null && "code" in error) {
    const prismaError = error as { code: string; meta?: Record<string, unknown> };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "A record with this name, SKU, or identifier already exists.",
        },
        { status: 409 }
      );
    }
    if (prismaError.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "This item cannot be modified or deleted because other items depend on it.",
        },
        { status: 409 }
      );
    }
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: "The requested item was not found.",
        },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: "An unexpected error occurred. Please try again or contact support.",
    },
    { status: 500 }
  );
}
