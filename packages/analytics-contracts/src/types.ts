// Re-export types for consistency with other contracts packages

export type ArtifactKind = 'file' | 'json' | 'markdown' | 'binary' | 'dir' | 'log' | 'text' | 'jsonl';

export interface ArtifactExample {
  summary?: string;
  payload?: unknown;
}

export interface PluginArtifactContract {
  id: string;
  kind: ArtifactKind;
  description?: string;
  pathPattern?: string;
  mediaType?: string;
  schemaRef?: string;
  example?: ArtifactExample;
}

export type ArtifactContractsMap = Record<string, PluginArtifactContract>;

export interface SchemaReference {
  ref: string;
  format?: 'zod' | 'json-schema' | 'openapi';
  description?: string;
}

export interface CommandContract {
  id: string;
  description?: string;
  input?: SchemaReference;
  output?: SchemaReference;
  produces?: string[];
  consumes?: string[];
  examples?: string[];
}

export type CommandContractsMap = Record<string, CommandContract>;

export interface RestRouteContract {
  id: string;
  method: string;
  path: string;
  description?: string;
  request?: SchemaReference;
  response?: SchemaReference;
  produces?: string[];
  consumes?: string[];
}

export interface RestApiContract {
  basePath: string;
  routes: Record<string, RestRouteContract>;
}

export interface ApiContract {
  rest?: RestApiContract;
}

export interface PluginContracts {
  schema: 'kb.plugin.contracts/1';
  pluginId: string;
  contractsVersion: string;
  artifacts: ArtifactContractsMap;
  commands?: CommandContractsMap;
  workflows?: Record<string, unknown>;
  api?: ApiContract;
}

