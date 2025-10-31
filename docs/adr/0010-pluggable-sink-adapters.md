# ADR-0010: Pluggable Sink Adapters

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** KB Labs Team

## Context

KB Labs Analytics must support multiple event destinations:
- Local file system (for development/debugging)
- HTTP endpoints (for remote ingestion)
- S3 buckets (for cloud storage)
- SQLite databases (for local analytics)

We need:
- **Zero coupling** between core and sinks
- **Multiple sinks simultaneously** (fan-out)
- **Independent failure modes** (one sink failure doesn't affect others)
- **Pluggable architecture** (easy to add new sinks)

Alternatives considered:
- Hard-coded sinks in core (rejected - tight coupling)
- Single sink only (rejected - too limiting)
- Event bus/pub-sub (rejected - overkill for MVP)

## Decision

Use **pluggable sink adapters** with:
- **Adapter interface** (`SinkAdapter`) for abstraction
- **Dynamic loading** from `@kb-labs/analytics-adapters`
- **Router pattern** for fan-out to multiple sinks
- **Batcher pattern** per sink for efficiency
- **Independent error handling** (sink failures don't cascade)
- **Common features** (retry, circuit breaker, idempotency)

### Architecture

```
┌─────────────┐
│   Analytics │
│     Core    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Sink Router│
└──────┬──────┘
       │
       ├──────────┐
       │          │
   ┌───▼───┐  ┌──▼───┐
   │ Batcher│  │Batcher│
   └───┬───┘  └──┬───┘
       │         │
   ┌───▼───┐  ┌──▼───┐
   │ FS    │  │ HTTP  │
   │ Sink  │  │ Sink  │
   └───────┘  └───────┘
```

### Sink Adapter Interface

```typescript
interface SinkAdapter {
  write(events: AnalyticsEventV1[]): Promise<void>;
  close(): Promise<void>;
  getIdempotencyKey?(event: AnalyticsEventV1): string;
}
```

### Built-in Sinks

1. **FS Sink** (`@kb-labs/analytics-adapters/src/sinks/fs.ts`)
   - Writes to local JSONL files
   - Rotation and retention policies
   - Idempotency via file-based deduplication

2. **HTTP Sink** (`@kb-labs/analytics-adapters/src/sinks/http.ts`)
   - POST to HTTP endpoints
   - Authentication (bearer token, API key)
   - Retry with exponential backoff
   - Circuit breaker for fault tolerance

3. **S3 Sink** (`@kb-labs/analytics-adapters/src/sinks/s3.ts`)
   - Multipart uploads to S3 buckets
   - Key prefixing for organization
   - Custom endpoints (S3-compatible)
   - IAM credentials support

4. **SQLite Sink** (`@kb-labs/analytics-adapters/src/sinks/sqlite.ts`)
   - Table partitioning by day
   - Indices on `type`, `ts`, `runId`
   - Retention policy enforcement
   - WAL mode for performance

## Consequences

### Positive

- **Flexibility**: Easy to add new sinks without core changes
- **Reliability**: Sink failures are isolated
- **Performance**: Batching per sink reduces overhead
- **Scalability**: Multiple sinks handle different use cases
- **Testability**: Sinks can be tested independently

### Negative

- **Complexity**: Dynamic loading and routing logic
- **Package split**: Adapters in separate package (`@kb-labs/analytics-adapters`)
- **Configuration**: Each sink has its own config schema

### Alternatives Considered

- **Hard-coded sinks**: Rejected - tight coupling
- **Single sink**: Rejected - too limiting
- **Event bus**: Rejected - overkill for MVP

## Implementation

Located in:
- `@kb-labs/analytics-core/src/router.ts` - SinkRouter class
- `@kb-labs/analytics-core/src/batcher.ts` - EventBatcher class
- `@kb-labs/analytics-adapters/src/sinks/` - Sink implementations

### Configuration

```json
{
  "sinks": [
    {
      "type": "fs",
      "path": ".kb/analytics/events"
    },
    {
      "type": "http",
      "url": "https://api.example.com/events",
      "auth": { "type": "bearer", "token": "${TOKEN}" }
    }
  ]
}
```

### Dynamic Loading

Sinks are loaded dynamically at runtime based on config:

```typescript
const adapters = await import('@kb-labs/analytics-adapters');
const sink = new adapters.FSSink(sinkConfig);
```

## References

- [Adapter Pattern](https://en.wikipedia.org/wiki/Adapter_pattern)
- [Router Pattern](https://en.wikipedia.org/wiki/Message_router)
- Related: ADR-0009 (WAL Buffer Architecture)

