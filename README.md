# KB Labs Analytics (@kb-labs/analytics)

> **Unified event analytics pipeline for the KB Labs ecosystem.** Low-overhead, extensible event pipeline for collecting, processing, and shipping structured events.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.18.0+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0.0+-orange.svg)](https://pnpm.io/)

## 🎯 Vision

KB Labs Analytics provides a low-overhead, extensible event pipeline for the KB Labs ecosystem. It enables collecting, processing, and shipping structured events from all KB Labs products with reliable ingestion, pluggable sinks, and zero coupling to products. This project is part of the **@kb-labs** ecosystem.

The project solves the problem of inconsistent event tracking and analytics across KB Labs products by providing a unified, reliable, and scalable analytics pipeline. Instead of each product implementing its own tracking solution, all products can emit events through the Analytics SDK, which handles buffering, deduplication, retries, and routing to multiple sinks.

This project integrates seamlessly with all KB Labs products and provides zero-coupling architecture - products don't need to know about analytics implementation details, and analytics doesn't contain business logic.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Install SDK in your product
pnpm add @kb-labs/analytics-sdk-node
```

### Development

```bash
# Start development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
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

## ✨ Features

- **Unified Event API**: Stable schemas with correlation support via `runId`
- **Reliable Ingestion**: Disk-backed WAL buffer with segment rotation and fsync
- **Pluggable Sinks**: Multiple sink adapters (FS, HTTP, S3, SQLite) - use multiple at once
- **Zero Coupling**: No business logic inside analytics, products remain independent
- **Deduplication**: In-memory Bloom filter/LFU cache for event deduplication
- **Retry Logic**: Per-sink retry with exponential backoff and circuit breakers
- **Dead-Letter Queue**: Failed events stored for later replay
- **PII Hashing**: HMAC-SHA256 hashing for sensitive fields with salt rotation
- **Backpressure Control**: Staged sampling when buffer exceeds thresholds
- **Observability**: Built-in metrics (ev/s, batch size, send latency, error rate)

## 📁 Repository Structure

```
kb-labs-analytics/
├── apps/                    # Example applications
│   └── demo/                # Demo application
├── packages/                # Core packages
│   ├── analytics-core/       # Core pipeline, buffer, batching, middleware
│   ├── analytics-sdk-node/  # Node.js SDK for products
│   ├── analytics-adapters/  # Sink adapters (FS, HTTP, S3, SQLite)
│   └── analytics-cli/        # CLI commands for management
├── docs/                    # Documentation
│   ├── adr/                  # Architecture Decision Records
│   ├── events.md             # Event structure and validation
│   ├── config.md             # Configuration options
│   ├── sinks.md              # Sink adapters documentation
│   ├── integration.md        # SDK usage and best practices
│   └── pii.md                # PII hashing and privacy
└── scripts/                 # Utility scripts
```

### Directory Descriptions

- **`apps/`** - Example applications demonstrating analytics integration
- **`packages/analytics-core/`** - Core pipeline with buffer, middleware, and routing
- **`packages/analytics-sdk-node/`** - Node.js SDK that products use to emit events
- **`packages/analytics-adapters/`** - Sink adapters for different storage backends
- **`packages/analytics-cli/`** - CLI commands for managing and monitoring analytics
- **`docs/`** - Comprehensive documentation including ADRs and guides

## 📦 Packages

| Package | Description |
|---------|-------------|
| [@kb-labs/analytics-core](./packages/analytics-core/) | Core pipeline, buffer, batching, middleware, and routing |
| [@kb-labs/analytics-sdk-node](./packages/analytics-sdk-node/) | Node.js SDK for products to emit events |
| [@kb-labs/analytics-adapters](./packages/analytics-adapters/) | Sink adapters (FS, HTTP, S3, SQLite) |
| [@kb-labs/analytics-cli](./packages/analytics-cli/) | CLI commands for management and monitoring |

### Package Details

**@kb-labs/analytics-core** provides the core analytics engine:
- WAL buffer with segment rotation and fsync
- Deduplication via in-memory Bloom filter/LFU cache
- Middleware pipeline (enrich, hash-pii, redact, sample)
- Event router that distributes to multiple sinks
- Retry logic with exponential backoff
- Circuit breakers to prevent cascade failures
- Dead-Letter Queue for failed events
- Metrics collection (ev/s, batch size, latency, error rate)

**@kb-labs/analytics-sdk-node** provides the SDK for products:
- Singleton pattern for efficient resource usage
- `emit()` function for emitting events
- `runScope()` function for scoped event emission with automatic `runId`
- Automatic correlation via `runId`
- Event validation via Zod schemas

**@kb-labs/analytics-adapters** provides sink implementations:
- **FS Sink**: File system storage with JSONL format
- **HTTP Sink**: HTTP endpoint with authentication
- **S3 Sink**: AWS S3 storage
- **SQLite Sink**: SQLite database storage

**@kb-labs/analytics-cli** provides management commands:
- Event emission for testing
- Buffer tailing and monitoring
- Buffer flushing
- Status and metrics viewing
- Dead-Letter Queue management
- Buffer compaction

## 🏗️ Architecture

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

### Key Components

- **SDK**: Products use the SDK to emit events
- **Middleware Pipeline**: Enriches, hashes PII, redacts, and samples events
- **WAL Buffer**: Write-Ahead Log buffer with segment rotation for reliability
- **Event Router**: Routes events to multiple sinks in parallel
- **Sinks**: Pluggable adapters for different storage backends

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development mode for all packages |
| `pnpm build` | Build all packages |
| `pnpm build:clean` | Clean and build all packages |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run tests with coverage reporting |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint all code |
| `pnpm lint:fix` | Fix linting issues |
| `pnpm format` | Format code with Prettier |
| `pnpm type-check` | TypeScript type checking |
| `pnpm check` | Run lint, type-check, and tests |
| `pnpm ci` | Full CI pipeline (clean, build, check) |
| `pnpm clean` | Clean build artifacts |
| `pnpm clean:all` | Clean all node_modules and build artifacts |

## 📋 Development Policies

- **Code Style**: ESLint + Prettier, TypeScript strict mode
- **Testing**: Vitest with comprehensive test coverage
- **Versioning**: SemVer with automated releases through Changesets
- **Architecture**: Document decisions in ADRs (see `docs/adr/`)
- **API Stability**: SDK maintains backward compatibility
- **Performance**: Low-overhead design with efficient buffering

## 🔧 Requirements

- **Node.js**: >= 18.18.0
- **pnpm**: >= 9.0.0

## ⚙️ Configuration

### Event Schema

- **Strict validation** via Zod schemas
- **UUID v7** for unique event identifiers
- **Correlation** via `runId` for grouping events
- **Schema versioning** (`kb.v1`) for forward compatibility

### Reliability Features

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

## 📚 Documentation

- [Documentation Standard](./docs/DOCUMENTATION.md) - Full documentation guidelines
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Architecture Decisions](./docs/adr/) - ADRs for this project

**Guides:**
- [Events Schema](./docs/events.md) - Event structure and validation
- [Configuration](./docs/config.md) - Configuration options and overrides
- [Sinks](./docs/sinks.md) - Sink adapters (FS, HTTP, S3, SQLite)
- [Integration](./docs/integration.md) - SDK usage and best practices
- [PII Handling](./docs/pii.md) - PII hashing and privacy

**Architecture:**
- [ADR-0009: WAL Buffer Architecture](./docs/adr/0009-wal-buffer-architecture.md) - Write-Ahead Log design
- [ADR-0010: Pluggable Sink Adapters](./docs/adr/0010-pluggable-sink-adapters.md) - Sink adapter architecture
- [ADR-0011: Middleware Pipeline](./docs/adr/0011-middleware-pipeline.md) - Middleware system design
- [ADR-0012: Event Schema Validation](./docs/adr/0012-event-schema-validation.md) - Schema validation approach
- [ADR-0013: PII Hashing Strategy](./docs/adr/0013-pii-hashing-strategy.md) - PII protection strategy
- [ADR-0014: Backpressure Control Strategy](./docs/adr/0014-backpressure-control-strategy.md) - Backpressure handling
- [ADR-0015: Singleton SDK Pattern](./docs/adr/0015-singleton-sdk-pattern.md) - SDK design pattern

## 🔗 Related Packages

### Dependencies

- [@kb-labs/core](https://github.com/KirillBaranov/kb-labs-core) - Core utilities and infrastructure abstractions

### Used By

- All KB Labs products for analytics event tracking

### Ecosystem

- [KB Labs](https://github.com/KirillBaranov/kb-labs) - Main ecosystem repository

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and contribution process.

## 📄 License

MIT © KB Labs

---

**See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and contribution process.**


## License

KB Public License v1.1 - see [LICENSE](LICENSE) for details.

This is open source software with some restrictions on:
- Offering as a hosted service (SaaS/PaaS)
- Creating competing platform products

For commercial licensing inquiries: contact@kblabs.dev

**User Guides:**
- [English Guide](../LICENSE-GUIDE.en.md)
- [Русское руководство](../LICENSE-GUIDE.ru.md)
