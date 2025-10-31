# KB Labs Analytics

Unified event analytics pipeline for the KB Labs ecosystem.

## Overview

KB Labs Analytics provides a **low-overhead, extensible event pipeline** for collecting, processing, and shipping structured events from KB Labs products. It offers:

- **Unified Event API** with stable schemas and correlation
- **Reliable ingestion** with disk-backed buffer, retries, batching, and circuit breakers
- **Pluggable sinks** via adapters (FS, HTTP, S3, SQLite) - multiple sinks at once
- **Zero coupling** to products (no business logic inside analytics)
- **Human + machine artifacts**: JSONL streams + daily rollups (aggregations)
- **Runtime config** via `kb-labs.config.json` and environment variables

## Architecture

```
┌─────────────┐
│   Product   │───emit()──►┌──────────────┐
│  (SDK Node) │            │   Analytics  │
└─────────────┘            │     Core     │
                            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │                             │
            ┌────────▼─────────┐         ┌────────▼─────────┐
            │  Middleware      │         │   WAL Buffer    │
            │  Pipeline        │         │   (Deduplication)│
            └────────┬─────────┘         └────────┬─────────┘
                    │                             │
            ┌────────▼─────────┐                  │
            │   Event Router  │◄─────────────────┘
            └────────┬─────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    ┌───▼───┐  ┌───▼───┐  ┌───▼───┐
    │  FS   │  │ HTTP  │  │  S3   │
    │ Sink  │  │ Sink  │  │ Sink  │
    └───────┘  └───────┘  └───────┘
```

## Packages

- **`@kb-labs/analytics-core`** - Core pipeline, buffer, batching, middleware
- **`@kb-labs/analytics-sdk-node`** - Node.js SDK for products
- **`@kb-labs/analytics-adapters`** - Sink adapters (FS, HTTP, S3, SQLite)
- **`@kb-labs/analytics-cli`** - CLI commands for management

## Quick Start

### Installation

```bash
pnpm add @kb-labs/analytics-sdk-node
```

### Basic Usage

```typescript
import { emit, runScope } from '@kb-labs/analytics-sdk-node';

// Emit a simple event
await emit({
  type: 'product.action',
  payload: { action: 'click', target: 'button' },
});

// Emit events within a scope (automatic runId)
await runScope({ actor: { type: 'user', id: 'user-123' } }, async (emit) => {
  await emit({ type: 'task.started', payload: { task: 'build' } });
  await emit({ type: 'task.completed', payload: { task: 'build', duration: 1000 } });
});
```

### Configuration

Create or update `kb-labs.config.json`:

```json
{
  "analytics": {
    "enabled": true,
    "buffer": {
      "segmentBytes": 1048576,
      "segmentMaxAgeMs": 60000,
      "fsyncOnRotate": true
    },
    "sinks": [
      {
        "type": "fs",
        "path": ".kb/analytics/events"
      },
      {
        "type": "http",
        "url": "https://api.example.com/events",
        "auth": {
          "type": "bearer",
          "token": "${ANALYTICS_TOKEN}"
        }
      }
    ],
    "pii": {
      "hash": {
        "enabled": true,
        "saltEnv": "KB_ANALYTICS_SALT"
      },
      "fields": ["actor.id", "ctx.user"]
    },
    "backpressure": {
      "high": 20000,
      "critical": 50000,
      "sampling": {
        "high": 0.5,
        "critical": 0.1
      }
    }
  }
}
```

### CLI Commands

```bash
# Emit a test event
kb analytics emit --type test.event

# Tail events from buffer
kb analytics tail --follow

# Flush buffer to sinks
kb analytics flush

# Show analytics status
kb analytics status

# View metrics
kb analytics stats --interval 5s

# Manage Dead-Letter Queue
kb analytics dlq list
kb analytics dlq replay --filter type=error

# Compact old segments
kb analytics compact
```

## Documentation

- [Events Schema](docs/events.md) - Event structure and validation
- [Configuration](docs/config.md) - Configuration options and overrides
- [Sinks](docs/sinks.md) - Sink adapters (FS, HTTP, S3, SQLite)
- [Integration](docs/integration.md) - SDK usage and best practices
- [PII Handling](docs/pii.md) - PII hashing and privacy

## Features

### Event Schema

- **Strict validation** via Zod schemas
- **UUID v7** for unique event identifiers
- **Correlation** via `runId` for grouping events
- **Schema versioning** (`kb.v1`) for forward compatibility

### Reliability

- **WAL buffer** with segment rotation and fsync
- **Deduplication** via in-memory Bloom filter/LFU cache
- **Retry logic** per sink with exponential backoff
- **Circuit breakers** to prevent cascade failures
- **Dead-Letter Queue** for failed events

### Privacy & Security

- **PII hashing** via HMAC-SHA256 with salt rotation
- **Configurable PII fields** with allow/deny lists
- **No PII in logs** policy enforcement

### Observability

- **Built-in metrics**: ev/s, batch size, send latency, error rate
- **Backpressure control** with staged sampling
- **CLI tools** for monitoring (`tail`, `status`, `stats`)

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Type check
pnpm type-check
```

## License

MIT © KB Labs
