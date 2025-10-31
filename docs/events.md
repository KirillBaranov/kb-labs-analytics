# Event Schema

## Overview

KB Labs Analytics uses a **strict event schema** (`kb.v1`) for all events. All events are validated against this schema before ingestion.

## Event Structure

```typescript
interface AnalyticsEventV1 {
  // Required fields
  id: string;                    // UUID v7 event identifier
  schema: 'kb.v1';               // Schema version
  type: string;                   // Event type (e.g. "product.action")
  ts: string;                     // ISO 8601 UTC timestamp when event occurred
  ingestTs: string;               // ISO 8601 UTC timestamp when ingested by SDK
  source: {
    product: string;               // Product name (e.g. "@kb-labs/audit")
    version: string;               // Product version (e.g. "1.0.0")
  };
  runId: string;                  // Correlation ID for grouping events
  ctx: {
    workspace?: string;           // Workspace identifier
    repo?: string;                // Repository identifier
    [key: string]: unknown;       // Additional context
  };

  // Optional fields
  actor?: {
    type: 'user' | 'system' | 'bot';
    id?: string;
    [key: string]: unknown;
  };
  payload?: unknown;              // Event-specific payload
  hashMeta?: {                    // PII hashing metadata
    algo: 'hmac-sha256';
    saltId: string;
  };
}
```

## Event Types

Event types follow a hierarchical naming convention:

```
<product>.<category>.<action>
```

Examples:
- `audit.run.started`
- `audit.run.finished`
- `review.file.scanned`
- `build.package.succeeded`

## UUID v7

Events use **UUID v7** for unique identifiers. UUID v7 includes a timestamp component, enabling efficient time-based sorting and partitioning.

```typescript
import { uuidv7 } from 'uuidv7';

const eventId = uuidv7(); // e.g. "01234567-89ab-cdef-0123-456789abcdef"
```

## Correlation (runId)

The `runId` field allows grouping related events:

```typescript
const runId = `run-${Date.now()}`;

await emit({ type: 'task.started', runId, ... });
await emit({ type: 'task.step', runId, ... });
await emit({ type: 'task.completed', runId, ... });
```

The SDK provides `runScope()` for automatic `runId` management:

```typescript
await runScope({}, async (emit) => {
  // All events within this scope share the same runId
  await emit({ type: 'task.started' });
  await emit({ type: 'task.completed' });
});
```

## Validation

Events are validated using Zod schemas. Invalid events are rejected with detailed error messages.

```typescript
import { safeValidateEvent } from '@kb-labs/analytics-core';

const result = safeValidateEvent(eventData);
if (!result.success) {
  console.error('Validation errors:', result.error.errors);
}
```

## Examples

### Simple Event

```typescript
await emit({
  type: 'button.click',
  payload: { buttonId: 'submit', page: '/checkout' },
});
```

### Event with Actor

```typescript
await emit({
  type: 'user.login',
  actor: { type: 'user', id: 'user-123' },
  payload: { method: 'oauth', provider: 'github' },
});
```

### Event with Context

```typescript
await emit({
  type: 'file.processed',
  ctx: { workspace: 'my-workspace', repo: 'my-repo' },
  payload: { file: 'src/index.ts', lines: 150 },
});
```

### Task Event (using helper)

```typescript
await task('audit.run', {
  pkg: '@kb-labs/audit',
  durationMs: 1250,
  result: 'passed',
});
```

