/**
 * @kb-labs/analytics-sdk-node
 * Node.js SDK with ergonomic helpers for emitting analytics events
 */

import { Analytics, type AnalyticsOptions } from '@kb-labs/analytics-core';
import type { AnalyticsEventV1, EmitResult, RunScope, EventActor, EventContext } from '@kb-labs/analytics-core';

// Singleton instance (lazy-initialized)
let analyticsInstance: Analytics | null = null;

/**
 * Get or create singleton analytics instance
 */
function getAnalytics(): Analytics {
  if (!analyticsInstance) {
    analyticsInstance = new Analytics({
      cwd: process.cwd(),
    });
  }
  return analyticsInstance;
}

/**
 * Initialize analytics (optional - auto-initialized on first emit)
 */
export async function init(options?: AnalyticsOptions): Promise<void> {
  analyticsInstance = new Analytics(options);
  await analyticsInstance.init();
}

/**
 * Emit an event (fire-and-forget, never throws)
 */
export async function emit(event: Partial<AnalyticsEventV1>): Promise<EmitResult> {
  const analytics = getAnalytics();
  return analytics.emit(event);
}

/**
 * Create a run scope for grouping events
 */
export function runScope(options?: {
  runId?: string;
  actor?: EventActor;
  ctx?: EventContext;
}): RunScope {
  const analytics = getAnalytics();
  return analytics.createRunScope(options?.runId, options?.actor, options?.ctx);
}

/**
 * Lightweight task helper
 */
export async function task(eventType: string, payload: Record<string, unknown>): Promise<EmitResult> {
  const analytics = getAnalytics();
  return analytics.task(eventType, payload);
}

/**
 * Get current metrics
 */
export function getMetrics() {
  const analytics = getAnalytics();
  return analytics.getMetrics();
}

/**
 * Get backpressure state
 */
export function getBackpressureState() {
  const analytics = getAnalytics();
  return analytics.getBackpressureState();
}

/**
 * Force flush buffer to sinks
 */
export async function flush(): Promise<void> {
  const analytics = getAnalytics();
  return analytics.flush();
}

/**
 * Dispose analytics instance
 */
export async function dispose(): Promise<void> {
  if (analyticsInstance) {
    await analyticsInstance.dispose();
    analyticsInstance = null;
  }
}

/**
 * Export analytics instance for advanced usage
 */
export { Analytics };
export type {
  AnalyticsEventV1,
  EmitResult,
  RunScope,
  EventActor,
  EventContext,
  AnalyticsOptions,
};

