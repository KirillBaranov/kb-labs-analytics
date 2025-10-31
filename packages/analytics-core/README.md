# @kb-labs/analytics-core

Core pipeline, buffer, batching, retries, schema validation, enrichment middleware, PII hashing, and DLQ for KB Labs Analytics.

## Features

- **Strict Event Schema Validation** - Zod-based validation for `AnalyticsEventV1`
- **WAL Buffer** - Append-only segments with deduplication
- **Middleware Pipeline** - Redact → HashPII → Sample → Enrich
- **Dead-Letter Queue** - Failed event storage and replay
- **Backpressure Control** - Staged sampling and drop counters
- **Built-in Metrics** - Event rate, batch sizes, latencies, error rates

## Installation

```bash
pnpm add @kb-labs/analytics-core
```

## Usage

```typescript
import { validateEvent, safeValidateEvent } from '@kb-labs/analytics-core';

// Validate event (throws on error)
const event = validateEvent(rawEvent);

// Safe validation (returns result)
const result = safeValidateEvent(rawEvent);
if (result.success) {
  const event = result.data;
} else {
  console.error('Validation errors:', result.error);
}
```

## Event Schema

See `src/schema/event-v1.ts` for the full `AnalyticsEventV1` schema definition.

## License

MIT

