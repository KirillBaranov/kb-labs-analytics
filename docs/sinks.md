# Sink Adapters

## Overview

Sink adapters ship events from the analytics buffer to various destinations. Multiple sinks can be configured simultaneously.

## Available Sinks

### File System (FS) Sink

Writes events to local JSONL files with rotation and retention.

**Configuration:**

```json
{
  "type": "fs",
  "path": ".kb/analytics/events",
  "rotation": {
    "maxSizeBytes": 10485760,
    "maxAgeMs": 86400000
  },
  "retention": {
    "days": 30
  }
}
```

**Features:**
- Automatic file rotation by size and age
- Retention policy enforcement
- Idempotency via file-based deduplication

### HTTP Sink

POSTs events to an HTTP endpoint with authentication, retries, and circuit breakers.

**Configuration:**

```json
{
  "type": "http",
  "url": "https://api.example.com/events",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "auth": {
    "type": "bearer",
    "token": "${ANALYTICS_TOKEN}"
  },
  "timeout": 5000,
  "retry": {
    "initialMs": 100,
    "maxMs": 5000,
    "factor": 2,
    "jitter": 0.1
  },
  "breaker": {
    "failures": 5,
    "windowMs": 60000,
    "halfOpenEveryMs": 30000
  },
  "idempotencyKey": "id"
}
```

**Features:**
- Bearer token or API key authentication
- Exponential backoff retries
- Circuit breaker for fault tolerance
- Idempotency via HTTP header

### S3 Sink

Uploads events to AWS S3 with key prefixing and metadata.

**Configuration:**

```json
{
  "type": "s3",
  "bucket": "my-analytics-bucket",
  "region": "us-east-1",
  "keyPrefix": "events/",
  "endpoint": "https://s3.amazonaws.com",
  "credentials": {
    "accessKeyId": "${AWS_ACCESS_KEY_ID}",
    "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}"
  },
  "idempotencyKey": "id"
}
```

**Features:**
- Automatic multipart uploads for large batches
- Key prefixing for organization
- Custom S3-compatible endpoints
- IAM credentials via environment variables
- Idempotency via S3 object metadata

### SQLite Sink

Stores events in a SQLite database with partitioning and indices.

**Configuration:**

```json
{
  "type": "sqlite",
  "path": ".kb/analytics/events.db",
  "partitionBy": "day",
  "retention": {
    "days": 90
  }
}
```

**Features:**
- Automatic table partitioning by day
- Indices on `type`, `ts`, `runId`
- Retention policy enforcement
- WAL mode for performance
- Idempotency via primary key on `id`

## Common Sink Features

### Retry Configuration

All sinks (except FS) support retry configuration:

```json
{
  "retry": {
    "initialMs": 100,
    "maxMs": 5000,
    "factor": 2,
    "jitter": 0.1
  }
}
```

### Circuit Breaker Configuration

HTTP and S3 sinks support circuit breakers:

```json
{
  "breaker": {
    "failures": 5,
    "windowMs": 60000,
    "halfOpenEveryMs": 30000
  }
}
```

### Idempotency

All sinks support idempotency via the `idempotencyKey` configuration:

- **FS**: File-based deduplication
- **HTTP**: `Idempotency-Key` header
- **S3**: Object metadata
- **SQLite**: Primary key on `id`

## Sink Initialization

Sinks are initialized automatically on Analytics startup. Failed initializations are logged but don't prevent Analytics from starting.

## Error Handling

- **Transient errors** (network, timeouts) → Retry with backoff
- **Circuit breaker open** → Events queued until breaker closes
- **Permanent errors** → Events sent to Dead-Letter Queue

## Metrics

Each sink exposes metrics:
- Send latency (p50, p95)
- Error rate
- Circuit breaker state (open/half-open/closed)

Use `kb analytics status` to view sink metrics.

