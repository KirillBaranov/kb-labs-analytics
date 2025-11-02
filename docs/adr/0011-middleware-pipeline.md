# ADR-0011: Middleware Pipeline

**Date:** 2025-10-31
**Status:** Accepted
**Deciders:** KB Labs Team
**Last Reviewed:** 2025-11-03
**Tags:** [architecture, data, security]

## Context

KB Labs Analytics needs to process events before storage:
- **Redact sensitive data** (passwords, tokens)
- **Hash PII** (personally identifiable information)
- **Sample events** (reduce volume for high-frequency events)
- **Enrich with context** (git info, hostname, workspace)

We need:
- **Strict ordering** (e.g., hash PII before enriching)
- **Composability** (middleware can be combined)
- **Performance** (minimal overhead)
- **Configurability** (enable/disable per middleware)

Alternatives considered:
- Single monolithic processor (rejected - not composable)
- Plugin system (rejected - overkill for MVP)
- Decorator pattern (rejected - too complex)

## Decision

Use a **sequential middleware pipeline** with:
- **Fixed order**: redact → hashPII → sample → enrich
- **Middleware interface**: `process(event): event | null`
- **Early termination**: Sample middleware can drop events (returns `null`)
- **Synchronous + async support**: Enrichment may be async (git, filesystem)

### Pipeline Order

```
Event Input
    │
    ▼
┌──────────┐
│ Redact  │ Remove sensitive keys (password, token)
└────┬────┘
     │
     ▼
┌──────────┐
│ Hash PII │ Hash PII fields (actor.id, ctx.user)
└────┬────┘
     │
     ▼
┌──────────┐
│ Sample  │ Drop events based on rate (may return null)
└────┬────┘
     │
     ▼
┌──────────┐
│ Enrich  │ Add context (git, host, workspace)
└────┬────┘
     │
     ▼
Event Output (or null if dropped)
```

### Middleware Components

1. **RedactMiddleware**
   - Removes sensitive keys from payload
   - Configurable key list (`redact.keys`)
   - Synchronous operation

2. **PIIHashMiddleware**
   - Hashes PII fields using HMAC-SHA256
   - Configurable fields via JSON paths (`pii.fields`)
   - Adds `hashMeta` to event
   - Synchronous operation

3. **SampleMiddleware**
   - Drops events based on sampling rate
   - Default rate + per-event-type rates
   - Returns `null` for dropped events
   - Synchronous operation

4. **EnrichMiddleware**
   - Adds git information (repo, branch, commit)
   - Adds host information (hostname, platform)
   - Adds workspace information (root, cwd)
   - Async operation (filesystem, git commands)

## Consequences

### Positive

- **Composability**: Middleware can be combined flexibly
- **Performance**: Sequential processing is fast
- **Testability**: Each middleware can be tested independently
- **Configurability**: Enable/disable per middleware
- **Ordering guarantee**: Fixed order prevents race conditions

### Negative

- **Order rigidity**: Order must be carefully chosen
- **Async complexity**: Enrichment is async, adds complexity
- **Performance**: Sequential processing adds latency

### Alternatives Considered

- **Parallel processing**: Rejected - ordering matters (hash before enrich)
- **Plugin system**: Rejected - overkill for fixed set of middleware
- **Decorator pattern**: Rejected - too complex for MVP

## Implementation

Located in `@kb-labs/analytics-core/src/middleware/`:

- `index.ts` - MiddlewarePipeline orchestrator
- `redact.ts` - RedactMiddleware
- `hash-pii.ts` - PIIHashMiddleware
- `sample.ts` - SampleMiddleware
- `enrich.ts` - EnrichMiddleware

### Configuration

```json
{
  "middleware": {
    "redact": {
      "keys": ["password", "token", "secret"]
    },
    "pii": {
      "hash": { "enabled": true },
      "fields": ["actor.id", "ctx.user"]
    },
    "sampling": {
      "default": 1.0,
      "byEvent": {
        "debug.event": 0.1
      }
    },
    "enrich": {
      "git": true,
      "host": true,
      "workspace": true
    }
  }
}
```

### Usage

```typescript
const pipeline = new MiddlewarePipeline(config);
const processed = await pipeline.process(event);
if (processed === null) {
  // Event dropped by sampling
}
```

## References

- [Middleware Pattern](https://en.wikipedia.org/wiki/Middleware)
- [Chain of Responsibility](https://en.wikipedia.org/wiki/Chain-of-responsibility_pattern)
- Related: ADR-0013 (PII Hashing Strategy)

