# Package Architecture Description: @kb-labs/analytics-core

**Version**: 0.1.0
**Last Updated**: 2025-11-16

## Executive Summary

**@kb-labs/analytics-core** provides the core analytics pipeline for KB Labs Analytics. It includes event validation, WAL buffer, middleware pipeline, dead-letter queue, backpressure control, and built-in metrics.

## 1. Package Overview

### 1.1 Purpose & Scope

**Primary Purpose**: Provide core analytics pipeline.

**Scope Boundaries**:
- **In Scope**: Event validation, buffer, middleware, DLQ, backpressure, batching, routing, metrics
- **Out of Scope**: Sink implementations (in analytics-adapters), CLI commands (in analytics-cli)

**Domain**: Analytics / Core Pipeline

### 1.2 Key Responsibilities

1. **Event Validation**: Strict Zod-based validation for AnalyticsEventV1
2. **WAL Buffer**: Append-only segments with deduplication
3. **Middleware Pipeline**: Redact → HashPII → Sample → Enrich
4. **Dead-Letter Queue**: Failed event storage and replay
5. **Backpressure Control**: Staged sampling and drop counters
6. **Built-in Metrics**: Event rate, batch sizes, latencies, error rates

## 2. High-Level Architecture

### 2.1 Architecture Diagram

```
Analytics Core
    │
    ├──► Event Validation (schema/)
    │   ├──► validateEvent()
    │   └──► safeValidateEvent()
    │
    ├──► WAL Buffer (buffer.ts)
    │   ├──► Append-only segments
    │   └──► Deduplication
    │
    ├──► Middleware Pipeline (middleware/)
    │   ├──► Redact
    │   ├──► HashPII
    │   ├──► Sample
    │   └──► Enrich
    │
    ├──► Dead-Letter Queue (dlq.ts)
    │   ├──► Failed event storage
    │   └──► Replay support
    │
    ├──► Backpressure Control (backpressure.ts)
    │   ├──► Staged sampling
    │   └──► Drop counters
    │
    ├──► Event Batching (batcher.ts)
    │   └──► Batch events for efficiency
    │
    ├──► Sink Router (router.ts)
    │   └──► Route to multiple sinks
    │
    └──► Metrics Collection (metrics.ts)
        └──► Event rate, batch sizes, latencies
```

### 2.2 Architectural Style

- **Style**: Pipeline Pattern
- **Rationale**: Event processing pipeline with middleware

## 3. Component Architecture

### 3.1 Component: Event Validation

- **Purpose**: Validate events
- **Responsibilities**: Schema validation, type checking
- **Dependencies**: zod

### 3.2 Component: WAL Buffer

- **Purpose**: Buffer events
- **Responsibilities**: Append-only segments, deduplication
- **Dependencies**: fs

### 3.3 Component: Middleware Pipeline

- **Purpose**: Process events
- **Responsibilities**: Redact, hash PII, sample, enrich
- **Dependencies**: None

### 3.4 Component: Dead-Letter Queue

- **Purpose**: Store failed events
- **Responsibilities**: Failed event storage, replay
- **Dependencies**: fs

### 3.5 Component: Backpressure Control

- **Purpose**: Control backpressure
- **Responsibilities**: Staged sampling, drop counters
- **Dependencies**: None

### 3.6 Component: Event Batching

- **Purpose**: Batch events
- **Responsibilities**: Batch events for efficiency
- **Dependencies**: None

### 3.7 Component: Sink Router

- **Purpose**: Route to sinks
- **Responsibilities**: Route events to multiple sinks
- **Dependencies**: analytics-adapters

### 3.8 Component: Metrics Collection

- **Purpose**: Collect metrics
- **Responsibilities**: Event rate, batch sizes, latencies
- **Dependencies**: None

## 4. Data Flow

```
emit(event)
    │
    ├──► Validate event
    ├──► Apply middleware (redact → hashPII → sample → enrich)
    ├──► Write to buffer
    ├──► Check backpressure
    ├──► Batch events
    ├──► Route to sinks
    └──► Update metrics
```

## 5. Design Patterns

- **Pipeline Pattern**: Event processing pipeline
- **Middleware Pattern**: Middleware for event processing
- **Router Pattern**: Route events to sinks
- **Observer Pattern**: Metrics collection

## 6. Performance Architecture

- **Time Complexity**: O(1) for emit, O(n) for batch processing
- **Space Complexity**: O(n) where n = buffer size
- **Bottlenecks**: Sink write operations

## 7. Security Architecture

- **PII Hashing**: Hash PII fields in middleware
- **Redaction**: Redact sensitive keys
- **Schema Validation**: Validate all events

---

**Last Updated**: 2025-11-16

