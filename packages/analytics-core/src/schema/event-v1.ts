/**
 * Zod schema for AnalyticsEventV1
 */

import { z } from 'zod';

// Actor type enum
const ActorTypeSchema = z.enum(['user', 'agent', 'ci']);

// Actor schema
const EventActorSchema = z.object({
  type: ActorTypeSchema,
  id: z.string().optional(),
  name: z.string().optional(),
});

// Source schema
const EventSourceSchema = z.object({
  product: z.string().min(1),
  version: z.string().min(1),
});

// Context schema - flexible object with string/number/boolean/null values
const EventContextSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()])
).optional();

// HashMeta schema
const HashMetaSchema = z.object({
  algo: z.literal('hmac-sha256'),
  saltId: z.string().min(1),
}).optional();

// Main AnalyticsEventV1 schema
export const AnalyticsEventV1Schema = z.object({
  id: z.string().uuid().describe('UUID v7 event identifier (standard UUID format)'),
  schema: z.literal('kb.v1'),
  type: z.string().min(1).describe('Event type (e.g. "audit.run.finished")'),
  ts: z.string().datetime({ offset: true }).describe('ISO 8601 UTC timestamp when event occurred'),
  ingestTs: z.string().datetime({ offset: true }).describe('ISO 8601 UTC timestamp when event was ingested by SDK'),
  source: EventSourceSchema,
  runId: z.string().min(1).describe('Correlation ID for grouping events within a run'),
  actor: EventActorSchema.optional(),
  ctx: EventContextSchema,
  payload: z.unknown().optional(),
  hashMeta: HashMetaSchema,
});

export type AnalyticsEventV1 = z.infer<typeof AnalyticsEventV1Schema>;

/**
 * Validate an event against the schema
 * Returns validated event or throws ZodError
 */
export function validateEvent(data: unknown): AnalyticsEventV1 {
  return AnalyticsEventV1Schema.parse(data);
}

/**
 * Safe validation that returns result instead of throwing
 */
export function safeValidateEvent(data: unknown): {
  success: boolean;
  data?: AnalyticsEventV1;
  error?: z.ZodError;
} {
  const result = AnalyticsEventV1Schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

