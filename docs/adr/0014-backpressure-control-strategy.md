# ADR-0014: Backpressure Control Strategy

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** KB Labs Team

## Context

KB Labs Analytics must handle high event rates without:
- **Memory exhaustion** (unbounded buffer growth)
- **Disk exhaustion** (too many segments)
- **Cascading failures** (overwhelming sinks)
- **Application blocking** (slow emit() calls)

We need:
- **Graceful degradation** (sample when overwhelmed)
- **Clear feedback** (tell caller when events are dropped)
- **Configurable thresholds** (adjust for workload)
- **Non-blocking emit()** (never throw, return status)

Alternatives considered:
- Block emit() when queue full (rejected - blocks application)
- Throw errors on overflow (rejected - breaks caller code)
- Unbounded queue (rejected - memory risk)
- Fixed-size queue (rejected - too rigid)

## Decision

Use **staged backpressure with sampling**:
- **Three states**: normal, high, critical
- **Queue depth thresholds**: `high` (default: 20,000), `critical` (default: 50,000)
- **Staged sampling**: High (50%), Critical (10%)
- **Non-blocking emit()**: Always returns `{queued, reason?}` (never throws)
- **Drop counters**: Track dropped events for monitoring

### Backpressure States

```
Normal (queueDepth < high)
  └─► Accept all events (100%)

High (high <= queueDepth < critical)
  └─► Sample events (50% kept, 50% dropped)

Critical (queueDepth >= critical)
  └─► Sample events (10% kept, 90% dropped)
```

### Sampling Algorithm

- **Random sampling**: Use Math.random() for uniform distribution
- **Per-event rate**: Configurable per event type
- **Deterministic option**: Could use hash(eventId) for reproducible sampling

### Emit() Behavior

```typescript
async emit(event): Promise<{queued: boolean, reason?: string}> {
  // ... validation ...
  
  // Check backpressure
  if (backpressure.isHigh()) {
    if (Math.random() > samplingRate) {
      return { queued: false, reason: 'Backpressure high: sampled out' };
    }
  }
  
  // ... queue event ...
  return { queued: true };
}
```

## Consequences

### Positive

- **Graceful degradation**: System continues under load
- **Non-blocking**: emit() never blocks or throws
- **Configurable**: Thresholds adjustable per deployment
- **Observable**: Drop counters visible in metrics
- **Proportional sampling**: Higher load = more aggressive sampling

### Negative

- **Data loss**: Some events dropped under load
- **Non-deterministic**: Random sampling (can't replay exact sequence)
- **Complexity**: State management and thresholds

### Alternatives Considered

- **Block emit()**: Rejected - blocks application
- **Throw errors**: Rejected - breaks caller code
- **Unbounded queue**: Rejected - memory risk
- **Fixed-size queue**: Rejected - too rigid
- **Circular buffer**: Rejected - loses oldest events (worse than sampling)

## Implementation

Located in `@kb-labs/analytics-core/src/backpressure.ts`:

- `BackpressureController` manages state
- `getState()` returns current state (normal/high/critical)
- `shouldAccept()` checks if event should be accepted
- `getStats()` returns drop counts and sampling rates

### Configuration

```json
{
  "backpressure": {
    "high": 20000,
    "critical": 50000,
    "sampling": {
      "high": 0.5,
      "critical": 0.1
    }
  }
}
```

### Metrics

Exposed via `analytics.getMetrics()`:

```typescript
{
  eventsPerSecond: 100.5,
  queueDepth: 15000,
  droppedEvents: 250,
  backpressureLevel: 'normal' | 'high' | 'critical'
}
```

### Usage

```typescript
const result = await analytics.emit(event);
if (!result.queued && result.reason?.includes('Backpressure')) {
  // Event dropped due to backpressure
  // Log warning, but don't fail operation
}
```

## References

- [Backpressure Pattern](https://en.wikipedia.org/wiki/Backpressure_routing)
- Related: ADR-0009 (WAL Buffer Architecture)

