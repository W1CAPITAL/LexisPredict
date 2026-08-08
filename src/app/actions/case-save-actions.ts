'use server';

/**
 * Salvamento atômico de UM processo — evita upsert de 1000+ linhas (travamento na UI).
 */
import { getUserContext, getSupabaseAdmin, getProfileByAuthId } from '@/lib/server-db';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { createClient } from '@/lib/supabase/server';

function toRow(c: LegalCase, empresaId: string, authId: string | null) {
  const isoPrazo = formatDateToISO(c.proximoPrazo);
  const isoRetorno = formatDateToISO(c.ultimoRetorno);
  const now = new Date().toISOString();
  return {
    empresa_id: empresaId,
    created_by: c.created_by || authId,
    edited_by: authId,
    edited_at: now,
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
    dados: { ...c },
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
    
    // Obter nome do usuário para auditoria
    let editorName = 'Sistema';
    if (auth_id) {
      const profile = await getProfileByAuthId(auth_id);
      editorName = profile?.nome || editorName;
    }
    
    const now = new Date().toISOString();
    processed.edited_by = auth_id || null;
    processed.edited_at = now;
    processed.edited_by_name = editorName;

    const row = toRow(processed, empresa_id, auth_id || null);
    row.edited_by = auth_id;
    row.edited_at = now;

    // Prefer user client (RLS); fallback admin se necessário
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

    if (error) return { success: false, message: error.message };

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
