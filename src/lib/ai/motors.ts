/**
 * Catálogo de motores neurais Lexis — Claude (Anthropic) como principal.
 * Espelha Settings → Núcleo Neural e seletores de Sugerir resposta / Chat.
 */

export type MotorId =
  | 'claude'
  | 'local_only'
  | 'xai'
  | 'groq-llama'
  | 'openrouter'
  | 'airforce'
  | 'gemini'
  | 'gpt4free'
  | 'puter';

export type MotorDef = {
  id: MotorId;
  label: string;
  short: string;
  desc: string;
  scope: 'server' | 'browser' | 'local';
  envKey?: string;
};

export const MOTORS: MotorDef[] = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    short: 'Claude',
    desc: 'Motor principal — Messages API (Claude / OmniRoute).',
    scope: 'server',
    envKey: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'local_only',
    label: 'Motor Lexis Soberano',
    short: 'Local',
    desc: 'Scripts determinísticos — sem API, sem custo.',
    scope: 'local',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    short: 'xAI',
    desc: 'Raciocínio jurídico (xAI Grok).',
    scope: 'server',
    envKey: 'XAI_API_KEY',
  },
  {
    id: 'groq-llama',
    label: 'Groq Llama 3.3',
    short: 'Groq',
    desc: 'Resposta rápida (Groq).',
    scope: 'server',
    envKey: 'GROQ_API_KEY',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    short: 'OR',
    desc: 'Gateway multi-modelo (OpenRouter).',
    scope: 'server',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    id: 'airforce',
    label: 'Airforce',
    short: 'AF',
    desc: 'Fallback operacional.',
    scope: 'server',
    envKey: 'AIRFORCE_API_KEY',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    short: 'Gemini',
    desc: 'Visão e OCR (Gemini).',
    scope: 'server',
    envKey: 'GEMINI_API_KEY',
  },
  {
    id: 'gpt4free',
    label: 'GPT4Free (gratis)',
    short: 'G4F',
    desc: 'Fallback OpenAI-compativel (gptgod / self-host gpt4free-ts).',
    scope: 'server',
    envKey: 'GPT4FREE_BASE_URL',
  },
  {
    id: 'puter',
    label: 'Puter.js (User-Pays)',
    short: 'Puter',
    desc: 'Browser — usuário cobre o uso.',
    scope: 'browser',
  },
];

export const STORAGE_KEY = 'lexisPredict_preferred_ia';
/** Preferência: Claude analisa DJEN em busca de BA (opcional) */
export const BA_CLAUDE_DJEN_KEY = 'lexisPredict_ba_claude_djen';

export function getMotor(id: string): MotorDef {
  return MOTORS.find((m) => m.id === id) || MOTORS[0];
}

export function loadPreferredMotor(): MotorId {
  if (typeof window === 'undefined') return 'claude';
  try {
    const v = localStorage.getItem(STORAGE_KEY) || 'claude';
    if (MOTORS.some((m) => m.id === v)) return v as MotorId;
    if (v.includes('claude')) return 'claude';
    if (v.includes('xai') || v.includes('grok')) return 'xai';
  } catch {
    /* */
  }
  return 'claude';
}

export function savePreferredMotor(id: MotorId | string) {
  if (typeof window === 'undefined') return;
  const mid = MOTORS.some((m) => m.id === id) ? id : 'claude';
  localStorage.setItem(STORAGE_KEY, mid as string);
  window.dispatchEvent(new CustomEvent('lexis-motor-change', { detail: mid }));
}

export function loadBaClaudeDjenEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BA_CLAUDE_DJEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveBaClaudeDjenEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BA_CLAUDE_DJEN_KEY, on ? '1' : '0');
  window.dispatchEvent(new CustomEvent('lexis-ba-claude-djen', { detail: on }));
}

export function extractCnjFromText(text: string): string | null {
  const m = String(text || '').match(
    /\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/
  );
  if (!m) return null;
  const d = m[0].replace(/\D/g, '');
  return d.length === 20 ? d : null;
}
