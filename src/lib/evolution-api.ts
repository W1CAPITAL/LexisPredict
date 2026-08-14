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

/** Extrai só dígitos de um remoteJid (ignora @s.whatsapp.net / @g.us). */
export function digitsFromJid(jid: string | null | undefined): string {
  const s = String(jid || '');
  if (s.includes('@g.us')) return '';
  return s.split('@')[0].replace(/\D/g, '');
}

/** True se o JID é o mesmo telefone (com/sem 55, com/sem 9). */
export function jidMatchesPhone(jid: string | null | undefined, phone: string): boolean {
  const jd = digitsFromJid(jid);
  if (!jd || jd.length < 10) return false;
  const variants = phoneMatchVariants(phone);
  if (variants.some((v) => v === jd || jd.endsWith(v.slice(-10)) || jd.endsWith(v.slice(-11)) || v.endsWith(jd.slice(-10)))) {
    return true;
  }
  const n = normalizeBrPhone(phone);
  if (!n) return false;
  return jd.endsWith(n.slice(-10)) || jd.endsWith(n.slice(-11)) || n.endsWith(jd.slice(-10));
}



function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function evolutionHeaders(apiKey: string): Record<string, string> {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function parseConnectionOpen(body: string): boolean {
  try {
    const j = JSON.parse(body);
    const state =
      j?.instance?.state ||
      j?.state ||
      j?.status ||
      j?.data?.state ||
      j?.data?.status ||
      '';
    const s = String(state).toLowerCase();
    return s === 'open' || s === 'connected' || s === 'online';
  } catch {
    return /"state"\s*:\s*"open"/i.test(body) || /connected/i.test(body);
  }
}

/**
 * Acorda instância Evolution (Render cold start + sessão WA “dormindo”).
 * Só deve ser chamada no fluxo de ENVIO — não em consultas DataJud/DJEN.
 */
export async function wakeEvolutionInstance(): Promise<{ ok: boolean; detail?: string; open?: boolean }> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  if (!baseUrl || !apiKey) return { ok: false, detail: 'não configurado' };

  const headers = evolutionHeaders(apiKey);
  const inst = encodeURIComponent(instance);
  const details: string[] = [];

  try {
    // 1) connectionState PRIMEIRO (rápido se já open)
    const stateUrl = `${baseUrl}/instance/connectionState/${inst}`;
    let st: Response | null = null;
    try {
      st = await fetch(stateUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      st = null;
    }

    let stBody = st ? await st.text().catch(() => '') : '';
    let open = !!(st && st.ok && parseConnectionOpen(stBody));
    details.push(`state HTTP ${st?.status ?? 'fail'} open=${open}`);

    if (open) {
      return { ok: true, open: true, detail: details.join(' | ') };
    }

    // 2) ping root (Render cold start)
    await fetch(`${baseUrl}/`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);

    // 3) connect apenas — SEM restart (evita 401 logout)
    await fetch(`${baseUrl}/instance/connect/${inst}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);

    await sleep(2500);

    try {
      st = await fetch(stateUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      st = null;
    }
    stBody = st ? await st.text().catch(() => '') : '';
    open = !!(st && st.ok && parseConnectionOpen(stBody));
    details.push(`after-connect open=${open}`);

    // 4) presença “available” (várias rotas — builds Evolution diferem)
    const presenceBodies = [
      { presence: 'available' },
      { presence: 'available', number: '' },
    ];
    for (const path of [
      `/chat/sendPresence/${inst}`,
      `/message/presence/${inst}`,
    ]) {
      try {
        await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ presence: 'available' }),
          signal: AbortSignal.timeout(12000),
        });
        details.push(`presence ${path}`);
        break;
      } catch {
        /* tenta próxima rota */
      }
    }

    return { ok: true, open, detail: details.join(' | ').slice(0, 240) };
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'wake falhou' };
  }
}

/**
 * Wake direcionado ao envio: instancia + “abre” o chat do número (equivalente a clicar na conversa).
 * Chamar SEMPRE com await antes de sendText — só no envio.
 */
export async function wakeEvolutionForSend(
  numberE164: string
): Promise<{ ok: boolean; detail?: string; open?: boolean }> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  if (!baseUrl || !apiKey) return { ok: false, detail: 'não configurado', open: false };

  const headers = evolutionHeaders(apiKey);
  const inst = encodeURIComponent(instance);
  const number = String(numberE164 || '').replace(/\D/g, '');
  const baseWake = await wakeEvolutionInstance();
  const bits: string[] = [baseWake.detail || ''];

  if (!number || number.length < 12) {
    return { ok: baseWake.ok, detail: bits.join(' | '), open: baseWake.open };
  }

  try {
    // Confirma se o número existe no WA (força handshake Baileys)
    await fetch(`${baseUrl}/chat/whatsappNumbers/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ numbers: [number] }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);

    // Presença composing no destino (mesmo efeito de “abrir conversa”)
    for (const path of [`/chat/sendPresence/${inst}`, `/message/presence/${inst}`]) {
      try {
        const r = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number,
            presence: 'composing',
            delay: 1200,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (r.ok || r.status < 500) {
          bits.push(`chat-presence ${path} ${r.status}`);
          break;
        }
      } catch {
        /* next */
      }
    }

    // Algumas builds: markChatUnread / findMessages acordam o socket
    await fetch(`${baseUrl}/chat/findMessages/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ where: { key: { remoteJid: `${number}@s.whatsapp.net` } }, limit: 1 }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);

    await sleep(800);
    return {
      ok: true,
      open: baseWake.open !== false,
      detail: bits.filter(Boolean).join(' | ').slice(0, 280),
    };
  } catch (e: any) {
    return {
      ok: baseWake.ok,
      open: baseWake.open,
      detail: e?.message || bits.join(' | '),
    };
  }
}

async function postSendText(number: string, text: string, presenceDelayMs = 1200): Promise<Response> {
  const { baseUrl, apiKey, instance } = getEvolutionConfig();
  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
  const delay = Math.min(15000, Math.max(800, Math.floor(presenceDelayMs)));
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
      // presence composing + delay variável = padrão mais humano (anti-ban)
      options: { delay, presence: 'composing' },
    }),
    signal: AbortSignal.timeout(45000),
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

  // Anti-ban: teto diário, gap, typing humano, bloqueio de spam idêntico
  const { antibanPrecheck, antibanWait, antibanRecordSuccess, evolutionPresenceDelayMs } = await import(
    '@/lib/whatsapp-antiban'
  );
  const gate = antibanPrecheck(text);
  if (!gate.ok) throw new Error(gate.error);
  if (gate.waitMs > 0) await antibanWait(gate.waitMs);
  const presenceDelay = evolutionPresenceDelayMs(text);

  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    // SEMPRE aguarda wake antes de enviar (1ª e retries). Só neste fluxo de envio.
    const wake = await wakeEvolutionForSend(number);
    if (attempt > 1) await sleep(1200 * attempt);
    else if (!wake.open && attempt === 1) await sleep(1000);

    try {
      const res = await postSendText(number, text, presenceDelay);
      if (res.ok) {
        antibanRecordSuccess(text);
        return res.json().catch(() => ({ ok: true, wake: wake.detail }));
      }
      const body = await res.text().catch(() => '');
      lastErr = `Evolution HTTP ${res.status}: ${body.slice(0, 220)}`;

      // Sessão “dormindo” / socket fechado → force wake + retry
      const sleepLike =
        res.status === 400 ||
        res.status === 408 ||
        res.status === 500 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        /not connected|connection closed|closed|offline|timeout|ECONNRESET|session/i.test(body);

      if (!sleepLike && ![500, 502, 503, 504, 408].includes(res.status)) {
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
      const retryable = /HTTP 50|HTTP 400|HTTP 408|timeout|fetch failed|ECONNRESET|network|not connected|connection closed|Failed to fetch/i.test(
        lastErr
      );
      if (!retryable) throw e;
    }
  }
  throw new Error(
    (lastErr || 'Falha Evolution') +
      ' — acordamos a instância e tentamos 3x. Abra o Manager Evolution e confira se o WhatsApp está conectado (estado open).'
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
  limit = 500,
  opts?: { timeoutMs?: number }
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
  const timeoutMs = Math.min(Math.max(opts?.timeoutMs ?? 45000, 5000), 90000);

  // Todas as variantes de telefone → JID (com/sem 55, com/sem 9)
  const jids: string[] = [];
  for (const v of phoneMatchVariants(number)) {
    jids.push(`${v}@s.whatsapp.net`, v);
  }
  // dedupe
  const seenJid = new Set<string>();
  const uniqueJids = jids.filter((j) => {
    if (seenJid.has(j)) return false;
    seenJid.add(j);
    return true;
  });

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
      signal: AbortSignal.timeout(timeoutMs),
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
      signal: AbortSignal.timeout(timeoutMs),
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
  for (const jid of uniqueJids) {
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
        const msgsRaw = normalizeList(r.json);
        // Carimba JID consultado quando a API omite remoteJid (comum em findMessages)
        const stamped = msgsRaw.map((m) => {
          if (m.remoteJid) return m;
          const forced =
            jid.includes('@') ? jid : `${String(jid).replace(/\D/g, '')}@s.whatsapp.net`;
          return { ...m, remoteJid: forced };
        });
        // Só mantém mensagens deste telefone (nunca mistura outros chats)
        const msgs = stamped.filter((m) => jidMatchesPhone(m.remoteJid, number));
        const withJid = stamped.filter((m) => !!m.remoteJid).length;
        if (msgs.length > 0) {
          return { ok: true, messages: msgs, tried };
        }
        if (stamped.length > 0 && withJid > 0) {
          tried.push(`filtered-out:${stamped.length}->0 (jid≠${number})`);
          continue;
        }
        // Resposta sem JID e sem match — não assume que é deste número
        if (msgsRaw.length > 0 && withJid === 0) {
          tried.push(`no-jid-in-payload:${msgsRaw.length}`);
        }
      } catch {
        /* next */
      }
    }
  }

  // Última tentativa: listar chats e achar o JID deste telefone
  try {
    const chatAttempts = [
      () => tryPost(`/chat/findChats/${inst}`, {}),
      () => tryGet(`/chat/findChats/${inst}`),
      () => tryPost(`/chat/findChats/${inst}`, { where: {} }),
    ];
    let chatList: any[] = [];
    for (const fn of chatAttempts) {
      const r = await fn();
      if (!r.ok) continue;
      const raw = r.json;
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.chats)
          ? raw.chats
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.records)
              ? raw.records
              : [];
      if (arr.length) {
        chatList = arr;
        break;
      }
    }
    const matchChat = chatList.find((ch) => {
      const j =
        ch?.id ||
        ch?.remoteJid ||
        ch?.key?.remoteJid ||
        ch?.jid ||
        '';
      return jidMatchesPhone(String(j), number);
    });
    if (matchChat) {
      const jidFound = String(
        matchChat.id ||
          matchChat.remoteJid ||
          matchChat.key?.remoteJid ||
          matchChat.jid ||
          ''
      );
      tried.push(`findChats→${jidFound}`);
      if (jidFound && !uniqueJids.includes(jidFound)) {
        const r = await tryPost(`/chat/findMessages/${inst}`, {
          where: { key: { remoteJid: jidFound } },
          page: 1,
          offset: limit,
        });
        if (r.ok) {
          const msgsRaw = normalizeList(r.json).map((m) => ({
            ...m,
            remoteJid: m.remoteJid || jidFound,
          }));
          const msgs = msgsRaw.filter((m) => jidMatchesPhone(m.remoteJid, number));
          if (msgs.length > 0) {
            return { ok: true, messages: msgs, tried };
          }
        }
      }
    } else {
      tried.push(`findChats:0-match-of-${chatList.length}`);
    }
  } catch {
    tried.push('findChats:error');
  }

  return {
    ok: false,
    messages: [],
    error:
      'Evolution não devolveu histórico para este número. A instância pode não guardar mensagens antigas, ou o chat nunca existiu nesta sessão WhatsApp.',
    tried,
  };
}
