# @kb-labs/analytics-core

Core pipeline, buffer, batching, retries, schema validation, enrichment middleware, PII hashing, and DLQ for KB Labs Analytics.

## Vision & Purpose

**@kb-labs/analytics-core** provides the core analytics pipeline for KB Labs Analytics. It includes event validation, WAL buffer, middleware pipeline, dead-letter queue, backpressure control, and built-in metrics.

### Core Goals

- **Event Validation**: Strict Zod-based validation for AnalyticsEventV1
- **WAL Buffer**: Append-only segments with deduplication
- **Middleware Pipeline**: Redact → HashPII → Sample → Enrich
- **Dead-Letter Queue**: Failed event storage and replay
- **Backpressure Control**: Staged sampling and drop counters
- **Built-in Metrics**: Event rate, batch sizes, latencies, error rates

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Analytics Core
    │
    ├──► Event Validation
    ├──► WAL Buffer
    ├──► Middleware Pipeline
    ├──► Dead-Letter Queue
    ├──► Backpressure Control
    ├──► Batching
    ├──► Sink Router
    └──► Metrics Collection
```

### Key Components

1. **Schema** (`schema/`): Event validation schemas
2. **Buffer** (`buffer.ts`): WAL buffer implementation
3. **Middleware** (`middleware/`): Middleware pipeline (redact, hash-pii, sample, enrich)
4. **DLQ** (`dlq.ts`): Dead-letter queue
5. **Backpressure** (`backpressure.ts`): Backpressure controller
6. **Batcher** (`batcher.ts`): Event batcher
7. **Router** (`router.ts`): Sink router
8. **Metrics** (`metrics.ts`): Metrics collector
9. **Analytics** (`analytics.ts`): Main orchestrator class

## ✨ Features

- **Strict Event Schema Validation**: Zod-based validation for AnalyticsEventV1
- **WAL Buffer**: Append-only segments with deduplication
- **Middleware Pipeline**: Redact → HashPII → Sample → Enrich
- **Dead-Letter Queue**: Failed event storage and replay
- **Backpressure Control**: Staged sampling and drop counters
- **Built-in Metrics**: Event rate, batch sizes, latencies, error rates
- **Sink Router**: Route events to multiple sinks
- **Event Batching**: Batch events for efficient processing

## 📦 API Reference

### Main Exports

#### Core Class

- `Analytics`: Main analytics orchestrator class

#### Validation Functions

- `validateEvent(event)`: Validate event (throws on error)
- `safeValidateEvent(event)`: Safe validation (returns result)

#### Types

- `AnalyticsEventV1`: Event type
- `EmitResult`: Emit result type
- `RunScope`: Run scope type
- `EventActor`: Event actor type
- `EventContext`: Event context type
- `AnalyticsConfig`: Analytics configuration type
- `SinkConfig`: Sink configuration type

## 🔧 Configuration

### Configuration File

Configuration loaded from `kb-labs.config.json`:

```json
{
  "analytics": {
    "enabled": true,
    "buffer": {
      "maxSizeBytes": 10485760,
      "segmentSizeBytes": 1048576
    },
    "sinks": [
      {
        "type": "fs",
        "path": ".kb/analytics/events.jsonl"
      }
    ],
    "middleware": {
      "redact": {
        "keys": ["password", "token"]
      },
      "hashPII": {
        "keys": ["email", "userId"]
      },
      "sample": {
        "rate": 0.1
      }
    }
  }
}
```

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/core` (`link:../../../kb-labs-core`): Core package
- `@kb-labs/core-bundle` (`link:../../../kb-labs-core/packages/bundle`): Bundle package
- `@kb-labs/analytics-adapters` (`link:../analytics-adapters`): Analytics adapters
- `zod` (`^3.23.8`): Schema validation
- `uuidv7` (`^0.4.1`): UUID v7 generation

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/node` (`^24.7.0`): Node.js types
- `tsup` (`^8`): TypeScript bundler
- `typescript` (`^5`): TypeScript compiler
- `vitest` (`^3`): Test runner

## 🧪 Testing

### Test Structure

```
src/__tests__/
├── analytics.spec.ts
├── buffer.spec.ts
├── config.spec.ts
├── dlq.spec.ts
├── event-v1.spec.ts
└── hash-pii.spec.ts
```

### Test Coverage

- **Current Coverage**: ~75%
- **Target Coverage**: 90%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(1) for emit, O(n) for batch processing
- **Space Complexity**: O(n) where n = buffer size
- **Bottlenecks**: Sink write operations

## 🔒 Security

### Security Considerations

- **PII Hashing**: Hash PII fields in middleware
- **Redaction**: Redact sensitive keys
- **Schema Validation**: Validate all events

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Buffer Size**: Fixed buffer size limits
- **Sink Types**: Fixed sink types

### Future Improvements

- **Dynamic Buffer Size**: Adjustable buffer size
- **More Sink Types**: Additional sink types

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: Initialize Analytics

```typescript
import { Analytics } from '@kb-labs/analytics-core';

const analytics = new Analytics({
  cwd: process.cwd(),
  config: {
    enabled: true,
    buffer: { maxSizeBytes: 10 * 1024 * 1024 },
  },
});

await analytics.init();
```

### Example 2: Emit Event

```typescript
await analytics.emit({
  type: 'audit.run.finished',
  source: { product: '@kb-labs/audit', version: '0.1.0' },
  payload: { checks: 6, ok: true },
});
```

### Example 3: Create Run Scope

```typescript
const scope = analytics.createRunScope('run_123', {
  type: 'user',
  id: 'u_123',
}, {
  repo: 'kb-labs/umbrella',
});

await scope.emit({ type: 'audit.run.started', payload: {} });
await scope.finish();
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs
