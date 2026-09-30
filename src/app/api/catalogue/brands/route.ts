import { NextRequest } from "next/server";
import { getBrands } from "@/lib/product-service";
import { handleApiSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const t0 = performance.now();
  try {
    const tDb0 = performance.now();
    const brands = await getBrands();
    const tDb = performance.now() - tDb0;

    const tResp0 = performance.now();
    const resp = handleApiSuccess(brands);
    const tResp = performance.now() - tResp0;
    const tTotal = performance.now() - t0;

    console.log(
      `[PERF][catalogue/brands] db=${tDb.toFixed(1)}ms response=${tResp.toFixed(1)}ms total=${tTotal.toFixed(1)}ms`
    );

    return resp;
  } catch (error) {
    return handleApiError(error);
  }
}
