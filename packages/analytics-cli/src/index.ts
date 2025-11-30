/**
 * @kb-labs/analytics-cli
 * CLI commands are registered via manifest.v2.ts for @kb-labs/cli.
 * Use commands via: `kb analytics <command>`
 */

export { manifest } from './manifest.v2';
export type { ManifestV2 } from '@kb-labs/plugin-manifest';

export * from './application/index';
export * from './domain/index';
export * from './shared/index';
export * from './infra/index';
export * from './cli/index';
export * from './rest/index';

