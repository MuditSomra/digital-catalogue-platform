import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { HealthCheckResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const startTime = Date.now();
  let dbConnected = false;
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  try {
    const dbStartTime = Date.now();
    // Test raw query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStartTime;
    dbConnected = true;
  } catch (error: unknown) {
    dbConnected = false;
    dbError =
      error instanceof Error
        ? error.message.includes("Can't reach database server")
          ? "Database server unreachable"
          : "Database query failed"
        : "Unknown database error";
  }

  const isHealthy = dbConnected;
  const status: "ok" | "degraded" = isHealthy ? "ok" : "degraded";

  const responseBody: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database: {
      connected: dbConnected,
      ...(dbLatencyMs !== undefined && { latencyMs: dbLatencyMs }),
      ...(dbError && { error: dbError }),
    },
    version: "1.0.0-phase1",
  };

  return NextResponse.json(responseBody, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
