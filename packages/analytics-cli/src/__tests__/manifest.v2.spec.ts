import { describe, expect, it } from 'vitest';
import { manifest } from '../manifest.v2.js';

describe('@kb-labs/analytics manifest', () => {
  it('exposes all CLI commands', () => {
    const manifestIds = manifest.cli?.commands?.map((cmd) => cmd.id) ?? [];
    expect(manifestIds.length).toBeGreaterThan(0);
    expect(manifestIds).toEqual(
      expect.arrayContaining([
        'analytics:emit',
        'analytics:tail',
        'analytics:flush',
        'analytics:dlq',
        'analytics:compact',
        'analytics:status',
        'analytics:stats',
      ]),
    );
  });

  it('registers rest routes for buffer and dlq', () => {
    const paths = manifest.rest?.routes?.map((route) => route.path) ?? [];
    expect(paths).toEqual(expect.arrayContaining(['/buffer/status', '/dlq/status']));
  });

  it('defines setup handler', () => {
    expect(manifest.setup?.handler).toBe('./setup/handler.js#run');
  });
});

