/**
 * Wrapper Evolution API — envio de texto + sugestões de script.
 * Proxy opcional via env (cadeia no servidor, não no browser).
 *
 * Env:
 *  EVOLUTION_API_URL
 *  EVOLUTION_API_KEY
 *  EVOLUTION_INSTANCE
 *  EVOLUTION_PROXY_URL  (opcional: http://user:pass@host:port)
 */

export type EvolutionSendResult = {
  ok: boolean;
  raw?: any;
  error?: string;
};

function getConfig() {
  return {
    baseUrl: (process.env.EVOLUTION_API_URL || '').replace(/\/$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'default',
    proxyUrl: process.env.EVOLUTION_PROXY_URL || '',
  };
}

/** Normaliza telefone BR → E.164 sem + */
export function normalizeBrPhone(to: string): string {
  let digits = String(to || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

/**
 * Envia texto via Evolution API.
 * Não embute WhatsApp Web no browser (instável e viola ToS).
 * Use Evolution self-hosted + este wrapper.
 */
export async function sendTextMessage(to: string, message: string): Promise<any> {
  const { baseUrl, apiKey, instance } = getConfig();
  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY).');
  }

  const number = normalizeBrPhone(to);
  const text = String(message || '').trim();
  if (!number || number.length < 12) throw new Error('Telefone inválido.');
  if (!text) throw new Error('Mensagem vazia.');

  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;

  // Proxy chain: se EVOLUTION_PROXY_URL estiver setado e undici/proxy disponível,
  // o operador configura no ambiente de deploy (Vercel não suporta proxy SOCKS nativo fácil).
  // Aqui fazemos fetch direto; em VPS use HTTP_PROXY no processo Node.

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      number,
      text,
      options: { delay: 1200, presence: 'composing' },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Evolution HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

export async function sendTextMessageSafe(to: string, message: string): Promise<EvolutionSendResult> {
  try {
    const raw = await sendTextMessage(to, message);
    return { ok: true, raw };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha Evolution' };
  }
}
