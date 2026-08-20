
'use server';

/**
 * Salvamento atômico de UM processo.
 * REGRA DE DONO: created_by só na criação. Update/atendimento/edição NUNCA rouba o caso.
 * Quem atende/edita vai em atendido_por / edited_by / auditado_por.
 */
import { getUserContext, getSupabaseAdmin, getProfileByAuthId } from '@/lib/server-db';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { createClient } from '@/lib/supabase/server';
import { hojeBrasilYmd, isAtendidoHoje, isAtendidoNestaSemana } from '@/lib/atendimento-semana';
import { patchAtendimentoComEdicao } from '@/lib/processos-auditados';

function toRow(
  c: LegalCase,
  empresaId: string,
  ownerAuthId: string | null
) {
  const isoPrazo = formatDateToISO(c.proximoPrazo);
  const isoRetorno = formatDateToISO(c.ultimoRetorno);
  const row: Record<string, any> = {
    empresa_id: empresaId,
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
    atendido_por: (c as any).atendido_por || null,
    dados: {
      ...c,
      ultimoRetorno: isoRetorno || c.ultimoRetorno,
      ultimo_retorno: isoRetorno || (c as any).ultimo_retorno,
      atendido_por: (c as any).atendido_por || null,
      // nunca espalhar created_by errado no JSON como se fosse dono novo
      created_by: ownerAuthId || (c as any).created_by || null,
    },
  };
  // Só define created_by na linha se temos owner (insert ou preserve)
  if (ownerAuthId) {
    row.created_by = ownerAuthId;
  }
  return row;
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

    let processed = processarCaso(caseData as any);

    // Último retorno hoje/semana = atendimento (Editar em Processos/Tarefas/Cases)
    const isoRet = formatDateToISO(
      processed.ultimoRetorno ||
        (caseData as any).ultimoRetorno ||
        (caseData as any).ultimo_retorno
    );
    if (isoRet) {
      processed.ultimoRetorno = isoRet;
      (processed as any).ultimo_retorno = isoRet;
    }

    let editorName = 'Sistema';
    if (auth_id) {
      const profile = await getProfileByAuthId(auth_id);
      editorName = profile?.nome || editorName;
    }

    const now = new Date().toISOString();
    processed.edited_by = auth_id || null;
    processed.edited_at = now;
    processed.edited_by_name = editorName;
    // Atendimento: payload ou último retorno hoje/nesta semana (conta KPI + fila)
    if ((caseData as any).atendido_por) {
      (processed as any).atendido_por = (caseData as any).atendido_por;
    }
    if (isoRet && auth_id && (isAtendidoHoje(isoRet) || isAtendidoNestaSemana(isoRet))) {
      const patch = patchAtendimentoComEdicao(auth_id, isoRet);
      Object.assign(processed, patch);
      (processed as any).atendido_por = (processed as any).atendido_por || auth_id;
      processed.ultimoRetorno = isoRet;
    }

    let client: any = null;
    try {
      client = await createClient();
    } catch {
      client = null;
    }
    if (!client) client = await getSupabaseAdmin();
    if (!client) return { success: false, message: 'Cliente Supabase indisponível.' };

    // PRESERVAR DONO por padrão; TRANSFERÊNCIA só se explícita + cargo autorizado
    const { data: existing } = await client
      .from('processos')
      .select('id, created_by')
      .eq('empresa_id', empresa_id)
      .eq('protocolo_ref', processed.protocolo)
      .maybeSingle();

    const profile = auth_id ? await getProfileByAuthId(auth_id) : null;
    const cargo = String(profile?.cargo || '').toLowerCase();
    const canTransfer =
      /supervisor|superadmin|super.?admin|administrador|admin|dono|owner/i.test(cargo) ||
      /admin|supervisor|super/i.test(String((profile as any)?.role || ''));

    const requestedOwner = String((caseData as any).created_by || (processed as any).created_by || '').trim();
    const forceTransfer = !!(caseData as any).force_transfer_owner || !!(caseData as any).__transfer_owner;

    let owner: string | null = null;
    if (existing?.created_by) {
      if (forceTransfer && canTransfer && requestedOwner && requestedOwner !== String(existing.created_by)) {
        owner = requestedOwner;
      } else {
        owner = existing.created_by;
      }
    } else if (requestedOwner) {
      owner = requestedOwner;
    } else {
      owner = auth_id || null;
    }
    (processed as any).created_by = owner;

    const row = toRow(processed, empresa_id, owner);
    const transferring =
      !!(existing?.created_by) &&
      forceTransfer &&
      canTransfer &&
      owner &&
      String(existing.created_by) !== String(owner);

    if (existing?.id) {
      // UPDATE: não mexe em created_by EXCETO transferência explícita autorizada
      const { created_by: _drop, ...updateRow } = row;
      if (!transferring) {
        delete (updateRow as any).created_by;
      } else {
        (updateRow as any).created_by = owner;
      }
      if (updateRow.dados && typeof updateRow.dados === 'object') {
        updateRow.dados = { ...updateRow.dados, created_by: owner };
      }
      // Transferência: OBRIGA service role (RLS do user muitas vezes bloqueia created_by)
      let writer = client;
      if (transferring) {
        const admin = await getSupabaseAdmin();
        if (!admin) {
          return {
            success: false,
            message:
              'SUPABASE_SERVICE_ROLE_KEY ausente no Vercel. Sem service role não dá para transferir created_by (RLS). Configure a env e faça redeploy.',
          };
        }
        writer = admin;
      }
      const { error } = await writer.from('processos').update(updateRow).eq('id', existing.id);
      if (error) {
        const msg = String(error.message || '');
        if (/edited_at|edited_by|schema cache/i.test(msg)) {
          const { error: err2 } = await client
            .from('processos')
            .update({
              ultimo_retorno: formatDateToISO(processed.ultimoRetorno),
              tem_atualizacao_pos_retorno: false,
              djen_nova_comunicacao: false,
              dados: { ...processed, created_by: owner },
            })
            .eq('id', existing.id);
          if (err2) return { success: false, message: err2.message };
          return { success: true, message: 'Salvo.', case: processed };
        }
        return { success: false, message: error.message };
      }
      if (isoRet && isAtendidoHoje(isoRet)) {
        try {
          const { registrarAtendimentoAction } = await import('@/app/actions/case-actions');
          await registrarAtendimentoAction([processed.protocolo], {
            via: 'saveOneCase',
            ultimoRetorno: isoRet,
            atendido_por: auth_id,
          });
        } catch { /* não bloqueia save */ }
      }
      return { success: true, message: 'Salvo.', case: processed };
    }

    // INSERT
    const { error } = await client.from('processos').insert(row);
    if (error) {
      // race: outro insert — tenta update preservando dono
      if (/duplicate|unique/i.test(String(error.message || ''))) {
        const { data: again } = await client
          .from('processos')
          .select('id, created_by')
          .eq('empresa_id', empresa_id)
          .eq('protocolo_ref', processed.protocolo)
          .maybeSingle();
        if (again?.id) {
          const keep = again.created_by || owner;
          const { created_by: _d, ...updateRow } = row;
          delete (updateRow as any).created_by;
          const { error: errU } = await client.from('processos').update(updateRow).eq('id', again.id);
          if (errU) return { success: false, message: errU.message };
          (processed as any).created_by = keep;
          return { success: true, message: 'Salvo.', case: processed };
        }
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
    const client = (await getSupabaseAdmin()) || (await createClient().catch(() => null));
    if (!client) return { success: false, message: 'Cliente indisponível.' };
    const { error } = await client
      .from('processos')
      .delete()
      .eq('empresa_id', empresa_id)
      .eq('protocolo_ref', protocolo);
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Removido.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao excluir.' };
  }
}


/**
 * Transferência de carteira em massa (created_by).
 * Só Supervisor / Superadmin / Administrador.
 * Se existir trigger prevent_created_by_steal no Postgres, desative-o só para este UPDATE ou use função SECURITY DEFINER no SQL.
 */
export async function transferCasesOwnerAction(input: {
  protocolos: string[];
  novoOwnerAuthId: string;
}): Promise<{ success: boolean; updated: number; message: string; error?: string }> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
      return { success: false, updated: 0, message: 'Sessão expirada.' };
    }
    const profile = await getProfileByAuthId(auth_id);
    const cargo = String(profile?.cargo || '').toLowerCase();
    const can =
      /supervisor|superadmin|super admin|administrador|admin/i.test(cargo);
    if (!can) {
      return { success: false, updated: 0, message: 'Sem permissão para transferir carteira.' };
    }
    const novo = String(input.novoOwnerAuthId || '').trim();
    if (!novo) return { success: false, updated: 0, message: 'Selecione o novo responsável.' };
    const protos = (input.protocolos || [])
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    if (!protos.length) return { success: false, updated: 0, message: 'Nenhum processo selecionado.' };

    const admin = await getSupabaseAdmin();
    if (!admin) {
      return {
        success: false,
        updated: 0,
        message:
          'SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel. A transferência exige service role (bypassa RLS).',
      };
    }

    let updated = 0;
    const errors: string[] = [];
    const chunk = 80;
    for (let i = 0; i < protos.length; i += chunk) {
      const slice = protos.slice(i, i + chunk);
      // Match por protocolo_ref exato OU só dígitos via filtro em memória
      const { data: rows, error: qErr } = await admin
        .from('processos')
        .select('id, protocolo_ref, created_by, dados')
        .eq('empresa_id', empresa_id)
        .in('protocolo_ref', slice);
      if (qErr) errors.push(qErr.message);
      const found = rows || [];
      // fallback: se .in não achou (formatação CNJ), busca mais larga
      if (found.length < slice.length) {
        const { data: allEmp } = await admin
          .from('processos')
          .select('id, protocolo_ref, created_by, dados')
          .eq('empresa_id', empresa_id)
          .limit(5000);
        const want = new Set(slice.map((p) => p.replace(/\D/g, '')));
        for (const r of allEmp || []) {
          const dig = String(r.protocolo_ref || '').replace(/\D/g, '');
          if (want.has(dig) && !found.some((f) => f.id === r.id)) found.push(r);
        }
      }
      for (const r of found) {
        const dados =
          typeof r.dados === 'object' && r.dados
            ? { ...(r.dados as object), created_by: novo }
            : { created_by: novo };
        const { error, count } = await admin
          .from('processos')
          .update({ created_by: novo, dados })
          .eq('id', r.id)
          .select('id');
        if (error) errors.push(`${r.protocolo_ref}: ${error.message}`);
        else updated += 1;
      }
    }
    return {
      success: updated > 0,
      updated,
      message:
        updated > 0
          ? `${updated} processo(s) transferido(s) com sucesso.`
          : `Nenhuma linha atualizada. ${errors[0] || 'Confira SERVICE_ROLE e se o trigger prevent_created_by_steal foi removido.'}`,
      error: errors[0],
    };
  } catch (e: any) {
    return { success: false, updated: 0, message: e?.message || 'Falha', error: e?.message };
  }
}

/**
 * Troca o dono (created_by) de UM processo — uso direto na UI de edição.
 * Supervisor / Superadmin / Administrador. Usa service role.
 */
export async function reassignCaseOwnerAction(input: {
  protocolo: string;
  novoOwnerAuthId: string;
}): Promise<{ success: boolean; message: string; created_by?: string }> {
  try {
    const { empresa_id, auth_id, isSuperAdmin, isSupervisor } = await getUserContext();
    if (!empresa_id || !auth_id) {
      return { success: false, message: 'Sessão expirada.' };
    }
    const profile = await getProfileByAuthId(auth_id);
    const cargo = String(profile?.cargo || '').toLowerCase();
    const role = String((profile as any)?.role || '').toLowerCase();
    const can =
      !!isSuperAdmin ||
      !!isSupervisor ||
      /supervisor|superadmin|super.?admin|administrador|admin/i.test(cargo) ||
      /supervisor|superadmin|admin/i.test(role);
    if (!can) {
      return { success: false, message: 'Sem permissão. Só Supervisor, Administrador ou Superadmin alteram o dono.' };
    }
    const novo = String(input.novoOwnerAuthId || '').trim();
    if (!novo) return { success: false, message: 'Selecione o novo responsável.' };
    const proto = String(input.protocolo || '').trim();
    if (!proto) return { success: false, message: 'Protocolo inválido.' };
    const digits = proto.replace(/\D/g, '');

    const admin = await getSupabaseAdmin();
    if (!admin) {
      return {
        success: false,
        message:
          'SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel. Sem isso a troca de created_by é bloqueada pelo RLS.',
      };
    }

    let { data: row } = await admin
      .from('processos')
      .select('id, protocolo_ref, created_by, dados')
      .eq('empresa_id', empresa_id)
      .eq('protocolo_ref', proto)
      .maybeSingle();

    if (!row && digits) {
      const { data: list } = await admin
        .from('processos')
        .select('id, protocolo_ref, created_by, dados')
        .eq('empresa_id', empresa_id)
        .limit(8000);
      row =
        (list || []).find(
          (r: any) => String(r.protocolo_ref || '').replace(/\D/g, '') === digits
        ) || null;
    }
    if (!row) return { success: false, message: 'Processo não encontrado.' };

    const dados =
      typeof row.dados === 'object' && row.dados
        ? { ...(row.dados as object), created_by: novo }
        : { created_by: novo };

    const { error } = await admin
      .from('processos')
      .update({ created_by: novo, dados })
      .eq('id', row.id)
      .eq('empresa_id', empresa_id);

    if (error) {
      return {
        success: false,
        message: `${error.message} — se houver trigger prevent_created_by_steal, remova-o no SQL Editor.`,
      };
    }
    return {
      success: true,
      message: 'Dono (created_by) atualizado.',
      created_by: novo,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao reatribuir.' };
  }
}
