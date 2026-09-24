import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates percentage discount from MRP and Selling Price.
 * Discount % = ((MRP - Selling Price) / MRP) * 100
 */
export function calculateDiscount(mrp: number, sellingPrice?: number | null): number | null {
  if (!sellingPrice || mrp <= 0 || sellingPrice >= mrp) {
    return null;
  }
  const discount = ((mrp - sellingPrice) / mrp) * 100;
  return Math.round(discount);
}

/**
 * Formats a currency amount in Indian Rupees (INR).
 */
export function formatINR(amount: number | string | { toNumber?: () => number }): string {
  const num = typeof amount === "number" ? amount : typeof amount === "string" ? parseFloat(amount) : amount.toNumber ? amount.toNumber() : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}
