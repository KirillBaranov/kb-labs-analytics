/**
 * @kb-labs/analytics-cli
 * CLI commands are registered via manifest.v2.ts for @kb-labs/cli.
 * Use commands via: `kb analytics <command>`
 */

export { manifest } from './manifest.v2.js';
export type { ManifestV2 } from '@kb-labs/plugin-manifest';

export * from './application/index.js';
export * from './domain/index.js';
export * from './shared/index.js';
export * from './infra/index.js';
export * from './cli/index.js';
export * from './rest/index.js';

