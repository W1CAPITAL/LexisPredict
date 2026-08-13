/**
 * Wrapper Evolution API v2 (Render / self-host).
 *
 * Vercel env (qualquer um dos aliases funciona):
 *   EVOLUTION_API_URL  | EVOLUTION_BASE_URL | EVOLUTION_URL
 *   EVOLUTION_API_KEY  | EVOLUTION_KEY | EVOLUTION_TOKEN
 *   EVOLUTION_INSTANCE | EVOLUTION_INSTANCE_NAME
 *
 * Exemplo Render:
 *   EVOLUTION_API_URL=https://evolution-api-0edm.onrender.com
 *   EVOLUTION_API_KEY=lexis2026
 *   EVOLUTION_INSTANCE=nome-da-instancia-no-manager
 */

export type EvolutionSendResult = {
  ok: boolean;
  raw?: any;
  error?: string;
};

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function getEvolutionConfig() {
  const baseUrl = firstEnv(
    'EVOLUTION_API_URL',
    'EVOLUTION_BASE_URL',
    'EVOLUTION_URL',
    'EVOLUTION_SERVER_URL'
  ).replace(/\/$/, '');

  const apiKey = firstEnv(
    'EVOLUTION_API_KEY',
    'EVOLUTION_KEY',
    'EVOLUTION_TOKEN',
    'AUTHENTICATION_API_KEY',
    'GLOBAL_API_KEY'
  );

  const instance = firstEnv(
    'EVOLUTION_INSTANCE',
    'EVOLUTION_INSTANCE_NAME',
    'EVOLUTION_INSTANCE_ID'
  ) || 'default';

  return { baseUrl, apiKey, instance };
}

export function isEvolutionConfigured(): boolean {
  const { baseUrl, apiKey } = getEvolutionConfig();
  return Boolean(baseUrl && apiKey);
}

/** Normaliza telefone BR → dígitos E.164 sem + */
export function normalizeBrPhone(to: string): string {
  let digits = String(to || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export async function sendTextMessage(to: string, message: string): Promise<any> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();

  if (!baseUrl || !apiKey) {
    const missing: string[] = [];
    if (!baseUrl) missing.push('EVOLUTION_API_URL ou EVOLUTION_BASE_URL');
    if (!apiKey) missing.push('EVOLUTION_API_KEY');
    throw new Error(
      `Evolution API não configurada (faltam: ${missing.join(', ')}). ` +
        `No Vercel: URL = https://evolution-api-0edm.onrender.com e KEY = a mesma do Render (API_KEY). Redeploy após salvar.`
    );
  }

  const number = normalizeBrPhone(to);
  const text = String(message || '').trim();
  if (!number || number.length < 12) throw new Error('Telefone inválido (use DDD + número).');
  if (!text) throw new Error('Mensagem vazia.');

  // Evolution v2: POST /message/sendText/{instance}
  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      number,
      text,
      options: { delay: 1200, presence: 'composing' },
    }),
    signal: AbortSignal.timeout(28000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Dica comum: instância errada ou desconectada
    const hint =
      res.status === 404
        ? ` Confira EVOLUTION_INSTANCE (nome exato no Manager: ${baseUrl}/manager).`
        : res.status === 401 || res.status === 403
          ? ' Confira EVOLUTION_API_KEY (mesmo valor de AUTHENTICATION_API_KEY / GLOBAL_API_KEY no Render).'
          : '';
    throw new Error(`Evolution HTTP ${res.status}: ${body.slice(0, 220)}${hint}`);
  }

  return res.json().catch(() => ({ ok: true }));
}

export async function sendTextMessageSafe(
  to: string,
  message: string
): Promise<EvolutionSendResult> {
  try {
    const raw = await sendTextMessage(to, message);
    return { ok: true, raw };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha Evolution' };
  }
}

export async function evolutionHealthCheck(): Promise<{
  configured: boolean;
  baseUrl: string | null;
  instance: string;
  error?: string;
}> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  if (!baseUrl || !apiKey) {
    return {
      configured: false,
      baseUrl: baseUrl || null,
      instance,
      error: !baseUrl
        ? 'Falta EVOLUTION_API_URL ou EVOLUTION_BASE_URL'
        : 'Falta EVOLUTION_API_KEY',
    };
  }
  return { configured: true, baseUrl, instance };
}
