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


export type EvolutionChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
  remoteJid?: string;
  pushName?: string;
  raw?: any;
};

/**
 * Busca mensagens antigas na Evolution (várias rotas — builds diferem).
 * Não garante 100% se a instância não persistiu histórico no Postgres da Evolution.
 */
export async function fetchChatMessagesFromEvolution(
  phone: string,
  limit = 80
): Promise<{ ok: boolean; messages: EvolutionChatMessage[]; error?: string; tried?: string[] }> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      messages: [],
      error: 'Evolution não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)',
    };
  }

  await wakeEvolutionInstance().catch(() => null);

  const number = normalizeBrPhone(phone);
  if (!number) return { ok: false, messages: [], error: 'Telefone inválido' };

  const jids = [
    `${number}@s.whatsapp.net`,
    number,
  ];
  // variantes sem 9
  if (number.startsWith('55') && number.length === 13) {
    const local = number.slice(2);
    if (local.length === 11 && local[2] === '9') {
      const alt = '55' + local.slice(0, 2) + local.slice(3);
      jids.push(`${alt}@s.whatsapp.net`, alt);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  const tried: string[] = [];
  const inst = encodeURIComponent(instance);

  async function tryPost(path: string, body: any) {
    const url = `${baseUrl}${path}`;
    tried.push(`POST ${path}`);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const text = await res.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  }

  async function tryGet(path: string) {
    const url = `${baseUrl}${path}`;
    tried.push(`GET ${path}`);
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(45000),
    });
    const text = await res.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  }

  function extractText(msg: any): string {
    if (!msg) return '';
    if (typeof msg === 'string') return msg;
    const m = msg.message || msg;
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.title ||
      msg.conversation ||
      msg.text ||
      msg.body ||
      ''
    );
  }

  function normalizeList(json: any): EvolutionChatMessage[] {
    if (!json) return [];
    let arr: any[] = [];
    if (Array.isArray(json)) arr = json;
    else if (Array.isArray(json.messages)) arr = json.messages;
    else if (Array.isArray(json.data)) arr = json.data;
    else if (Array.isArray(json.records)) arr = json.records;
    else if (json.messages?.records && Array.isArray(json.messages.records))
      arr = json.messages.records;
    else if (json.message && Array.isArray(json.message)) arr = json.message;

    const out: EvolutionChatMessage[] = [];
    for (const item of arr) {
      const key = item.key || item.Key || {};
      const text = extractText(item).trim();
      if (!text) continue;
      const tsRaw = item.messageTimestamp || item.message_timestamp || item.timestamp;
      let ts: string;
      if (typeof tsRaw === 'number') {
        ts = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000).toISOString();
      } else if (tsRaw) {
        ts = new Date(tsRaw).toISOString();
      } else {
        ts = new Date().toISOString();
      }
      out.push({
        id: String(key.id || item.id || `${ts}-${text.slice(0, 12)}`),
        fromMe: !!(key.fromMe ?? item.fromMe),
        text,
        timestamp: ts,
        remoteJid: key.remoteJid || item.remoteJid,
        pushName: item.pushName || item.pushname,
        raw: { id: key.id },
      });
    }
    // ordena por data
    out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return out.slice(-limit);
  }

  // Tentativas comuns Evolution API v1/v2
  for (const jid of jids) {
    const attempts: Array<() => Promise<{ ok: boolean; status: number; json: any }>> = [
      () =>
        tryPost(`/chat/findMessages/${inst}`, {
          where: { key: { remoteJid: jid } },
          page: 1,
          offset: limit,
        }),
      () =>
        tryPost(`/chat/findMessages/${inst}`, {
          where: { key: { remoteJid: jid.includes('@') ? jid : `${jid}@s.whatsapp.net` } },
        }),
      () =>
        tryPost(`/chat/findMessages/${inst}`, {
          remoteJid: jid.includes('@') ? jid : `${jid}@s.whatsapp.net`,
          limit,
        }),
      () =>
        tryPost(`/message/findMessages/${inst}`, {
          where: { key: { remoteJid: jid.includes('@') ? jid : `${jid}@s.whatsapp.net` } },
        }),
      () =>
        tryGet(
          `/chat/findMessages/${inst}?remoteJid=${encodeURIComponent(
            jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
          )}&limit=${limit}`
        ),
    ];

    for (const fn of attempts) {
      try {
        const r = await fn();
        if (!r.ok) continue;
        const msgs = normalizeList(r.json);
        if (msgs.length > 0) {
          return { ok: true, messages: msgs, tried };
        }
      } catch {
        /* next */
      }
    }
  }

  return {
    ok: false,
    messages: [],
    error:
      'Evolution não devolveu histórico para este número. A instância pode não guardar mensagens antigas, ou o chat nunca existiu nesta sessão WhatsApp.',
    tried,
  };
}
