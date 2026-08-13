'use server';

/**
 * WhatsApp via Evolution API — envio + sugestão de script.
 * Não usa WhatsApp Web embutido no front (inseguro / instável).
 */

import { sendTextMessageSafe, normalizeBrPhone } from '@/lib/evolution-api';
import { getWhatsAppHistory } from '@/lib/server-db';
import { suggestScripts } from '@/lib/script-processual/suggest';

export async function sendWhatsAppAction(to: string, message: string) {
  const result = await sendTextMessageSafe(to, message);
  if (!result.ok) {
    return { success: false, message: result.error || 'Falha no envio' };
  }
  const phone = normalizeBrPhone(to);
  const ts = new Date().toISOString();
  // Grava OUTBOUND no Supabase (independente do webhook Evolution)
  try {
    const { persistWhatsAppMessage } = await import('@/lib/whatsapp-persist');
    const { getUserContext } = await import('@/lib/server-db');
    let empresaId: string | null = null;
    try {
      const ctx = await getUserContext();
      empresaId = ctx.empresa_id || null;
    } catch { /* */ }
    const saved = await persistWhatsAppMessage({
      contactNumber: phone,
      messageText: message,
      fromMe: true,
      source: 'lexis-send',
      timestamp: ts,
      empresaId,
      raw: result.raw,
    });
    return {
      success: true,
      data: result.raw,
      timestamp: ts,
      phone,
      persisted: saved.ok,
      persistError: saved.error || null,
    };
  } catch (e: any) {
    console.error('[whatsapp] falha ao persistir outbound', e);
    return {
      success: true,
      data: result.raw,
      timestamp: ts,
      phone,
      persisted: false,
      persistError: e?.message || 'Falha ao gravar no Supabase',
    };
  }
}

/**
 * Gera sugestões e opcionalmente envia a escolhida (índice 0–2).
 */
export async function sendSuggestedReplyAction(input: {
  to: string;
  clienteNome?: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  evento_tipo?: string | null;
  evento_resumo?: string | null;
  movimentos?: any[];
  djenTexts?: string[];
  tem_novo_andamento?: boolean;
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  /** Se informado, envia essa sugestão; senão só retorna lista */
  sendIndex?: number | null;
}) {
  const suggestions = suggestScripts({
    clienteNome: input.clienteNome,
    protocolo: input.protocolo,
    ultimoRetorno: input.ultimoRetorno,
    movimentos: input.movimentos,
    evento_tipo: input.evento_tipo,
    evento_resumo: input.evento_resumo,
    djenTexts: input.djenTexts,
    tem_novo_andamento: input.tem_novo_andamento,
    tem_atualizacao_pos_retorno: input.tem_atualizacao_pos_retorno,
    djen_nova_comunicacao: input.djen_nova_comunicacao,
    datajud_encerrado_tribunal: input.datajud_encerrado_tribunal,
    em_cumprimento_sentenca: input.em_cumprimento_sentenca,
  });

  if (input.sendIndex == null || input.sendIndex < 0) {
    return { success: true, suggestions, sent: false };
  }

  const pick = suggestions[input.sendIndex];
  if (!pick) {
    return { success: false, message: 'Índice de sugestão inválido', suggestions };
  }

  const send = await sendTextMessageSafe(input.to, pick.texto);
  if (!send.ok) {
    return { success: false, message: send.error, suggestions, sent: false };
  }

  return {
    success: true,
    suggestions,
    sent: true,
    sentText: pick.texto,
    titulo: pick.titulo,
    timestamp: new Date().toISOString(),
  };
}

export async function fetchWhatsAppHistoryAction(phone: string) {
  try {
    const messages = await getWhatsAppHistory(phone);
    return {
      success: true,
      messages: messages || [],
      count: (messages || []).length,
      phone: normalizeBrPhone(phone),
    };
  } catch (error: any) {
    return { success: false, error: error.message, messages: [], count: 0 };
  }
}

/** Diagnóstico: tabela existe? quantas msgs? service role ok? */
export async function diagnoseWhatsAppStorageAction(phone?: string) {
  const out: Record<string, any> = {
    serviceRole: false,
    tableOk: false,
    totalRows: null as number | null,
    forPhone: null as number | null,
    phoneNormalized: phone ? normalizeBrPhone(phone) : null,
    error: null as string | null,
    hint: '',
  };
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    out.serviceRole = Boolean(url && key);
    if (!out.serviceRole) {
      out.hint = 'Falta SUPABASE_SERVICE_ROLE_KEY na Vercel (não use só a chave anon).';
      return out;
    }
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url!, key!, { auth: { persistSession: false } });
    const { count, error } = await sb
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true });
    if (error) {
      out.error = error.message;
      if (/relation|does not exist|schema cache/i.test(error.message)) {
        out.hint =
          'Tabela whatsapp_messages NÃO existe no Supabase. Rode o SQL sql-whatsapp-messages.sql no SQL Editor.';
      } else {
        out.hint = 'Erro ao ler tabela: ' + error.message;
      }
      return out;
    }
    out.tableOk = true;
    out.totalRows = count ?? 0;
    if (phone) {
      const n = normalizeBrPhone(phone);
      const { data } = await sb
        .from('whatsapp_messages')
        .select('id')
        .or(`contact_number.eq.${n},phone.eq.${n},contact_number.ilike.%${n.slice(-8)}`)
        .limit(50);
      out.forPhone = data?.length ?? 0;
    }
    if (out.totalRows === 0) {
      out.hint =
        'Tabela existe mas está VAZIA. Envie 1 msg pelo Lexis (Enviar Evolution) ou confira se o webhook URL tem ?secret=...';
    } else if (phone && out.forPhone === 0) {
      out.hint =
        'Há mensagens no banco, mas nenhuma para este telefone. Confira o número no cadastro do cliente (DDD).';
    } else {
      out.hint = 'OK — deve aparecer no histórico ao reabrir o contato.';
    }
  } catch (e: any) {
    out.error = e?.message || String(e);
    out.hint = out.error;
  }
  return out;
}

/**
 * Rascunho WhatsApp com Claude AI (opt-in).
 */
export async function generateWhatsAppClaudeDraftAction(input: {
  clienteNome?: string;
  protocolo?: string;
  contexto?: string;
  evento_resumo?: string | null;
  useClaude?: boolean;
}) {
  if (input.useClaude === false) {
    return { success: false as const, error: 'Claude desativado' };
  }
  try {
    const { draftWhatsAppWithClaude } = await import('@/lib/ai/claude-surfaces');
    const blob = [
      `Cliente: ${input.clienteNome || '—'}`,
      `CNJ: ${input.protocolo || '—'}`,
      `Evento: ${input.evento_resumo || '—'}`,
      `Contexto: ${input.contexto || '—'}`,
      'Redija mensagem curta para WhatsApp.',
    ].join('\n');
    const r = await draftWhatsAppWithClaude(blob, true);
    if (!r) return { success: false as const, error: 'Sem resposta Claude' };
    console.info('[whatsapp-claude]', r.logLine);
    return {
      success: true as const,
      texto: r.text,
      engine: r.engineLabel,
      logLine: r.logLine,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha Claude' };
  }
}


/** Grava mensagem enviada via wa.me (sem Evolution) no Supabase. */
export async function logOutboundWhatsAppAction(to: string, message: string) {
  try {
    const { persistWhatsAppMessage } = await import('@/lib/whatsapp-persist');
    const { getUserContext } = await import('@/lib/server-db');
    let empresaId: string | null = null;
    try {
      const ctx = await getUserContext();
      empresaId = ctx.empresa_id || null;
    } catch { /* */ }
    const res = await persistWhatsAppMessage({
      contactNumber: normalizeBrPhone(to),
      messageText: message,
      fromMe: true,
      source: 'wa.me',
      empresaId,
    });
    return { success: res.ok, message: res.error };
  } catch (e: any) {
    return { success: false, message: e?.message };
  }
}


/** Insere mensagem de teste no Supabase e devolve o resultado (para depurar na UI). */
export async function testSaveWhatsAppMessageAction(phone: string) {
  const { persistWhatsAppMessage, fetchMessagesByPhone } = await import('@/lib/whatsapp-persist');
  const n = normalizeBrPhone(phone);
  if (!n) return { success: false, error: 'Telefone vazio no cadastro do cliente' };
  const saved = await persistWhatsAppMessage({
    contactNumber: n,
    messageText: `TESTE LEXIS ${new Date().toLocaleString('pt-BR')} — se você vê isto, o Supabase está gravando.`,
    fromMe: true,
    source: 'lexis-test-button',
  });
  if (!saved.ok) {
    return { success: false, error: saved.error, phone: n };
  }
  const { messages, error } = await fetchMessagesByPhone(n);
  return {
    success: true,
    phone: n,
    id: saved.id,
    count: messages.length,
    error: error || null,
    last: messages.slice(-3).map((m: any) => m.message_text || m.body),
  };
}


/**
 * Puxa mensagens antigas da Evolution e grava no Supabase (whatsapp_messages).
 * Só funciona se a Evolution ainda tiver o chat armazenado no banco dela.
 */
export async function importEvolutionHistoryAction(phone: string) {
  try {
    const { fetchChatMessagesFromEvolution } = await import('@/lib/evolution-api');
    const { persistWhatsAppMessage, fetchMessagesByPhone } = await import(
      '@/lib/whatsapp-persist'
    );
    const n = normalizeBrPhone(phone);
    if (!n) return { success: false, error: 'Telefone vazio', imported: 0, found: 0 };

    const ev = await fetchChatMessagesFromEvolution(n, 500, { timeoutMs: 45000 });
    if (!ev.ok || !ev.messages.length) {
      return {
        success: false,
        error: ev.error || 'Nenhuma mensagem na Evolution',
        imported: 0,
        found: 0,
        tried: ev.tried,
      };
    }

    const { jidMatchesPhone } = await import('@/lib/evolution-api');
    let imported = 0;
    let skippedWrong = 0;
    let skippedNoJid = 0;
    const errors: string[] = [];

    for (const m of ev.messages) {
      // OBRIGATÓRIO: remoteJid deste cliente — senão era outro chat colado neste número
      if (!m.remoteJid) {
        skippedNoJid += 1;
        continue;
      }
      if (!jidMatchesPhone(m.remoteJid, n)) {
        skippedWrong += 1;
        continue;
      }
      const saved = await persistWhatsAppMessage({
        contactNumber: n,
        messageText: m.text,
        fromMe: m.fromMe,
        messageId: m.id ? `evo-${n}-${m.id}` : undefined,
        contactName: m.pushName,
        remoteJid: m.remoteJid,
        source: 'evolution-import',
        timestamp: m.timestamp,
        raw: m.raw,
      });
      if (saved.ok) imported += 1;
      else if (saved.error) errors.push(saved.error);
    }

    const { messages } = await fetchMessagesByPhone(n);
    const dropped = skippedWrong + skippedNoJid;
    return {
      success: imported > 0,
      found: ev.messages.length,
      imported,
      skippedWrong,
      skippedNoJid,
      totalInDb: messages.length,
      phone: n,
      error:
        imported === 0
          ? errors[0] ||
            (dropped > 0
              ? `Nenhuma msg deste número (ignoradas ${dropped} de outros chats/sem JID).`
              : 'Nada gravado')
          : null,
      tried: ev.tried,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || String(e),
      imported: 0,
      found: 0,
    };
  }
}



/**
 * Importa histórico Evolution de TODOS os telefones da carteira.
 * Pula rápido quem não tem chat / sem mensagens (timeout curto) para não travar.
 */
export async function importEvolutionHistoryBulkAction(opts?: {
  maxContacts?: number;
  perContactTimeoutMs?: number;
}) {
  try {
    const { getUserContext, getStoredCasesForEmpresa } = await import('@/lib/server-db');
    const { normalizeBrPhone, fetchChatMessagesFromEvolution, jidMatchesPhone } = await import(
      '@/lib/evolution-api'
    );
    const { persistWhatsAppMessage } = await import('@/lib/whatsapp-persist');

    const ctx = await getUserContext();
    if (!ctx.empresa_id) {
      return { success: false, error: 'Sessão expirada', scanned: 0, imported: 0, skipped: 0 };
    }

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
    const maxContacts = Math.min(opts?.maxContacts ?? 80, 150);
    const perTimeout = Math.min(Math.max(opts?.perContactTimeoutMs ?? 10000, 4000), 25000);

    // Telefones únicos da carteira
    const phones: string[] = [];
    const seen = new Set<string>();
    for (const c of cases || []) {
      const raw =
        (c as any).telefone ||
        (c as any).phone ||
        (c as any).celular ||
        (c as any).whatsapp ||
        '';
      const n = normalizeBrPhone(String(raw));
      if (!n || n.length < 12) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      phones.push(n);
      if (phones.length >= maxContacts) break;
    }

    let scanned = 0;
    let imported = 0;
    let skipped = 0;
    let withMsgs = 0;
    const errors: string[] = [];

    for (const phone of phones) {
      scanned += 1;
      try {
        const ev = await fetchChatMessagesFromEvolution(phone, 300, {
          timeoutMs: perTimeout,
        });
        if (!ev.ok || !ev.messages?.length) {
          skipped += 1;
          continue;
        }
        withMsgs += 1;
        for (const m of ev.messages) {
          const jid = m.remoteJid || `${phone}@s.whatsapp.net`;
          if (!jidMatchesPhone(jid, phone) && m.remoteJid) {
            continue;
          }
          const saved = await persistWhatsAppMessage({
            contactNumber: phone,
            messageText: m.text,
            fromMe: m.fromMe,
            messageId: m.id ? `evo-bulk-${phone}-${m.id}` : undefined,
            contactName: m.pushName,
            remoteJid: jid,
            source: 'evolution-bulk',
            timestamp: m.timestamp,
            raw: m.raw,
          });
          if (saved.ok) imported += 1;
        }
      } catch (e: any) {
        skipped += 1;
        if (errors.length < 5) errors.push(`${phone}: ${e?.message || e}`);
      }
    }

    return {
      success: true,
      scanned,
      withMsgs,
      imported,
      skipped,
      message: `Varridos ${scanned} números · ${withMsgs} com chat · ${imported} msgs gravadas · ${skipped} ignorados (sem histórico/timeout)`,
      errors: errors.length ? errors : undefined,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || String(e),
      scanned: 0,
      imported: 0,
      skipped: 0,
    };
  }
}
