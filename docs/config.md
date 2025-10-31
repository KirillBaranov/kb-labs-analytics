# Configuration

## Overview

KB Labs Analytics is configured via `kb-labs.config.json` with environment variable overrides.

## Configuration File

Location: `kb-labs.config.json` (at repository root)

```json
{
  "analytics": {
    "configVersion": 1,
    "enabled": true,
    "buffer": {
      "segmentBytes": 1048576,
      "segmentMaxAgeMs": 60000,
      "fsyncOnRotate": true
    },
    "backpressure": {
      "high": 20000,
      "critical": 50000,
      "sampling": {
        "high": 0.5,
        "critical": 0.1
      }
    },
    "sinks": [
      {
        "type": "fs",
        "path": ".kb/analytics/events"
      }
    ],
    "pii": {
      "hash": {
        "enabled": true,
        "saltEnv": "KB_ANALYTICS_SALT",
        "rotateAfterDays": 30
      },
      "fields": ["actor.id", "ctx.user"]
    },
    "middleware": {
      "redact": {
        "keys": ["password", "token"]
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
    },
    "retention": {
      "wal": { "days": 7 },
      "out": { "days": 30 }
    }
  }
}
```

## Configuration Options

### Buffer Configuration

- **`segmentBytes`** (default: `1048576` = 1MB) - Maximum segment size before rotation
- **`segmentMaxAgeMs`** (default: `60000` = 60s) - Maximum segment age before rotation
- **`fsyncOnRotate`** (default: `true`) - Call fsync when rotating segments

### Backpressure Configuration

- **`high`** (default: `20000`) - Queue depth threshold for high backpressure
- **`critical`** (default: `50000`) - Queue depth threshold for critical backpressure
- **`sampling.high`** (default: `0.5`) - Sampling rate when at high backpressure
- **`sampling.critical`** (default: `0.1`) - Sampling rate when at critical backpressure

### Sink Configuration

See [Sinks Documentation](sinks.md) for sink-specific configuration.

### PII Configuration

- **`hash.enabled`** (default: `false`) - Enable PII hashing
- **`hash.saltEnv`** (default: `KB_ANALYTICS_SALT`) - Environment variable for salt
- **`hash.rotateAfterDays`** (optional) - Salt rotation interval
- **`fields`** - Array of JSON paths to fields containing PII

### Middleware Configuration

- **`redact.keys`** - Array of keys to redact from payload
- **`sampling.default`** - Default sampling rate (0.0 - 1.0)
- **`sampling.byEvent`** - Per-event-type sampling rates
- **`enrich.git`** - Enrich with git information (repo, branch, commit)
- **`enrich.host`** - Enrich with host information
- **`enrich.workspace`** - Enrich with workspace information

### Retention Configuration

- **`wal.days`** (default: `7`) - WAL segment retention in days
- **`out.days`** (default: `30`) - Output file retention in days

## Environment Variables

All configuration options can be overridden via environment variables:

```bash
# Enable/disable analytics
export KB_ANALYTICS_ENABLED=true

# Buffer configuration
export KB_ANALYTICS_BUFFER_SEGMENT_BYTES=2097152
export KB_ANALYTICS_BUFFER_SEGMENT_MAX_AGE_MS=120000

# Backpressure thresholds
export KB_ANALYTICS_BACKPRESSURE_HIGH=30000
export KB_ANALYTICS_BACKPRESSURE_CRITICAL=60000

# PII salt
export KB_ANALYTICS_SALT=your-secret-salt
```

## Configuration Loading Order

1. **Defaults** - Built-in defaults
2. **File Config** - `kb-labs.config.json#analytics`
3. **Environment** - `KB_ANALYTICS_*` variables
4. **CLI Overrides** - Runtime overrides (if supported)

## Validation

Configuration is validated on load. Invalid configurations result in errors with diagnostic messages.

## Versioning

The `configVersion` field enables future schema migrations while maintaining backward compatibility.

