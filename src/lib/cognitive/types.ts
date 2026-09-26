export type CognitiveIntent =
  | 'chat'
  | 'legal-research'
  | 'case-analysis'
  | 'document-ocr'
  | 'automation'
  | 'web-monitor'
  | 'browser-task'
  | 'report'
  | 'presentation'
  | 'voice'
  | 'image-enhance'
  | 'visual-generation'
  | 'developer'
  | 'knowledge'
  | 'web-research'
  | 'simulation'
  | 'skill-learning'
  | 'api-discovery'
  | 'image-generation'
  | 'video-generation'
  | 'world-simulation'
  | 'plugin-management'
  | 'agent-orchestration';

export type CapabilityId =
  | 'lexis-rules'
  | 'memory-v2'
  | 'council'
  | 'research'
  | 'browser-agent'
  | 'change-watch'
  | 'ocr'
  | 'document-understanding'
  | 'report-engine'
  | 'presentation-engine'
  | 'voice-studio'
  | 'image-enhance'
  | 'visual-render'
  | 'model-cascade'
  | 'quality-gate'
  | 'observability'
  | 'firecrawl'
  | 'simulation-engine'
  | 'skill-library'
  | 'api-discovery'
  | 'comfy-media'
  | 'plugin-platform'
  | 'world-sandbox'
  | 'agent-studio'
  | 'screen-context';

export type CapabilityRuntime = 'inline' | 'server' | 'browser' | 'sidecar';

export type CapabilityDefinition = {
  id: CapabilityId;
  label: string;
  description: string;
  runtime: CapabilityRuntime;
  zeroToken: boolean;
  optional: boolean;
  sourcePatterns: string[];
};

export type CognitivePlanStep = {
  capability: CapabilityId;
  reason: string;
  required: boolean;
};

export type CognitivePlan = {
  intent: CognitiveIntent;
  steps: CognitivePlanStep[];
  zeroTokenFirst: boolean;
  requiresModel: boolean;
};
