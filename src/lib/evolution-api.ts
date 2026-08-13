/**
 * Wrapper Evolution API v2 (Render / self-host).
 * Inclui wake-up + retry em HTTP 500/502/503 (Render cold start).
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

  const instance =
    firstEnv('EVOLUTION_INSTANCE', 'EVOLUTION_INSTANCE_NAME', 'EVOLUTION_INSTANCE_ID') ||
    'default';

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

/** Variantes comuns para match no banco (com/sem 55, com/sem 9º dígito). */
export function phoneMatchVariants(to: string): string[] {
  const n = normalizeBrPhone(to);
  const set = new Set<string>();
  if (!n) return [];
  set.add(n);
  if (n.startsWith('55') && n.length >= 12) {
    const local = n.slice(2);
    set.add(local);
    if (local.length === 11 && local[2] === '9') {
      set.add(local.slice(0, 2) + local.slice(3)); // sem 9
      set.add('55' + local.slice(0, 2) + local.slice(3));
    }
    if (local.length === 10) {
      set.add(local.slice(0, 2) + '9' + local.slice(2));
      set.add('55' + local.slice(0, 2) + '9' + local.slice(2));
    }
  }
  return [...set];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Acorda instância no Render (cold start): ping connectionState + restart leve.
 */
export async function wakeEvolutionInstance(): Promise<{ ok: boolean; detail?: string }> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  if (!baseUrl || !apiKey) return { ok: false, detail: 'não configurado' };

  const headers: Record<string, string> = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1) health / root
    await fetch(`${baseUrl}/`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);

    // 2) connection state
    const stateUrl = `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`;
    const st = await fetch(stateUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(20000),
    });
    const stBody = await st.text().catch(() => '');
    if (st.ok) {
      return { ok: true, detail: stBody.slice(0, 120) };
    }

    // 3) tenta restart (algumas builds)
    await fetch(`${baseUrl}/instance/restart/${encodeURIComponent(instance)}`, {
      method: 'PUT',
      headers,
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);

    await sleep(2500);
    return { ok: true, detail: `wake após HTTP ${st.status}` };
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'wake falhou' };
  }
}

async function postSendText(number: string, text: string): Promise<Response> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
  return fetch(url, {
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
    signal: AbortSignal.timeout(35000),
  });
}

export async function sendTextMessage(to: string, message: string): Promise<any> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();

  if (!baseUrl || !apiKey) {
    const missing: string[] = [];
    if (!baseUrl) missing.push('EVOLUTION_API_URL ou EVOLUTION_BASE_URL');
    if (!apiKey) missing.push('EVOLUTION_API_KEY');
    throw new Error(
      `Evolution API não configurada (faltam: ${missing.join(', ')}). ` +
        `No Vercel: URL do Render + KEY. Redeploy após salvar.`
    );
  }

  const number = normalizeBrPhone(to);
  const text = String(message || '').trim();
  if (!number || number.length < 12) throw new Error('Telefone inválido (use DDD + número).');
  if (!text) throw new Error('Mensagem vazia.');

  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      await wakeEvolutionInstance();
      await sleep(1500 * attempt);
    } else {
      // wake leve na 1ª tentativa (Render dorme)
      void wakeEvolutionInstance();
    }

    try {
      const res = await postSendText(number, text);
      if (res.ok) {
        return res.json().catch(() => ({ ok: true }));
      }
      const body = await res.text().catch(() => '');
      lastErr = `Evolution HTTP ${res.status}: ${body.slice(0, 220)}`;
      // Retry only on gateway/server errors
      if (![500, 502, 503, 504, 408].includes(res.status)) {
        const hint =
          res.status === 404
            ? ` Confira EVOLUTION_INSTANCE (nome no Manager). Atual: ${instance}`
            : res.status === 401 || res.status === 403
              ? ' Confira EVOLUTION_API_KEY.'
              : '';
        throw new Error(lastErr + hint);
      }
    } catch (e: any) {
      lastErr = e?.message || String(e);
      if (!/HTTP 50[0234]|timeout|fetch failed|ECONNRESET|network/i.test(lastErr) && attempt === 1) {
        // non-retryable already thrown above; network errors retry
        if (!/HTTP 50|timeout|fetch failed|ECONNRESET|network|Failed to fetch/i.test(lastErr)) {
          throw e;
        }
      }
    }
  }
  throw new Error(
    (lastErr || 'Falha Evolution') +
      ' — tentamos acordar a instância 3x. Abra o Manager Evolution e confira se o WhatsApp está conectado.'
  );
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
  const wake = await wakeEvolutionInstance();
  return {
    configured: true,
    baseUrl,
    instance,
    error: wake.ok ? undefined : wake.detail,
  };
}
