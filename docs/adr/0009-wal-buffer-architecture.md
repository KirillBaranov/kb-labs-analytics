# ADR-0009: WAL Buffer Architecture

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** KB Labs Team

## Context

KB Labs Analytics needs a reliable event buffer that:
- Provides durability (survive process crashes)
- Handles high throughput (thousands of events/second)
- Prevents duplicate events (idempotency)
- Enables efficient replay and recovery
- Supports retention policies

Alternatives considered:
- In-memory buffer only (lost on crash)
- Database-based buffer (too heavy, latency)
- Simple append-only files (no deduplication)

## Decision

Use a **Write-Ahead Log (WAL) buffer** with:
- **Append-only segments** (`.jsonl` files) with rotation
- **Index files** (`.idx`) for fast offset lookup
- **In-memory deduplication cache** using LFU-like eviction
- **Segment rotation** on size (`segmentBytes`) and age (`segmentMaxAgeMs`)
- **fsync on rotate** for durability (`fsyncOnRotate: true`)
- **Bloom filter + LRU cache** hybrid for deduplication

### Architecture

```
┌─────────────┐
│   Analytics │
│     Core    │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│  Dedup      │─────►│   Segment   │
│  Cache      │      │   Manager   │
│  (LFU)      │      └──────┬──────┘
└─────────────┘             │
                            ▼
                   ┌─────────────────┐
                   │ segment-001.jsonl│
                   │ segment-001.idx  │
                   └─────────────────┘
```

### Key Components

1. **Segment Management**
   - Create new segment when size/age limits reached
   - Index file tracks event IDs and offsets
   - Automatic rotation with fsync

2. **Deduplication Cache**
   - In-memory Set for fast lookups
   - LFU-like eviction (access count tracking)
   - Max size limit (default: 10,000 entries)
   - Evicts least frequently accessed on overflow

3. **Idempotency**
   - Check cache before writing
   - Reject duplicates immediately
   - Cache persists across segment rotations

## Consequences

### Positive

- **Durability**: Disk-backed, survives crashes
- **Performance**: In-memory cache for fast deduplication
- **Scalability**: Rotation prevents unbounded growth
- **Reliability**: fsync ensures data integrity
- **Replay**: Index files enable efficient event replay

### Negative

- **Memory usage**: Deduplication cache grows with unique events
- **Disk I/O**: fsync adds latency (acceptable trade-off)
- **Complexity**: Segment management and rotation logic

### Alternatives Considered

- **Pure in-memory**: Rejected - no durability
- **Database**: Rejected - too heavy, adds dependency
- **Simple append-only**: Rejected - no deduplication
- **Bloom filter only**: Rejected - false positives risk

## Implementation

Located in `@kb-labs/analytics-core/src/buffer.ts`:

- `WalBuffer` class manages segments and deduplication
- `DeduplicationCache` implements LFU-like eviction
- `SegmentInfo` tracks segment metadata
- Index files use JSON format for simplicity

### Configuration

```json
{
  "buffer": {
    "segmentBytes": 1048576,      // 1MB segments
    "segmentMaxAgeMs": 60000,      // 60s max age
    "fsyncOnRotate": true          // Durability guarantee
  }
}
```

## References

- [WAL Pattern](https://en.wikipedia.org/wiki/Write-ahead_logging)
- Related: ADR-0010 (Pluggable Sink Adapters)

