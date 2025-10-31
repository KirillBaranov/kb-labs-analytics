# @kb-labs/analytics-sdk-node

Node.js SDK for KB Labs Analytics with ergonomic helpers.

## Installation

```bash
pnpm add @kb-labs/analytics-sdk-node
```

## Usage

### Basic emit

```typescript
import { emit } from '@kb-labs/analytics-sdk-node';

await emit({
  type: 'audit.run.finished',
  source: { product: '@kb-labs/audit', version: '0.1.0' },
  payload: { checks: 6, ok: true, durationMs: 10321 },
});
```

### Run scope

```typescript
import { runScope } from '@kb-labs/analytics-sdk-node';

const run = runScope({
  runId: 'run_123',
  actor: { type: 'user', id: 'u_123' },
  ctx: { repo: 'kb-labs/umbrella', branch: 'main' },
});

await run.emit({ type: 'audit.run.started', payload: {} });
// ... do work ...
await run.emit({ type: 'audit.run.finished', payload: { ok: true } });
await run.finish();
```

### Task helper

```typescript
import { task } from '@kb-labs/analytics-sdk-node';

await task('release.plan.created', {
  packages: 12,
  durationMs: 842,
});
```

## License

MIT

