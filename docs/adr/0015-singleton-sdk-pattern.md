# ADR-0015: Singleton SDK Pattern

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** KB Labs Team

## Context

KB Labs Analytics SDK must be easy to use from products:
- **Simple API**: No need to instantiate Analytics class
- **Auto-initialization**: Works out of the box
- **Global state**: Shared instance across product code
- **Zero configuration**: Use default config if none provided

We need:
- **Ergonomic API**: `import { emit } from '@kb-labs/analytics-sdk-node'`
- **Lazy initialization**: Initialize on first use
- **Configuration**: Use `kb-labs.config.json` automatically
- **Disposal**: Optional cleanup for tests

Alternatives considered:
- Export Analytics class only (rejected - too verbose)
- Factory function (rejected - still requires instantiation)
- Multiple instances (rejected - unnecessary complexity)

## Decision

Use **singleton pattern** with:
- **Lazy initialization**: Create instance on first `emit()` call
- **Helper functions**: Export `emit()`, `runScope()`, `task()`, `flush()`
- **Auto-config**: Load config from `kb-labs.config.json` automatically
- **Optional init**: `init()` function for explicit initialization
- **Disposal**: `dispose()` function for cleanup

### SDK API

```typescript
// Simple usage (no initialization needed)
import { emit, runScope, task } from '@kb-labs/analytics-sdk-node';

await emit({ type: 'product.action' });
await runScope({}, async (emit) => { ... });
await task('audit.run', { durationMs: 1000 });

// Advanced usage (explicit initialization)
import { Analytics } from '@kb-labs/analytics-sdk-node';

const analytics = new Analytics({ config: { ... } });
await analytics.init();
```

### Implementation

```typescript
// Singleton instance (lazy-initialized)
let analyticsInstance: Analytics | null = null;

function getAnalytics(): Analytics {
  if (!analyticsInstance) {
    analyticsInstance = new Analytics({
      cwd: process.cwd(),
    });
  }
  return analyticsInstance;
}

export async function emit(event: Partial<AnalyticsEventV1>): Promise<EmitResult> {
  const analytics = getAnalytics();
  return analytics.emit(event);
}
```

### Auto-Initialization

- **First emit()**: Creates instance and calls `init()`
- **Config loading**: Loads from `kb-labs.config.json` automatically
- **Error handling**: Initialization errors logged but don't throw

## Consequences

### Positive

- **Ergonomics**: Simple API, no boilerplate
- **Auto-config**: Works out of the box
- **Zero coupling**: Products don't need to know about Analytics class
- **Testability**: `dispose()` allows cleanup between tests
- **Flexibility**: Still allows advanced usage via exported class

### Negative

- **Global state**: Shared instance (may cause issues in tests)
- **Hidden initialization**: First call may be slow
- **Configuration**: Less explicit than passing config

### Alternatives Considered

- **Export class only**: Rejected - too verbose for common use
- **Factory function**: Rejected - still requires instantiation
- **Multiple instances**: Rejected - unnecessary complexity

## Implementation

Located in `@kb-labs/analytics-sdk-node/src/index.ts`:

- Singleton instance management
- Helper functions: `emit()`, `runScope()`, `task()`, `flush()`
- Optional `init()` and `dispose()` functions
- Export `Analytics` class for advanced usage

### Usage Patterns

**Simple usage (most common):**
```typescript
import { emit } from '@kb-labs/analytics-sdk-node';
await emit({ type: 'product.action' });
```

**Scoped usage:**
```typescript
import { runScope } from '@kb-labs/analytics-sdk-node';
await runScope({ actor: { type: 'user', id: 'user-123' } }, async (emit) => {
  await emit({ type: 'task.started' });
  await emit({ type: 'task.completed' });
});
```

**Testing (cleanup):**
```typescript
import { dispose } from '@kb-labs/analytics-sdk-node';
afterEach(async () => {
  await dispose();
});
```

## References

- [Singleton Pattern](https://en.wikipedia.org/wiki/Singleton_pattern)
- Related: ADR-0011 (Middleware Pipeline)

