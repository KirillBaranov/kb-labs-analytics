# ADR-0012: Event Schema Validation

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** KB Labs Team

## Context

KB Labs Analytics needs strict event validation to:
- **Ensure data quality** (consistent event structure)
- **Prevent schema drift** (catch invalid events early)
- **Enable forward compatibility** (versioned schemas)
- **Support tooling** (auto-completion, type safety)

We need:
- **Runtime validation** (validate at ingestion time)
- **Type safety** (TypeScript types generated from schema)
- **Clear error messages** (help developers fix issues)
- **Schema versioning** (support multiple schema versions)

Alternatives considered:
- No validation (rejected - data quality issues)
- JSON Schema only (rejected - no TypeScript types)
- TypeScript types only (rejected - no runtime validation)
- Runtime type checks (rejected - not expressive enough)

## Decision

Use **Zod for schema validation** with:
- **Schema-first approach**: Zod schema defines structure
- **Type inference**: TypeScript types generated from schema
- **Runtime validation**: Validate at ingestion time
- **Schema versioning**: `schema: 'kb.v1'` field
- **Strict validation**: Reject invalid events with detailed errors

### Schema Structure

```typescript
const AnalyticsEventV1Schema = z.object({
  // Required fields
  id: z.string().uuid(),              // UUID v7
  schema: z.literal('kb.v1'),         // Schema version
  type: z.string().min(1),            // Event type
  ts: z.string().datetime(),           // ISO 8601 timestamp
  ingestTs: z.string().datetime(),     // ISO 8601 timestamp
  source: z.object({
    product: z.string().min(1),
    version: z.string().min(1),
  }),
  runId: z.string().min(1),           // Correlation ID
  ctx: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  
  // Optional fields
  actor: z.object({
    type: z.enum(['user', 'agent', 'ci']),
    id: z.string().optional(),
  }).optional(),
  payload: z.unknown().optional(),
  hashMeta: z.object({
    algo: z.literal('hmac-sha256'),
    saltId: z.string().min(1),
  }).optional(),
});

export type AnalyticsEventV1 = z.infer<typeof AnalyticsEventV1Schema>;
```

### Validation Functions

1. **`validateEvent(data)`**: Throws `ZodError` on invalid
2. **`safeValidateEvent(data)`**: Returns `{success, data?, error?}`

### UUID v7 Decision

Events use **UUID v7** (not v4) for:
- **Time-based sorting**: UUID v7 includes timestamp
- **Efficient partitioning**: Can partition by time
- **Collision resistance**: Better than sequential IDs
- **Standard format**: Compatible with existing UUID tooling

## Consequences

### Positive

- **Type safety**: TypeScript types from schema
- **Data quality**: Invalid events rejected early
- **Developer experience**: Clear error messages
- **Forward compatibility**: Schema versioning enables migration
- **Tooling**: Auto-completion and validation in IDEs

### Negative

- **Performance**: Validation adds overhead (acceptable)
- **Schema maintenance**: Schema changes require updates
- **Version migration**: Need migration path for schema changes

### Alternatives Considered

- **JSON Schema**: Rejected - no TypeScript types
- **TypeScript types only**: Rejected - no runtime validation
- **Manual validation**: Rejected - error-prone
- **Joi/Yup**: Rejected - Zod has better TypeScript integration

## Implementation

Located in `@kb-labs/analytics-core/src/schema/`:

- `event-v1.ts` - Zod schema definition
- `validator.ts` - Validation utilities

### Usage

```typescript
import { validateEvent, safeValidateEvent } from '@kb-labs/analytics-core';

// Throws on invalid
const event = validateEvent(data);

// Returns result
const result = safeValidateEvent(data);
if (!result.success) {
  console.error('Validation errors:', result.error.errors);
}
```

### Schema Versioning

Future schema versions can coexist:

```typescript
const AnalyticsEventV2Schema = z.object({
  schema: z.literal('kb.v2'),
  // ... new fields
});
```

## References

- [Zod Documentation](https://zod.dev/)
- [UUID v7 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-uuidrev-rfc4122bis)
- Related: ADR-0009 (WAL Buffer Architecture)

