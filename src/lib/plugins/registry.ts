import type { PluginManifest, PluginStatus } from './types';

export const PLUGINS: PluginManifest[] = [
  {
    id: 'memory-core',
    name: 'Memory Core',
    version: '4.0.0',
    description: 'Memória seletiva, compactação, deduplicação e contexto recuperável.',
    category: 'memory',
    runtime: 'inline',
    permissions: ['memory:read', 'memory:write'],
    sourceRepos: ['ItsWambarYT/ai-brain', 'thedotmack/claude-mem', 'SamurAIGPT/llm-wiki-agent', 'mycelium-hq/ai-brain-starter'],
    optional: false,
    actions: ['status'],
  },
  {
    id: 'research-firecrawl',
    name: 'Firecrawl Research',
    version: '1.0.0',
    description: 'Pesquisa e scrape web estruturados por adapter autenticado.',
    category: 'research',
    runtime: 'sidecar',
    permissions: ['web:read'],
    sourceRepos: ['firecrawl/firecrawl', 'D4Vinci/Scrapling'],
    optional: true,
    configKeys: ['FIRECRAWL_API_KEY', 'FIRECRAWL_BASE_URL'],
    actions: ['search', 'scrape'],
  },
  {
    id: 'media-comfy',
    name: 'ComfyUI Media',
    version: '1.0.0',
    description: 'Workflows de imagem e vídeo em serviço ComfyUI separado.',
    category: 'media',
    runtime: 'sidecar',
    permissions: ['media:generate'],
    sourceRepos: ['Comfy-Org/ComfyUI', 'upscayl/upscayl', 'TachibanaYoshino/AnimeGANv3', 'dtoyoda10/anime-gen'],
    optional: true,
    configKeys: ['COMFYUI_BASE_URL', 'COMFYUI_IMAGE_WORKFLOW_JSON', 'COMFYUI_VIDEO_WORKFLOW_JSON'],
    actions: ['status', 'generate-image', 'generate-video', 'history'],
  },
  {
    id: 'scenario-simulator',
    name: 'Scenario Simulator',
    version: '1.0.0',
    description: 'Monte Carlo local e reproduzível para cenários quantitativos.',
    category: 'simulation',
    runtime: 'inline',
    permissions: ['simulation:run'],
    sourceRepos: ['kwai/DouZero', 'nikmcfly/MiroFish-Offline', 'xcontcom/neuroparticles'],
    optional: false,
    actions: ['run'],
  },
  {
    id: 'world-sandbox',
    name: 'World Sandbox',
    version: '1.0.0',
    description: 'Mundo procedural por chunks, biomas, recursos e agentes com seed reproduzível.',
    category: 'world',
    runtime: 'inline',
    permissions: ['world:read', 'world:write', 'simulation:run'],
    sourceRepos: [
      'fogleman/Craft',
      'dgreenheck/minecraft-threejs-clone',
      '0xfabian/mc',
      'pquiring/jfcraft',
      'obiwac/python-minecraft-clone',
      'Aidanhouk/Minecraft-Clone',
    ],
    optional: false,
    actions: ['chunk', 'simulate'],
  },
  {
    id: 'agent-studio',
    name: 'Agent Studio',
    version: '1.0.0',
    description: 'Planeja equipes especializadas de agentes com papéis, gates e ferramentas.',
    category: 'agents',
    runtime: 'inline',
    permissions: ['agent:spawn'],
    sourceRepos: ['Donchitos/Claude-Code-Game-Studios', 'TransformerOptimus/SuperAGI', 'reworkd/AgentGPT', 'earendil-works/pi'],
    optional: false,
    actions: ['plan-team'],
  },
  {
    id: 'screen-context',
    name: 'Screen Context',
    version: '0.1.0',
    description: 'Ponte opcional para contexto local de tela/áudio fornecido pelo próprio usuário.',
    category: 'context',
    runtime: 'sidecar',
    permissions: ['screen:read'],
    sourceRepos: ['screenpipe/screenpipe'],
    optional: true,
    configKeys: ['SCREENPIPE_BASE_URL'],
    actions: ['status', 'search'],
  },
  {
    id: 'ocr-paddle',
    name: 'Paddle OCR',
    version: '1.0.0',
    description: 'OCR self-host de documentos, com fallback para motor local.',
    category: 'documents',
    runtime: 'sidecar',
    permissions: ['documents:read'],
    sourceRepos: ['PaddlePaddle/PaddleOCR'],
    optional: true,
    configKeys: ['OCR_PADDLE_URL'],
    actions: ['status'],
  },
  {
    id: 'change-watch',
    name: 'Change Watch',
    version: '1.0.0',
    description: 'Snapshot, diff e detecção de mudanças antes de interpretação por IA.',
    category: 'automation',
    runtime: 'server',
    permissions: ['web:read'],
    sourceRepos: ['dgtlmoon/changedetection.io', 'tj/watch'],
    optional: false,
    actions: ['status'],
  },
  {
    id: 'developer-lab',
    name: 'Developer Lab',
    version: '1.0.0',
    description: 'Skills de TDD, diagnóstico, arquitetura, browser e aprendizagem técnica.',
    category: 'developer',
    runtime: 'inline',
    permissions: ['developer:inspect'],
    sourceRepos: [
      'mattpocock/skills',
      'obra/superpowers',
      'affaan-m/ECC',
      'ChromeDevTools/chrome-devtools-mcp',
      'codecrafters-io/build-your-own-x',
      'freeCodeCamp/freeCodeCamp',
      'EvanLi/Github-Ranking',
    ],
    optional: false,
    actions: ['status'],
  },
];

function hasAny(keys: string[] | undefined): boolean {
  if (!keys?.length) return true;
  return keys.some((key) => Boolean(String(process.env[key] || '').trim()));
}

export function listPluginStatuses(): PluginStatus[] {
  return PLUGINS.map((manifest) => {
    const configured = !manifest.optional || hasAny(manifest.configKeys);
    return {
      manifest,
      configured,
      enabled: configured,
      reason: configured ? undefined : `Configure: ${(manifest.configKeys || []).join(' ou ')}`,
    };
  });
}

export function findPluginManifest(id: string): PluginManifest | undefined {
  return PLUGINS.find((plugin) => plugin.id === id);
}
