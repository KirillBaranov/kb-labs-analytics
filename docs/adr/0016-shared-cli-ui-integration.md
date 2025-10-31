# ADR-0016: Shared CLI UI Integration

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** KB Labs Team

## Context

KB Labs Analytics CLI must provide consistent UX across KB Labs products:
- **Unified styling**: Same look and feel as other products (audit, devlink)
- **Shared components**: Reuse existing CLI UI components
- **Accessibility**: Support NO_COLOR environment variable
- **Maintainability**: Single source of truth for CLI styling

We need:
- **Consistent output**: Boxes, key-value pairs, colors, symbols
- **Shared tooling**: Timing tracker, formatters
- **Zero duplication**: Don't reinvent CLI UI components
- **Type safety**: TypeScript types for CLI components

Alternatives considered:
- Custom CLI UI per product (rejected - inconsistent UX)
- Third-party CLI library (rejected - adds dependency)
- Build our own CLI UI (rejected - duplication)

## Decision

Use **`@kb-labs/shared-cli-ui`** for CLI presentation:
- **Box formatting**: `box()` for sectioned output
- **Key-value pairs**: `keyValue()` for structured data
- **Colors and symbols**: `safeColors`, `safeSymbols` (respect NO_COLOR)
- **Timing tracking**: `TimingTracker` for performance metrics
- **Formatting utilities**: `formatTiming()`, `formatSize()`

### CLI Components Used

1. **Box Output**
   ```typescript
   import { box, keyValue } from '@kb-labs/shared-cli-ui';
   const output = box('Analytics Status', keyValue({ Status: '✓ OK' }));
   ctx.presenter.write(output);
   ```

2. **Colors and Symbols**
   ```typescript
   import { safeColors, safeSymbols } from '@kb-labs/shared-cli-ui';
   const status = safeColors.success(`${safeSymbols.success} Event emitted`);
   ```

3. **Timing Tracker**
   ```typescript
   import { TimingTracker, formatTiming } from '@kb-labs/shared-cli-ui';
   const tracker = new TimingTracker();
   tracker.checkpoint('load');
   const duration = tracker.total();
   const formatted = formatTiming(duration);
   ```

### Command Registration

CLI commands use `@kb-labs/cli-commands` manifest system:
- **Manifest file**: `cli.manifest.ts` defines commands
- **Command interface**: `Command` type from `@kb-labs/cli-commands`
- **Context**: `ctx` object provides `presenter` for output
- **JSON mode**: `flags.json` enables JSON output

## Consequences

### Positive

- **Consistency**: Same UX across all KB Labs products
- **Maintainability**: Single source of truth for CLI UI
- **Accessibility**: Respects NO_COLOR automatically
- **Type safety**: TypeScript types for all components
- **Reusability**: Shared components reduce duplication

### Negative

- **Dependency**: Depends on `@kb-labs/shared-cli-ui`
- **Coupling**: Changes to shared-cli-ui affect analytics CLI

### Alternatives Considered

- **Custom CLI UI**: Rejected - duplication and inconsistency
- **Third-party library**: Rejected - adds dependency and inconsistency
- **No styling**: Rejected - poor user experience

## Implementation

Located in `@kb-labs/analytics-cli/src/commands/`:

- All commands use `@kb-labs/shared-cli-ui` for output
- Commands registered via `cli.manifest.ts`
- Use `ctx.presenter` for output (supports JSON/text modes)

### Example Command

```typescript
import type { Command } from '@kb-labs/cli-commands';
import { box, keyValue, safeColors, safeSymbols } from '@kb-labs/shared-cli-ui';

export const status: Command = {
  name: 'analytics:status',
  async run(ctx, argv, flags) {
    const info: Record<string, string> = {
      Status: safeColors.success(`${safeSymbols.success} OK`),
      Events: '1000',
    };
    const output = box('Analytics Status', keyValue(info));
    ctx.presenter.write(output);
    return 0;
  },
};
```

## References

- `@kb-labs/shared-cli-ui` package
- Related: ADR-0005 (Use DevKit for Shared Tooling)

