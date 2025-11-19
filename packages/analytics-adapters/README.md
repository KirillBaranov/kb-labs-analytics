# @kb-labs/analytics-adapters

KB Labs Analytics - sinks and middleware adapters.

## Vision & Purpose

**@kb-labs/analytics-adapters** provides sink adapters for KB Labs Analytics. It includes file system sink, HTTP sink, S3 sink, and SQLite sink for storing analytics events.

### Core Goals

- **File System Sink**: Write events to local files
- **HTTP Sink**: Send events to HTTP endpoints
- **S3 Sink**: Store events in S3
- **SQLite Sink**: Store events in SQLite database

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Analytics Adapters
    │
    ├──► File System Sink
    ├──► HTTP Sink
    ├──► S3 Sink
    └──► SQLite Sink
```

### Key Components

1. **FSSink** (`sinks/fs.ts`): File system sink
2. **HTTPSink** (`sinks/http.ts`): HTTP sink
3. **S3Sink** (`sinks/s3.ts`): S3 sink
4. **SQLiteSink** (`sinks/sqlite.ts`): SQLite sink

## ✨ Features

- **File System Sink**: Write events to local files (JSONL format)
- **HTTP Sink**: Send events to HTTP endpoints
- **S3 Sink**: Store events in S3 buckets
- **SQLite Sink**: Store events in SQLite database

## 📦 API Reference

### Main Exports

#### Sinks

- `FSSink`: File system sink
- `HTTPSink`: HTTP sink
- `S3Sink`: S3 sink
- `SQLiteSink`: SQLite sink

#### Types

- `FSSinkConfig`: File system sink configuration
- `HTTPSinkConfig`: HTTP sink configuration
- `S3SinkConfig`: S3 sink configuration
- `SQLiteSinkConfig`: SQLite sink configuration

## 🔧 Configuration

### Configuration Options

Sinks configured via analytics-core configuration:

```json
{
  "analytics": {
    "sinks": [
      {
        "type": "fs",
        "path": ".kb/analytics/events.jsonl"
      },
      {
        "type": "http",
        "url": "https://api.example.com/events",
        "headers": {
          "Authorization": "Bearer token"
        }
      },
      {
        "type": "s3",
        "bucket": "analytics-events",
        "region": "us-east-1",
        "accessKeyId": "AKIA...",
        "secretAccessKey": "..."
      },
      {
        "type": "sqlite",
        "path": ".kb/analytics/events.db"
      }
    ]
  }
}
```

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/analytics-core` (`link:../analytics-core`): Analytics core
- `@aws-sdk/client-s3` (`^3.700.0`): AWS S3 client
- `better-sqlite3` (`^11.7.0`): SQLite database

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/better-sqlite3` (`^7.6.12`): SQLite types
- `@types/node` (`^24.7.0`): Node.js types
- `tsup` (`^8`): TypeScript bundler
- `typescript` (`^5`): TypeScript compiler
- `vitest` (`^3`): Test runner

## 🧪 Testing

### Test Structure

```
src/sinks/__tests__/
├── fs.spec.ts
├── http.spec.ts
├── s3.spec.ts
└── sqlite.spec.ts
```

### Test Coverage

- **Current Coverage**: ~70%
- **Target Coverage**: 90%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(1) for sink write, O(n) for batch writes
- **Space Complexity**: O(1)
- **Bottlenecks**: Network I/O for HTTP/S3 sinks

## 🔒 Security

### Security Considerations

- **S3 Credentials**: Secure credential handling
- **HTTP Headers**: Secure header transmission
- **File Permissions**: Secure file permissions

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Sink Types**: Fixed sink types
- **S3 Region**: Fixed S3 region per sink

### Future Improvements

- **More Sink Types**: Additional sink types (Kafka, Redis, etc.)
- **Dynamic S3 Region**: Configurable S3 region

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: File System Sink

```typescript
import { FSSink } from '@kb-labs/analytics-adapters';

const sink = new FSSink({
  path: '.kb/analytics/events.jsonl',
});

await sink.write(event);
```

### Example 2: HTTP Sink

```typescript
import { HTTPSink } from '@kb-labs/analytics-adapters';

const sink = new HTTPSink({
  url: 'https://api.example.com/events',
  headers: {
    'Authorization': 'Bearer token',
  },
});

await sink.write(event);
```

### Example 3: S3 Sink

```typescript
import { S3Sink } from '@kb-labs/analytics-adapters';

const sink = new S3Sink({
  bucket: 'analytics-events',
  region: 'us-east-1',
  accessKeyId: 'AKIA...',
  secretAccessKey: '...',
});

await sink.write(event);
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs

