# @kb-labs/analytics-cli

KB Labs Analytics - CLI commands.

## Vision & Purpose

**@kb-labs/analytics-cli** provides CLI commands for KB Labs Analytics. It includes commands for emitting events, viewing stats, tailing events, managing dead-letter queue, and managing buffer.

### Core Goals

- **Emit Command**: Emit analytics events from CLI
- **Stats Command**: View analytics statistics
- **Tail Command**: Tail analytics events
- **DLQ Command**: Manage dead-letter queue
- **Flush Command**: Flush buffer to sinks
- **Compact Command**: Compact buffer segments
- **Status Command**: View analytics status

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Analytics CLI
    │
    ├──► CLI Commands
    ├──► Manifest Definition
    ├──► REST Handlers
    └──► Setup Handler
```

### Key Components

1. **Commands** (`commands/`): CLI command implementations
2. **Manifest** (`manifest.v2.ts`): Plugin manifest definition
3. **REST Handlers** (`rest/handlers/`): REST API handlers
4. **Setup** (`setup/handler.ts`): Setup handler

## ✨ Features

- **Emit command** for emitting events
- **Stats command** for viewing statistics
- **Tail command** for tailing events
- **DLQ command** for managing dead-letter queue
- **Flush command** for flushing buffer
- **Compact command** for compacting buffer
- **Status command** for viewing status
- **REST handlers** for API integration

## 📦 API Reference

### Main Exports

#### Commands

- `emit`: Emit analytics event command
- `stats`: View analytics statistics command
- `tail`: Tail analytics events command
- `dlq`: Manage dead-letter queue command
- `flush`: Flush buffer command
- `compact`: Compact buffer command
- `status`: View analytics status command

#### Manifest

- `manifest`: Plugin manifest V2
- `commands`: CLI commands manifest

## 🔧 Configuration

### Configuration Options

All configuration via CLI flags and kb-labs.config.json.

### CLI Flags

- `--json`: Output JSON format
- `--quiet`: Quiet mode
- `--verbose`: Verbose output

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/analytics-core` (`link:../analytics-core`): Analytics core
- `@kb-labs/analytics-sdk-node` (`link:../analytics-sdk-node`): Analytics SDK
- `@kb-labs/core` (`link:../../../kb-labs-core`): Core package
- `@kb-labs/shared-cli-ui` (`link:../../../kb-labs-shared/packages/cli-ui`): Shared CLI UI
- `@kb-labs/cli-commands` (`link:../../../kb-labs-cli/packages/commands`): CLI commands
- `@kb-labs/plugin-manifest` (`link:../../../kb-labs-plugin/packages/manifest`): Plugin manifest
- `globby` (`^11.0.0`): File pattern matching
- `zod` (`^4.1.5`): Schema validation

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/node` (`^24.7.0`): Node.js types
- `tsup` (`^8`): TypeScript bundler
- `typescript` (`^5`): TypeScript compiler
- `vitest` (`^3`): Test runner

## 🧪 Testing

### Test Structure

```
src/__tests__/
└── manifest.v2.spec.ts
```

### Test Coverage

- **Current Coverage**: ~50%
- **Target Coverage**: 90%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(1) for command registration, O(n) for command execution
- **Space Complexity**: O(1)
- **Bottlenecks**: Analytics operations

## 🔒 Security

### Security Considerations

- **Event Validation**: Event validation via schemas
- **Path Validation**: Path validation for file operations

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Command Types**: Fixed command types
- **Output Formats**: Fixed output formats

### Future Improvements

- **More Commands**: Additional commands
- **Custom Output Formats**: Custom output format support

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: Emit Event

```bash
kb analytics:emit --type "audit.run.finished" --payload '{"checks": 6, "ok": true}'
```

### Example 2: View Stats

```bash
kb analytics:stats
```

### Example 3: Tail Events

```bash
kb analytics:tail
```

### Example 4: View Status

```bash
kb analytics:status
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs

