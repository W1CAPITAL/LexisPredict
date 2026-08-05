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
  return {
    success: true,
    data: result.raw,
    timestamp: new Date().toISOString(),
    phone: normalizeBrPhone(to),
  };
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
    return { success: true, messages };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
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
