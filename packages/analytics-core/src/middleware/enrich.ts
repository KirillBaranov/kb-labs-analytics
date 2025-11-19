/**
 * Enrich Middleware - Add context information to events
 */

import { hostname } from 'node:os';
import type { AnalyticsEventV1 } from '../types';
import { findRepoRoot } from '@kb-labs/core';

export interface EnrichConfig {
  git?: boolean; // default: true
  host?: boolean; // default: true
  cli?: boolean; // default: true
  workspace?: boolean; // default: true
}

/**
 * Get git information from repository (simplified - can be enhanced)
 */
async function getGitInfo(repoRoot: string): Promise<{ branch?: string; commit?: string }> {
  try {
    // This is a simplified version - in production you might want to use git commands
    // or a git library
    const { execSync } = await import('child_process');
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    const commit = execSync('git rev-parse HEAD', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    return { branch, commit };
  } catch {
    // Git not available or not a git repo
    return {};
  }
}

/**
 * Get hostname
 */
function getHostname(): string {
  return hostname();
}

/**
 * Get CLI version (from package.json or env)
 */
function getCliVersion(): string | undefined {
  return process.env.KB_CLI_VERSION || process.env.npm_package_version;
}

/**
 * Get workspace path
 */
function getWorkspacePath(cwd: string = process.cwd()): string {
  return cwd;
}

/**
 * Enrich Middleware
 */
export class EnrichMiddleware {
  private config: Required<EnrichConfig>;
  private repoRoot: string | null = null;

  constructor(config: EnrichConfig = {}) {
    this.config = {
      git: config.git ?? true,
      host: config.host ?? true,
      cli: config.cli ?? true,
      workspace: config.workspace ?? true,
    };
  }

  /**
   * Initialize middleware (discover repo root once)
   */
  async init(): Promise<void> {
    try {
      this.repoRoot = await findRepoRoot();
    } catch {
      this.repoRoot = null;
    }
  }

  /**
   * Apply enrichment to event
   */
  async process(event: AnalyticsEventV1): Promise<AnalyticsEventV1> {
    // Create a deep copy to avoid mutating original
    const processed = JSON.parse(JSON.stringify(event)) as AnalyticsEventV1;

    // Ensure ctx exists
    if (!processed.ctx) {
      processed.ctx = {};
    }

    // Add hostname
    if (this.config.host) {
      processed.ctx.hostname = getHostname();
    }

    // Add workspace path
    if (this.config.workspace) {
      processed.ctx.workspace = getWorkspacePath();
    }

    // Add git info if repo root is available
    if (this.config.git && this.repoRoot) {
      const gitInfo = await getGitInfo(this.repoRoot);
      if (gitInfo.branch && !processed.ctx.branch) {
        processed.ctx.branch = gitInfo.branch;
      }
      if (gitInfo.commit && !processed.ctx.commit) {
        processed.ctx.commit = gitInfo.commit;
      }
      // Add repo name if not present
      if (!processed.ctx.repo && this.repoRoot) {
        const pathParts = this.repoRoot.split('/');
        processed.ctx.repo = pathParts[pathParts.length - 1] || 'unknown';
      }
    }

    // Add CLI version
    if (this.config.cli) {
      const cliVersion = getCliVersion();
      if (cliVersion) {
        processed.ctx.cliVersion = cliVersion;
      }
    }

    return processed;
  }

  /**
   * Synchronous version (without git info)
   */
  processSync(event: AnalyticsEventV1): AnalyticsEventV1 {
    const processed = JSON.parse(JSON.stringify(event)) as AnalyticsEventV1;

    if (!processed.ctx) {
      processed.ctx = {};
    }

    if (this.config.host) {
      processed.ctx.hostname = getHostname();
    }

    if (this.config.workspace) {
      processed.ctx.workspace = getWorkspacePath();
    }

    if (this.config.cli) {
      const cliVersion = getCliVersion();
      if (cliVersion) {
        processed.ctx.cliVersion = cliVersion;
      }
    }

    return processed;
  }
}

