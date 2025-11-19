# @kb-labs/analytics-sdk-node

Node.js SDK for KB Labs Analytics with ergonomic helpers.

## Vision & Purpose

**@kb-labs/analytics-sdk-node** provides an ergonomic Node.js SDK for KB Labs Analytics. It offers a simple, fire-and-forget API for emitting analytics events with automatic initialization, run scopes, and task helpers.

### Core Goals

- **Ergonomic API**: Simple, intuitive API for emitting events
- **Automatic Initialization**: Lazy initialization with singleton pattern
- **Run Scopes**: Group events by run/actor/context
- **Task Helpers**: Lightweight helpers for common patterns

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Analytics SDK Node
    │
    ├──► Singleton Instance
    ├──► Ergonomic Helpers
    └──► Run Scopes
```

### Key Components

1. **Singleton Instance**: Lazy-initialized analytics instance
2. **Ergonomic Helpers**: `emit`, `task`, `runScope` functions
3. **Run Scopes**: Group events by run/actor/context

## ✨ Features

- **Fire-and-forget emit**: Never throws, always succeeds
- **Run scopes**: Group events by run/actor/context
- **Task helpers**: Lightweight helpers for common patterns
- **Automatic initialization**: Lazy initialization with singleton
- **Metrics access**: Get current metrics and backpressure state
- **Flush support**: Force flush buffer to sinks

## 📦 API Reference

### Main Exports

#### Core Functions

- `init(options?)`: Initialize analytics (optional - auto-initialized)
- `emit(event)`: Emit an event (fire-and-forget, never throws)
- `runScope(options, fn)`: Create a run scope for grouping events
- `task(eventType, payload)`: Lightweight task helper
- `getMetrics()`: Get current metrics
- `getBackpressureState()`: Get backpressure state
- `flush()`: Force flush buffer to sinks
- `dispose()`: Dispose analytics instance

#### Types

- `Analytics`: Analytics class (for advanced usage)
- `AnalyticsOptions`: Analytics initialization options
- `AnalyticsEventV1`: Event type
- `EmitResult`: Emit result type
- `RunScope`: Run scope type
- `EventActor`: Event actor type
- `EventContext`: Event context type

## 🔧 Configuration

### Configuration Options

Configuration loaded from `kb-labs.config.json` or passed via `init()`:

```typescript
await init({
  cwd: process.cwd(),
  config: {
    enabled: true,
    buffer: { maxSizeBytes: 10 * 1024 * 1024 },
    sinks: [{ type: 'fs', path: '.kb/analytics/events.jsonl' }],
  },
});
```

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/analytics-core` (`link:../analytics-core`): Analytics core

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/node` (`^24.7.0`): Node.js types
- `tsup` (`^8`): TypeScript bundler
- `typescript` (`^5`): TypeScript compiler
- `vitest` (`^3`): Test runner

## 🧪 Testing

### Test Structure

No tests currently (thin wrapper over analytics-core).

### Test Coverage

- **Current Coverage**: N/A
- **Target Coverage**: 80%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(1) for emit, O(1) for runScope
- **Space Complexity**: O(1)
- **Bottlenecks**: Underlying analytics-core performance

## 🔒 Security

### Security Considerations

- **Fire-and-forget**: Never throws, always succeeds
- **PII Handling**: Handled by analytics-core middleware

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Singleton Pattern**: Single instance per process
- **No Customization**: Limited customization options

### Future Improvements

- **Multiple Instances**: Support for multiple instances
- **More Helpers**: Additional helper functions

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: Basic Emit

```typescript
import { emit } from '@kb-labs/analytics-sdk-node';

await emit({
  type: 'audit.run.finished',
  source: { product: '@kb-labs/audit', version: '0.1.0' },
  payload: { checks: 6, ok: true, durationMs: 10321 },
});
```

### Example 2: Run Scope

```typescript
import { runScope } from '@kb-labs/analytics-sdk-node';

const result = await runScope(
  {
    runId: 'run_123',
    actor: { type: 'user', id: 'u_123' },
    ctx: { repo: 'kb-labs/umbrella', branch: 'main' },
  },
  async (emit) => {
    await emit({ type: 'audit.run.started', payload: {} });
    // ... do work ...
    await emit({ type: 'audit.run.finished', payload: { ok: true } });
    return 'result';
  }
);
```

### Example 3: Task Helper

```typescript
import { task } from '@kb-labs/analytics-sdk-node';

await task('release.plan.created', {
  packages: 12,
  durationMs: 842,
});
```

### Example 4: Get Metrics

```typescript
import { getMetrics } from '@kb-labs/analytics-sdk-node';

const metrics = getMetrics();
console.log('Events emitted:', metrics.eventsEmitted);
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs
