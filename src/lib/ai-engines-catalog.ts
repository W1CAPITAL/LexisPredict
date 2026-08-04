/**
 * NÚCLEO NEURAL — catálogo único de motores de IA do LexisPredict.
 * Usar em: Settings, Sugerir resposta (tarefas/processos), chatbot, motor-despacho.
 *
 * Oficiais = chave no Vercel (servidor).
 * Lexis = scripts determinísticos (sempre on, sem API).
 * Puter = opcional cliente (user-pays), NÃO substitui oficial em produção sensível.
 */

export type EngineKind = 'official' | 'lexis' | 'puter' | 'optional';

export interface AiEngineDef {
  id: string;
  label: string;
  provider: string;
  kind: EngineKind;
  /** Env vars no Vercel (qualquer uma) */
  envKeys?: string[];
  /** Modelo padrão na API oficial */
  defaultModel?: string;
  /** Modelo Puter.js (se kind puter) */
  puterModel?: string;
  /** Onde aparece */
  surfaces: Array<'settings' | 'suggest' | 'chat' | 'ocr' | 'automacao'>;
  notes?: string;
}

export const AI_ENGINES_CATALOG: AiEngineDef[] = [
  {
    id: 'lexis_scripts',
    label: 'Motor Lexis (scripts)',
    provider: 'LexisPredict',
    kind: 'lexis',
    surfaces: ['settings', 'suggest', 'tarefas' as any, 'chat'].filter(Boolean) as any,
    notes: '1ª linha em Sugerir resposta. Sem API. Determinístico e protetivo.',
  },
  {
    id: 'xai_official',
    label: 'xAI Grok (oficial)',
    provider: 'xAI',
    kind: 'official',
    envKeys: [
      'XAI_API_KEY',
      'XAI_GROK_PRESTIGE_API_KEY',
      'XAI_DOCUMENTS_API_KEY',
    ],
    defaultModel: 'grok-3',
    surfaces: ['settings', 'suggest', 'chat', 'ocr', 'automacao'],
    notes: 'API oficial api.x.ai — use as chaves do Vercel.',
  },
  {
    id: 'groq_official',
    label: 'Groq Llama',
    provider: 'Groq',
    kind: 'official',
    envKeys: ['GROQ_API_KEY', 'GROQ_KEY'],
    defaultModel: 'llama-3.3-70b-versatile',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Rápido e barato para rascunhos.',
  },
  {
    id: 'gemini_official',
    label: 'Google Gemini',
    provider: 'Google',
    kind: 'official',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    defaultModel: 'gemini-2.0-flash',
    surfaces: ['settings', 'suggest', 'chat', 'ocr', 'automacao'],
    notes: 'Bom para OCR/visão de prints do tribunal.',
  },
  {
    id: 'puter_grok',
    label: 'Puter · Grok (user-pays)',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'x-ai/grok-3',
    surfaces: ['settings', 'suggest', 'chat'],
    notes:
      'Sem chave no servidor; custo no usuário Puter. Fallback quando oficial offline — não use repos “Grok API free” não confiáveis.',
  },
  {
    id: 'puter_openai',
    label: 'Puter · OpenAI',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'gpt-5.4-nano',
    surfaces: ['settings', 'suggest', 'chat'],
    notes: 'Via Puter.js CDN/npm — user-pays.',
  },
  {
    id: 'puter_claude',
    label: 'Puter · Claude',
    provider: 'Puter.js',
    kind: 'puter',
    puterModel: 'claude-sonnet-4-5',
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

/** Lista para UI Settings / selects */
export function enginesForSurface(
  surface: AiEngineDef['surfaces'][number]
): AiEngineDef[] {
  return AI_ENGINES_CATALOG.filter((e) => e.surfaces.includes(surface));
}

export function engineById(id: string): AiEngineDef | undefined {
  return AI_ENGINES_CATALOG.find((e) => e.id === id);
}

/** Status de chave no servidor (chamar só em server action) */
export function resolveOfficialKeysPresent(): Record<string, boolean> {
  const has = (keys?: string[]) =>
    !!(keys || []).some((k) => !!process.env[k]?.trim());
  const out: Record<string, boolean> = {};
  for (const e of AI_ENGINES_CATALOG) {
    if (e.kind === 'official') out[e.id] = has(e.envKeys);
    if (e.kind === 'lexis') out[e.id] = true;
    if (e.kind === 'puter') out[e.id] = true; // client-side
  }
  return out;
}
