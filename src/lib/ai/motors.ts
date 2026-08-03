/**
 * Catálogo de motores neurais Lexis — Configurações, Chat, Sugerir Resposta.
 */

export type MotorId =
  | 'local_only'
  | 'xai'
  | 'groq-llama'
  | 'openrouter'
  | 'airforce'
  | 'puter';

export type MotorDef = {
  id: MotorId;
  label: string;
  short: string;
  desc: string;
  /** server usa env key; puter é só browser */
  scope: 'server' | 'browser' | 'local';
  envKey?: string;
};

export const MOTORS: MotorDef[] = [
  {
    id: 'local_only',
    label: 'Motor Lexis Soberano',
    short: 'Local',
    desc: 'Scripts determinísticos — sem API, sem custo, sempre disponível.',
    scope: 'local',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    short: 'xAI',
    desc: 'Raciocínio jurídico (XAI_API_KEY / XAI_MODEL).',
    scope: 'server',
    envKey: 'XAI_API_KEY',
  },
  {
    id: 'groq-llama',
    label: 'Groq Llama 3.3',
    short: 'Groq',
    desc: 'Resposta rápida (GROQ_API_KEY / GROQ_MODEL).',
    scope: 'server',
    envKey: 'GROQ_API_KEY',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (free/oss)',
    short: 'OR',
    desc: 'Gateway multi-modelo (OPENROUTER_API_KEY / OPENROUTER_MODEL).',
    scope: 'server',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    id: 'airforce',
    label: 'Airforce',
    short: 'AF',
    desc: 'Fallback alternativo (AIRFORCE_API_KEY).',
    scope: 'server',
    envKey: 'AIRFORCE_API_KEY',
  },
  {
    id: 'puter',
    label: 'Puter.js (User-Pays)',
    short: 'Puter',
    desc: 'Browser — usuário cobre o uso; sem key no servidor.',
    scope: 'browser',
  },
];

export const STORAGE_KEY = 'lexisPredict_preferred_ia';

export function getMotor(id: string): MotorDef {
  return MOTORS.find((m) => m.id === id) || MOTORS[0];
}

export function loadPreferredMotor(): MotorId {
  if (typeof window === 'undefined') return 'xai';
  try {
    const v = localStorage.getItem(STORAGE_KEY) || 'xai';
    if (MOTORS.some((m) => m.id === v)) return v as MotorId;
  } catch {
    /* */
  }
  return 'xai';
}

export function savePreferredMotor(id: MotorId | string) {
  if (typeof window === 'undefined') return;
  const mid = MOTORS.some((m) => m.id === id) ? id : 'xai';
  localStorage.setItem(STORAGE_KEY, mid);
  window.dispatchEvent(new CustomEvent('lexis-motor-change', { detail: mid }));
}

/** Extrai CNJ (NNN.NNN.N.NN.NNNN) ou dígitos de uma frase */
export function extractCnjFromText(text: string): string | null {
  const raw = String(text || '');
  const m = raw.match(/\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d[-.]?\d{2}[-.]?\d{4}/);
  if (m) return m[0].replace(/[^\d]/g, '').replace(/(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 20) {
    return digits.replace(/(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
  }
  return null;
}
