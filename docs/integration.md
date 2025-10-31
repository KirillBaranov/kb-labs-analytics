# Integration Guide

## Overview

This guide covers integrating KB Labs Analytics into your product using the Node.js SDK.

## Installation

```bash
pnpm add @kb-labs/analytics-sdk-node
```

## Basic Integration

### Import SDK

```typescript
import { emit, runScope, task } from '@kb-labs/analytics-sdk-node';
```

### Emit Simple Events

```typescript
await emit({
  type: 'product.action',
  payload: { action: 'click', target: 'button' },
});
```

### Emit Events with Context

```typescript
await emit({
  type: 'file.processed',
  ctx: { workspace: 'my-workspace', repo: 'my-repo' },
  payload: { file: 'src/index.ts', lines: 150 },
});
```

## Scoped Events (runScope)

Use `runScope()` to automatically group related events with a shared `runId`:

```typescript
await runScope(
  {
    actor: { type: 'user', id: 'user-123' },
    ctx: { workspace: 'my-workspace' },
  },
  async (emit) => {
    await emit({ type: 'task.started', payload: { task: 'build' } });
    await emit({ type: 'task.step', payload: { step: 'compile' } });
    await emit({ type: 'task.completed', payload: { task: 'build', duration: 1000 } });
  }
);
```

## Task Helper

Use `task()` for common task lifecycle events:

```typescript
await task('audit.run', {
  pkg: '@kb-labs/audit',
  durationMs: 1250,
  result: 'passed',
  checks: 10,
  errors: 0,
});
```

This emits:
- `audit.run.started` (when task starts)
- `audit.run.finished` (when task completes)

## Error Handling

The SDK never throws. Always check the return value:

```typescript
const result = await emit({ type: 'test.event' });
if (!result.queued) {
  console.warn('Event not queued:', result.reason);
}
```

Common reasons:
- `'Analytics disabled'` - Analytics is disabled in config
- `'Validation failed'` - Event schema validation failed
- `'Backpressure high'` - Queue is too full (event dropped/sampled)
- `'Duplicate event'` - Event ID already exists (deduplication)

## Best Practices

### 1. Use Descriptive Event Types

```typescript
// Good
await emit({ type: 'user.login.success' });
await emit({ type: 'build.package.failed' });

// Bad
await emit({ type: 'event' });
await emit({ type: 'error' });
```

### 2. Use runScope for Related Events

```typescript
// Good - all events share runId
await runScope({}, async (emit) => {
  await emit({ type: 'task.started' });
  await emit({ type: 'task.completed' });
});

// Bad - events not correlated
await emit({ type: 'task.started' });
await emit({ type: 'task.completed' });
```

### 3. Avoid PII in Payloads

```typescript
// Bad - PII in payload
await emit({
  type: 'user.login',
  payload: { userId: 'user-123', email: 'user@example.com' },
});

// Good - PII hashed automatically via config
await emit({
  type: 'user.login',
  actor: { type: 'user', id: 'user-123' }, // PII in actor field (hashed)
  payload: { method: 'oauth', provider: 'github' }, // No PII
});
```

### 4. Use Context for Environment Info

```typescript
await emit({
  type: 'deployment.started',
  ctx: {
    workspace: 'prod',
    environment: 'production',
    region: 'us-east-1',
  },
});
```

### 5. Handle Backpressure Gracefully

```typescript
const result = await emit({ type: 'important.event' });
if (!result.queued && result.reason?.includes('Backpressure')) {
  // Log warning, but don't fail the operation
  console.warn('Event dropped due to backpressure');
}
```

## Advanced Usage

### Custom Analytics Instance

For advanced use cases, use the core Analytics class directly:

```typescript
import { Analytics } from '@kb-labs/analytics-core';

const analytics = new Analytics({
  cwd: process.cwd(),
  config: { enabled: true },
});

await analytics.init();
await analytics.emit({ type: 'custom.event' });
await analytics.dispose();
```

### Flush Events

Force flush buffered events to sinks:

```typescript
import { flush } from '@kb-labs/analytics-sdk-node';

await flush(); // Flush all buffered events
```

## Configuration

See [Configuration Documentation](config.md) for detailed configuration options.

## Examples

### Audit Product Integration

```typescript
import { runScope, task } from '@kb-labs/analytics-sdk-node';

export async function runAudit(packages: string[]) {
  return await runScope(
    {
      actor: { type: 'system', id: 'audit-cli' },
      ctx: { workspace: process.cwd() },
    },
    async (emit) => {
      await emit({ type: 'audit.run.started', payload: { packages } });

      for (const pkg of packages) {
        await emit({ type: 'audit.package.started', payload: { pkg } });
        
        const result = await auditPackage(pkg);
        
        await emit({
          type: 'audit.package.completed',
          payload: { pkg, result, durationMs: result.duration },
        });
      }

      await emit({ type: 'audit.run.completed', payload: { packages: packages.length } });
    }
  );
}
```

### CLI Command Integration

```typescript
import { task } from '@kb-labs/analytics-sdk-node';

export async function runCommand(name: string, args: string[]) {
  return await task(name, {
    command: name,
    args,
    durationMs: Date.now() - startTime,
    result: 'success',
  });
}
```

