/**
 * Catálogo de motores Lexis + preferências do browser.
 * UI principal: Omni (cascata) + Local.
 * IDs legados (claude, xai, nvidia…) continuam válidos e resolvem para Omni no runtime.
 */

import { extractCnjFromText as extractCnjFromTextImpl } from '@/lib/cnj-extract';

export type MotorId =
  | 'omni'
  | 'local_only'
  | 'claude'
  | 'xai'
  | 'groq-llama'
  | 'openrouter'
  | 'airforce'
  | 'gemini'
  | 'gpt4free'
  | 'puter'
  | 'nvidia';

export type MotorDef = {
  id: MotorId;
  label: string;
  short: string;
  desc: string;
  scope: 'server' | 'browser' | 'local';
  envKey?: string;
};

/** Preferência salva no localStorage */
const PREF_KEY = 'lexis_preferred_motor';
const BA_CLAUDE_DJEN_KEY = 'lexis_ba_claude_djen';

export const MOTORS: MotorDef[] = [
  {
    id: 'omni',
    label: 'Omni (cascata automática)',
    short: 'Omni',
    desc: 'Claude → Grok → Groq → NVIDIA → OpenRouter → Gemini → fallbacks. Token esgotado = próximo motor, sem erro na tela.',
    scope: 'server',
  },
  {
    id: 'local_only',
    label: 'Motor Lexis (scripts)',
    short: 'Local',
    desc: 'Scripts determinísticos — sem API.',
    scope: 'local',
  },
  // Legados (ainda listáveis em settings avançadas / compat)
  {
    id: 'claude',
    label: 'Claude (via Omni)',
    short: 'Claude',
    desc: 'Prioriza Anthropic; se falhar, cascata Omni.',
    scope: 'server',
    envKey: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'xai',
    label: 'xAI Grok (via Omni)',
    short: 'Grok',
    desc: 'Prioriza Grok; fallback Omni.',
    scope: 'server',
    envKey: 'XAI_GROK_PRESTIGE_API_KEY',
  },
  {
    id: 'groq-llama',
    label: 'Groq Llama (via Omni)',
    short: 'Groq',
    desc: 'Prioriza Groq; fallback Omni.',
    scope: 'server',
    envKey: 'GROQ_API_KEY',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM (via Omni)',
    short: 'NVIDIA',
    desc: 'Prioriza NVIDIA NIM; fallback Omni.',
    scope: 'server',
    envKey: 'NVIDIA_API_KEY',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (via Omni)',
    short: 'OR',
    desc: 'Prioriza OpenRouter; fallback Omni.',
    scope: 'server',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    id: 'gemini',
    label: 'Gemini (via Omni)',
    short: 'Gemini',
    desc: 'Prioriza Gemini; fallback Omni.',
    scope: 'server',
    envKey: 'GEMINI_API_KEY',
  },
  {
    id: 'gpt4free',
    label: 'GPT4Free',
    short: 'G4F',
    desc: 'Fallback OpenAI-compatível.',
    scope: 'server',
    envKey: 'GPT4FREE_BASE_URL',
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
    id: 'puter',
    label: 'Puter.js (User-Pays)',
    short: 'Puter',
    desc: 'Browser — usuário cobre o uso.',
    scope: 'browser',
  },
];

export function getMotor(id?: string | null): MotorDef {
  const mid = resolveMotorId(id);
  return MOTORS.find((m) => m.id === mid) || MOTORS[0];
}

/** Mapeia ids legados; local fica local; resto pode manter id para preferência de ordem na cascata */
export function resolveMotorId(id?: string | null): MotorId {
  const s = String(id || 'omni').toLowerCase().trim();
  if (s === 'local_only' || s === 'local' || s === 'lexis') return 'local_only';
  if (s === 'omni' || s === 'auto') return 'omni';
  const known = MOTORS.find((m) => m.id === s);
  if (known) return known.id;
  if (s.includes('claude') || s.includes('anthropic')) return 'claude';
  if (s.includes('xai') || s.includes('grok')) return 'xai';
  if (s.includes('groq')) return 'groq-llama';
  if (s.includes('nvidia') || s.includes('nim')) return 'nvidia';
  if (s.includes('openrouter')) return 'openrouter';
  if (s.includes('gemini')) return 'gemini';
  if (s.includes('puter')) return 'puter';
  if (s.includes('gpt4') || s.includes('g4f')) return 'gpt4free';
  return 'omni';
}

export function loadPreferredMotor(): MotorId {
  if (typeof window === 'undefined') return 'omni';
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return 'omni';
    return resolveMotorId(raw);
  } catch {
    return 'omni';
  }
}

export function savePreferredMotor(id: MotorId | string) {
  if (typeof window === 'undefined') return;
  try {
    const mid = resolveMotorId(id);
    localStorage.setItem(PREF_KEY, mid);
    window.dispatchEvent(new CustomEvent('lexis-motor-change', { detail: mid }));
  } catch {
    /* ignore */
  }
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
  try {
    localStorage.setItem(BA_CLAUDE_DJEN_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Reexport — usado por chat/BA/automação */
export function extractCnjFromText(text: string): string | null {
  try {
    return extractCnjFromTextImpl(text);
  } catch {
    // fallback mínimo
    const m = String(text || '').match(
      /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}|\d{20}/
    );
    return m ? m[0].replace(/\D/g, '') : null;
  }
}

/** Preferência de runtime para APIs: local_only ou omni (cascata) */
export function toRuntimePreferred(id?: string | null): string {
  const m = resolveMotorId(id);
  if (m === 'local_only') return 'local_only';
  if (m === 'omni') return 'omni';
  // legado: passa o id para a cascata priorizar esse motor primeiro
  return m;
}
