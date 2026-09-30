export type PluginRuntime = 'inline' | 'server' | 'sidecar' | 'browser';

export type PluginCategory =
  | 'memory'
  | 'research'
  | 'media'
  | 'automation'
  | 'simulation'
  | 'world'
  | 'documents'
  | 'agents'
  | 'context'
  | 'developer';

export type PluginPermission =
  | 'memory:read'
  | 'memory:write'
  | 'web:read'
  | 'browser:control'
  | 'media:generate'
  | 'documents:read'
  | 'simulation:run'
  | 'world:read'
  | 'world:write'
  | 'screen:read'
  | 'agent:spawn'
  | 'developer:inspect';

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  category: PluginCategory;
  runtime: PluginRuntime;
  permissions: PluginPermission[];
  sourceRepos: string[];
  optional: boolean;
  configKeys?: string[];
  actions: string[];
};

export type PluginStatus = {
  manifest: PluginManifest;
  configured: boolean;
  enabled: boolean;
  reason?: string;
};

export type PluginExecutionContext = {
  empresaId: string;
  isSuperAdmin?: boolean;
  userId?: string | null;
};

export type PluginExecutionResult = {
  ok: boolean;
  pluginId: string;
  action: string;
  data?: unknown;
  error?: string;
};
