import { AsyncLocalStorage } from "async_hooks";
import { NextResponse } from "next/server";

export interface TimingMetric {
  name: string;
  dur: number;
  desc?: string;
}

const timingStorage = new AsyncLocalStorage<TimingCollector>();

export class TimingCollector {
  public readonly reqId: string;
  public readonly endpoint: string;
  public readonly isInitial: boolean;
  private readonly startTime: number;
  private metrics: TimingMetric[] = [];

  constructor(endpoint: string, isInitial: boolean) {
    this.endpoint = endpoint;
    this.isInitial = isInitial;
    this.reqId = Math.random().toString(36).substring(2, 10);
    this.startTime = performance.now();
  }

  record(name: string, durMs: number, desc?: string): void {
    this.metrics.push({
      name,
      dur: Math.max(0, Math.round(durMs * 10) / 10),
      desc,
    });
  }

  async time<T>(name: string, fn: () => Promise<T> | T, desc?: string): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      this.record(name, performance.now() - t0, desc);
    }
  }

  attachToResponse(response: Response | NextResponse): void {
    const totalMs = Math.max(0, Math.round((performance.now() - this.startTime) * 10) / 10);
    const instanceDesc = this.isInitial ? "module_initial" : "module_reused";

    // Build W3C Server-Timing header value
    // Syntax: metric;dur=123.4;desc="Description", metric2;dur=45.6
    const serverTimingParts = [
      `instance;desc="${instanceDesc}"`,
      ...this.metrics.map((m) => {
        const safeDesc = m.desc ? `;desc="${m.desc.replace(/"/g, "'")}"` : "";
        return `${m.name};dur=${m.dur}${safeDesc}`;
      }),
      `total;dur=${totalMs};desc="Total Handler Duration"`,
    ];

    const headerValue = serverTimingParts.join(", ");

    try {
      response.headers.set("Server-Timing", headerValue);
      response.headers.set("X-Correlation-Id", this.reqId);
    } catch {
      // In case headers object is immutable
    }

    // Structured server-side logging for Vercel Runtime Logs
    const logData = {
      tag: "PERF_DIAG",
      reqId: this.reqId,
      endpoint: this.endpoint,
      totalMs,
      instance: instanceDesc,
      timings: Object.fromEntries(this.metrics.map((m) => [m.name, m.dur])),
    };
    console.log(JSON.stringify(logData));
  }
}

export function createTimingContext(endpoint: string, isInitial: boolean): TimingCollector {
  return new TimingCollector(endpoint, isInitial);
}

export function runWithTiming<T>(collector: TimingCollector, fn: () => Promise<T>): Promise<T> {
  return timingStorage.run(collector, fn);
}

export function getActiveTiming(): TimingCollector | undefined {
  return timingStorage.getStore();
}

/**
 * Executes an async or sync function and measures its elapsed duration.
 * If an active timing context exists in the current async execution scope,
 * the metric is recorded on that context.
 */
export async function timeOperation<T>(
  name: string,
  fn: () => Promise<T> | T,
  desc?: string
): Promise<T> {
  const collector = getActiveTiming();
  if (!collector) {
    return await fn();
  }
  return collector.time(name, fn, desc);
}
