'use server';

/**
 * Salvamento atômico de UM processo — evita upsert de 1000+ linhas (travamento na UI).
 * Colunas de auditoria (edited_at / edited_by) ficam dentro de `dados` quando
 * a tabela `processos` não tem essas colunas no schema.
 */
import { getUserContext, getSupabaseAdmin, getProfileByAuthId } from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { enqueueSheetMnPush, flushSheetMnPush } from '@/lib/sheet-mn-push';

/** Monta a linha para upsert — só campos que existem (ou são JSON em dados). */
function toRow(c: LegalCase, empresaId: string, authId: string | null) {
  const isoPrazo = formatDateToISO(c.proximoPrazo);
  const isoRetorno = formatDateToISO(c.ultimoRetorno);
  return {
    empresa_id: empresaId,
    created_by: c.created_by || null, // NUNCA cair no auth de quem atende
    protocolo_ref: c.protocolo,
    advogado: c.advogado || 'NÃO ATRIBUÍDO',
    escritorio: c.escritorio || null,
    status: c.status || 'Sem Prazo',
    risco: c.risco || 'Normal',
    proximo_retorno: isoPrazo,
    ultimo_retorno: isoRetorno,
    tribunal: c.tribunal || 'Outros',
    telefone: c.telefone || '',
    observacoes: c.observacao || '',
    datajud_ultimo_movimento: c.datajud_ultimo_movimento,
    datajud_ultimo_nome: c.datajud_ultimo_nome,
    datajud_consultado_em: c.datajud_consultado_em,
    tem_atualizacao_pos_retorno: !!c.tem_atualizacao_pos_retorno,
    datajud_encerrado_tribunal: !!c.datajud_encerrado_tribunal,
    datajud_encerrado_motivo: c.datajud_encerrado_motivo,
    datajud_hash: c.datajud_hash || null,
    indicio_busca_apreensao: !!c.indicio_busca_apreensao,
    busca_apreensao_confianca: c.busca_apreensao_confianca,
    busca_apreensao_motivo: c.busca_apreensao_motivo,
    busca_apreensao_consultado_em: c.busca_apreensao_consultado_em,
    em_cumprimento_sentenca: !!c.em_cumprimento_sentenca,
    cumprimento_sentenca_motivo: c.cumprimento_sentenca_motivo,
    cumprimento_sentenca_consultado_em: c.cumprimento_sentenca_consultado_em,
    djen_nova_comunicacao: !!c.djen_nova_comunicacao,
    djen_ultimo_resumo: c.djen_ultimo_resumo,
    djen_ultimo_link: c.djen_ultimo_link,
    djen_ultima_data: c.djen_ultima_data,
    // Auditoria e espelho completo no JSON — evita erro de schema cache
    dados: {
      ...c,
      ultimoRetorno: isoRetorno || c.ultimoRetorno,
      ultimo_retorno: isoRetorno || (c as any).ultimo_retorno,
    },
  };
}

export async function saveOneCaseAction(caseData: LegalCase): Promise<{
  success: boolean;
  message: string;
  case?: LegalCase;
}> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id) return { success: false, message: 'Sessão expirada.' };
    if (!caseData?.protocolo) return { success: false, message: 'Protocolo obrigatório.' };

    const processed = processarCaso(caseData as any);

    let existingOwner: string | null = null;
    let existingRow: any = null;
    {
      let lookup: any = null;
      try {
        lookup = await createClient();
      } catch {
        lookup = await getSupabaseAdmin();
      }
      if (lookup) {
        const { data } = await lookup
          .from('processos')
          .select('created_by, dados, ultimo_retorno, protocolo_ref')
          .eq('empresa_id', empresa_id)
          .eq('protocolo_ref', processed.protocolo)
          .maybeSingle();
        existingRow = data;
        existingOwner = data?.created_by || data?.dados?.created_by || null;
        if (!existingOwner) {
          const dig = String(processed.protocolo || '').replace(/\D/g, '');
          if (dig.length >= 15) {
            const { data: more } = await lookup
              .from('processos')
              .select('created_by, dados, ultimo_retorno, protocolo_ref')
              .eq('empresa_id', empresa_id)
              .limit(8000);
            const hit = (more || []).find((r: any) => {
              const ref = String(r.protocolo_ref || r.dados?.protocolo || '').replace(/\D/g, '');
              return ref === dig || (ref.length >= 15 && (ref.endsWith(dig) || dig.endsWith(ref)));
            });
            if (hit) {
              existingRow = hit;
              existingOwner = hit.created_by || hit.dados?.created_by || null;
            }
          }
        }
      }
    }

    // REGRA: atendimento/edição NÃO rouba carteira.
    // created_by só muda com force_transfer_owner (ReassignOwnerControl).
    const forceTransfer = !!(caseData as any).force_transfer_owner || !!(caseData as any).__transfer_owner;
    if (!forceTransfer && existingOwner) {
      processed.created_by = existingOwner;
    } else if (!forceTransfer) {
      processed.created_by = existingOwner || processed.created_by || null;
    }
    // se forceTransfer, processed.created_by já veio do payload

    const prevRetorno = String(existingRow?.ultimo_retorno || existingRow?.dados?.ultimoRetorno || '');
    const nextRetorno = String(processed.ultimoRetorno || '');
    if (auth_id && nextRetorno && nextRetorno !== prevRetorno) {
      processed.atendido_por = auth_id;
      processed.atendido_em = new Date().toISOString();
    }

    let editorName = 'Sistema';
    if (auth_id) {
      const profile = await getProfileByAuthId(auth_id);
      editorName = profile?.nome || editorName;
    }

    const now = new Date().toISOString();
    // Metadados de auditoria só no objeto / dados — NÃO como coluna obrigatória
    processed.edited_by = auth_id || null;
    processed.edited_at = now;
    processed.edited_by_name = editorName;

    const row = toRow(processed, empresa_id, auth_id || null);

    let client: any = null;
    try {
      client = await createClient();
    } catch {
      client = null;
    }
    if (!client) client = await getSupabaseAdmin();
    if (!client) return { success: false, message: 'Cliente Supabase indisponível.' };

    const { error } = await client
      .from('processos')
      .upsert(row, { onConflict: 'protocolo_ref,empresa_id' });

    if (error) {
      // Fallback: se ainda houver coluna fantasma no payload antigo, tenta update mínimo
      const msg = String(error.message || '');
      if (/edited_at|edited_by|schema cache/i.test(msg)) {
        const { error: err2 } = await client
          .from('processos')
          .upsert(
            {
              empresa_id,
              protocolo_ref: processed.protocolo,
              ultimo_retorno: formatDateToISO(processed.ultimoRetorno),
              tem_atualizacao_pos_retorno: false,
              djen_nova_comunicacao: false,
              dados: { ...processed },
            },
            { onConflict: 'protocolo_ref,empresa_id' }
          );
        if (err2) return { success: false, message: err2.message };
        enqueueSheetMnPush({
          protocolo: processed.protocolo,
          ultimoRetorno: formatDateToISO(processed.ultimoRetorno),
          proximoPrazo: formatDateToISO(processed.proximoPrazo),
          empresa_id,
          via: 'save-fallback',
        });
        void flushSheetMnPush();
        return { success: true, message: 'Salvo.', case: processed };
      }
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Salvo.', case: processed };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao salvar.' };
  }
}

export async function deleteOneCaseAction(protocolo: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, message: 'Sessão expirada.' };
    if (!protocolo) return { success: false, message: 'Protocolo obrigatório.' };

    let client: any = null;
    try {
      client = await createClient();
    } catch {
      client = null;
    }
    if (!client) client = await getSupabaseAdmin();
    if (!client) return { success: false, message: 'Cliente Supabase indisponível.' };

    const { error } = await client
      .from('processos')
      .delete()
      .eq('empresa_id', empresa_id)
      .eq('protocolo_ref', protocolo);

    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Removido.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao remover.' };
  }
}

/** Garante auditado_em/por e log de edição (chamado pelas UIs). */
export async function stampAndLogEdicaoAction(
  protocolo: string,
  extra: Record<string, any> = {}
): Promise<{ success: boolean }> {
  try {
    const { getUserContext, logAuditoriaSistema, getSupabaseAdmin } = await import('@/lib/server-db');
    const { hojeBrasilYmd } = await import('@/lib/atendimento-semana');
    const ctx = await getUserContext();
    if (!ctx.empresa_id || !protocolo) return { success: false };
    const hoje = hojeBrasilYmd();
    const admin = await getSupabaseAdmin();
    const dig = String(protocolo).replace(/\D/g, '');
    const { data: row } = await admin
      .from('processos')
      .select('id, dados, protocolo_ref')
      .eq('empresa_id', ctx.empresa_id)
      .eq('protocolo_ref', protocolo)
      .maybeSingle();
    if (!row) {
      // tenta match por dígitos via dados — skip
      await logAuditoriaSistema({
        empresaId: ctx.empresa_id,
        authUserId: ctx.auth_id,
        acao: 'edicao',
        protocolo,
        detalhes: { ...extra, auditado_em: hoje, via: 'stampAndLogEdicaoAction' },
      });
      return { success: true };
    }
    const dados = { ...(row.dados as any), auditado_em: hoje, auditado_por: ctx.auth_id, ...extra };
    await admin.from('processos').update({
      dados,
      // colunas opcionais se existirem
      ...( { auditado_em: hoje, auditado_por: ctx.auth_id } as any),
    }).eq('id', row.id);
    await logAuditoriaSistema({
      empresaId: ctx.empresa_id,
      authUserId: ctx.auth_id,
      acao: 'edicao',
      protocolo: row.protocolo_ref || protocolo,
      detalhes: { auditado_em: hoje, via: 'stampAndLogEdicaoAction', ...extra },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}


export async function saveManyCasesAction(
  cases: LegalCase[]
): Promise<{ success: boolean; saved: number; failed: number; message?: string; error?: string }> {
  const list = Array.isArray(cases) ? cases.filter((c) => c && c.protocolo) : [];
  if (!list.length) return { success: false, saved: 0, failed: 0, message: 'Nenhum processo para salvar.' };
  let saved = 0;
  const errors: string[] = [];
  for (const c of list.slice(0, 40)) {
    const res = await saveOneCaseAction(c);
    if (res.success) saved += 1;
    else errors.push(`${c.protocolo}: ${res.message}`);
  }
  return {
    success: saved > 0,
    saved,
    failed: list.length - saved,
    message: saved ? `${saved} salvo(s)` : errors[0] || 'Falha ao salvar',
    error: errors[0],
  };
}

/** Transfere o dono (created_by) de um processo — service role. */
export async function reassignCaseOwnerAction(input: {
  protocolo: string;
  novoOwnerAuthId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, message: "Sessão expirada." };
    const protocolo = String(input.protocolo || "").trim();
    const novo = String(input.novoOwnerAuthId || "").trim();
    if (!protocolo || !novo) return { success: false, message: "Protocolo e novo responsável obrigatórios." };

    const admin = await getSupabaseAdmin();
    const dig = protocolo.replace(/\D/g, "");

    const { data: rows } = await admin
      .from("processos")
      .select("id, protocolo_ref, dados, created_by")
      .eq("empresa_id", empresa_id)
      .limit(8000);

    const hit = (rows || []).find((r: any) => {
      const ref = String(r.protocolo_ref || r.dados?.protocolo || "").replace(/\D/g, "");
      return (
        ref === dig ||
        String(r.protocolo_ref) === protocolo ||
        (ref.length >= 15 && dig.length >= 15 && (ref.endsWith(dig) || dig.endsWith(ref)))
      );
    });
    if (!hit) return { success: false, message: "Processo não encontrado." };

    const dados = { ...(hit.dados || {}), created_by: novo };
    const { error } = await admin
      .from("processos")
      .update({ created_by: novo, dados })
      .eq("id", hit.id)
      .eq("empresa_id", empresa_id);

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Responsável atualizado." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Falha ao transferir." };
  }
}

/** Transferência em massa de created_by. */
export async function transferCasesOwnerAction(input: {
  protocolos: string[];
  novoOwnerAuthId: string;
}): Promise<{ success: boolean; updated: number; message: string }> {
  const list = Array.isArray(input.protocolos) ? input.protocolos.map(String).filter(Boolean) : [];
  const novo = String(input.novoOwnerAuthId || "").trim();
  if (!list.length || !novo) return { success: false, updated: 0, message: "Lista ou responsável vazio." };

  let updated = 0;
  const errors: string[] = [];
  for (const p of list.slice(0, 200)) {
    const r = await reassignCaseOwnerAction({ protocolo: p, novoOwnerAuthId: novo });
    if (r.success) updated += 1;
    else errors.push(`${p}: ${r.message}`);
  }
  return {
    success: updated > 0,
    updated,
    message: updated
      ? `${updated} processo(s) transferido(s)`
      : errors[0] || "Nenhum atualizado",
  };
}
