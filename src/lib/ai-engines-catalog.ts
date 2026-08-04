/**
 * NÚCLEO NEURAL — catálogo único (Settings, Sugerir resposta, Chat, OCR, Automação).
 * Claude (Anthropic) é o motor principal oficial.
 */
export type EngineKind = 'official' | 'lexis' | 'puter' | 'optional';

export interface AiEngineDef {
  id: string;
  label: string;
  provider: string;
  kind: EngineKind;
  envKeys?: string[];
  defaultModel?: string;
  puterModel?: string;
  surfaces: Array<'settings' | 'suggest' | 'chat' | 'ocr' | 'automacao'>;
  notes?: string;
}

export const AI_ENGINES_CATALOG: AiEngineDef[] = [
  {
    id: 'claude_official',
    label: 'Claude (Anthropic) — principal',
    provider: 'Anthropic',
    kind: 'official',
    envKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'ANTHROPIC_KEY'],
    defaultModel: 'claude-sonnet-4-20250514',
    surfaces: ['settings', 'suggest', 'chat', 'ocr', 'automacao'],
    notes:
      'API Messages completa: multi-turn, system, vision, tools, max_tokens, temperature. Preferido no Lexis.',
  },
  {
    id: 'lexis_scripts',
    label: 'Motor Lexis (scripts)',
    provider: 'LexisPredict',
    kind: 'lexis',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Determinístico, sem API. Scripts de resposta e regras de gabinete.',
  },
  {
    id: 'xai_official',
    label: 'xAI Grok (oficial)',
    provider: 'xAI',
    kind: 'official',
    envKeys: ['XAI_API_KEY', 'XAI_GROK_PRESTIGE_API_KEY', 'XAI_DOCUMENTS_API_KEY', 'GROK_API_KEY'],
    defaultModel: 'grok-2-1212',
    surfaces: ['settings', 'suggest', 'chat', 'ocr', 'automacao'],
    notes: 'api.x.ai — raciocínio jurídico e rascunhos.',
  },
  {
    id: 'groq_official',
    label: 'Groq Llama',
    provider: 'Groq',
    kind: 'official',
    envKeys: ['GROQ_API_KEY', 'GROQ_KEY'],
    defaultModel: 'llama-3.3-70b-versatile',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Resposta rápida e barata.',
  },
  {
    id: 'openrouter_official',
    label: 'OpenRouter',
    provider: 'OpenRouter',
    kind: 'official',
    envKeys: ['OPENROUTER_API_KEY'],
    defaultModel: 'openai/gpt-oss-20b:free',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Gateway multi-modelo (OPENROUTER_MODEL).',
  },
  {
    id: 'airforce_official',
    label: 'Airforce',
    provider: 'Airforce',
    kind: 'official',
    envKeys: ['AIRFORCE_API_KEY'],
    defaultModel: 'deepseek-v3',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Fallback alternativo.',
  },
  {
    id: 'gemini_official',
    label: 'Google Gemini',
    provider: 'Google',
    kind: 'official',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    defaultModel: 'gemini-2.0-flash',
    surfaces: ['settings', 'suggest', 'chat', 'ocr', 'automacao'],
    notes: 'Bom para OCR/visão de prints.',
  },
  {
    id: 'puter_claude',
    label: 'Puter · Claude (user-pays)',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'claude-sonnet-4-5',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Sem key no servidor; custo no usuário Puter.',
  },
  {
    id: 'puter_grok',
    label: 'Puter · Grok (user-pays)',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'x-ai/grok-3',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Via Puter.js CDN — user-pays.',
  },
  {
    id: 'puter_openai',
    label: 'Puter · OpenAI',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'gpt-5.4-nano',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Via Puter.js — user-pays.',
  },
  {
    id: 'puter_llama',
    label: 'Puter · Llama',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'meta-llama/llama-3.3-70b-instruct',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Via Puter.js — user-pays.',
  },
];

export function enginesForSurface(surface: AiEngineDef['surfaces'][number]): AiEngineDef[] {
  return AI_ENGINES_CATALOG.filter((e) => e.surfaces.includes(surface));
}

export function engineById(id: string): AiEngineDef | undefined {
  return AI_ENGINES_CATALOG.find((e) => e.id === id);
}

export function resolveOfficialKeysPresent(): Record<string, boolean> {
  const has = (keys?: string[]) => !!(keys || []).some((k) => !!process.env[k]?.trim());
  const out: Record<string, boolean> = {};
  for (const e of AI_ENGINES_CATALOG) {
    if (e.kind === 'official') out[e.id] = has(e.envKeys);
    if (e.kind === 'lexis' || e.kind === 'puter') out[e.id] = true;
  }
  return out;
}
