'use server';

import { canSupervisaoCarteira, SUPERVISAO_REQUIRED } from '@/lib/auth-supervisao';
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { hybridEnabled } from '@/lib/hybrid/policy';
import { sheetsServerPost, sheetsWebhookConfigured } from '@/lib/hybrid/sheets-server';

function iso(v: unknown): string | null {
  return formatDateToISO(v as any) || (v ? String(v) : null);
}

function hasValue(v: unknown): boolean {
  return v !== undefined && v !== null && String(v) !== '';
}

function overlayDefined(base: Record<string, any>, patch: Record<string, any>) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (hasValue(value)) out[key] = value;
  }
  return out;
}

function buildSheetRow(
  processed: any,
  empresaId: string,
  actorId: string | null,
  actorName: string,
  existing: Record<string, any> | null = null,
) {
  const now = new Date().toISOString();
  const previous = existing || {};
  const previousDados = previous.dados && typeof previous.dados === 'object' ? previous.dados : {};
  const mergedDados = overlayDefined(previousDados, processed);
  const merged = overlayDefined(previous, processed);

  const ultimoRetorno = iso(processed.ultimoRetorno ?? processed.ultimo_retorno ?? processed.ULTIMO_RETORNO)
    || iso(previous.UltimoRetorno ?? previous.ultimo_retorno ?? previousDados.ultimoRetorno ?? previousDados.ultimo_retorno);
  const proximoRetorno = iso(processed.proximoPrazo ?? processed.proximo_retorno ?? processed.proximoRetorno)
    || iso(previous.ProximoRetorno ?? previous.proximo_retorno ?? previousDados.proximoRetorno ?? previousDados.proximo_retorno);

  const row: Record<string, any> = { ...merged };
  row.Protocolo = processed.protocolo || previous.Protocolo || previous.protocolo || '';
  row.protocolo = row.Protocolo;
  row.empresa_id = empresaId;
  row.EmpresaId = previous.EmpresaId || previous.empresa_id || empresaId;
  row.created_by = processed.created_by || previous.created_by || previous.CreatedBy || previousDados.created_by || null;
  row.CreatedBy = row.created_by;

  const values: Record<string, any> = {
    Cliente: processed.cliente || previous.Cliente || previous.cliente || previousDados.cliente || previousDados.CLIENTE,
    cliente: processed.cliente || previous.cliente || previous.Cliente || previousDados.cliente || previousDados.CLIENTE,
    cpf: processed.cpf || previous.cpf || previous.CPF || previousDados.cpf || previousDados.CPF,
    Telefone: processed.telefone || previous.Telefone || previous.telefone || previousDados.telefone || previousDados.TELEFONE,
    telefone: processed.telefone || previous.telefone || previous.Telefone || previousDados.telefone || previousDados.TELEFONE,
    Advogado: processed.advogado || previous.Advogado || previous.advogado || previousDados.advogado || previousDados.ADVOGADO,
    advogado: processed.advogado || previous.advogado || previous.Advogado || previousDados.advogado || previousDados.ADVOGADO,
    Escritorio: processed.escritorio || previous.Escritorio || previous.escritorio || previousDados.escritorio || previousDados.ESCRITORIO,
    escritorio: processed.escritorio || previous.escritorio || previous.Escritorio || previousDados.escritorio || previousDados.ESCRITORIO,
    Tribunal: processed.tribunal || previous.Tribunal || previous.tribunal || previousDados.tribunal || previousDados.TRIBUNAL,
    tribunal: processed.tribunal || previous.tribunal || previous.Tribunal || previousDados.tribunal || previousDados.TRIBUNAL,
    Status: processed.status || previous.Status || previous.status || previousDados.status,
    status: processed.status || previous.status || previous.Status || previousDados.status,
    Situacao: processed.situacao || previous.Situacao || previous.situacao || previousDados.situacao || previousDados.SITUACAO,
    situacao: processed.situacao || previous.situacao || previous.Situacao || previousDados.situacao || previousDados.SITUACAO,
    UltimoRetorno: ultimoRetorno,
    ultimo_retorno: ultimoRetorno,
    ProximoRetorno: proximoRetorno,
    proximo_retorno: proximoRetorno,
    Observacao: processed.observacao || processed.observacoes || previous.Observacao || previous.Observacoes || previous.observacao || previous.observacoes || previousDados.observacao || previousDados.observacoes,
    observacoes: processed.observacao || processed.observacoes || previous.observacoes || previous.Observacao || previousDados.observacoes || previousDados.observacao,
    ultimo_movimento: processed.datajud_ultimo_movimento || processed.ultimo_movimento || previous.ultimo_movimento || previousDados.datajud_ultimo_movimento || previousDados.ultimo_movimento,
    fase: processed.fase || previous.fase || previousDados.fase,
    valor_causa: processed.valor_causa || previous.valor_causa || previousDados.valor_causa,
    DatajudEncerrado: hasValue(processed.datajud_encerrado_tribunal) ? !!processed.datajud_encerrado_tribunal : (previous.DatajudEncerrado ?? previous.datajud_encerrado_tribunal ?? previousDados.datajud_encerrado_tribunal),
    datajud_encerrado_tribunal: hasValue(processed.datajud_encerrado_tribunal) ? !!processed.datajud_encerrado_tribunal : (previous.datajud_encerrado_tribunal ?? previous.DatajudEncerrado ?? previousDados.datajud_encerrado_tribunal),
    isBaixaTribunal: processed.isBaixaTribunal ?? previous.isBaixaTribunal ?? previousDados.isBaixaTribunal,
    AtendidoPor: processed.atendido_por || previous.AtendidoPor || previous.atendido_por || previousDados.atendido_por,
    atendido_por: processed.atendido_por || previous.atendido_por || previous.AtendidoPor || previousDados.atendido_por,
    atendido_em: processed.atendido_em || previous.atendido_em || previous.AtendidoEm || previousDados.atendido_em,
    edited_by: actorId,
    edited_by_name: actorName,
    edited_at: now,
    updated_at: now,
    EmpresaId: empresaId,
    dados: mergedDados,
  };

  for (const [key, value] of Object.entries(values)) {
    if (hasValue(value) || key === 'edited_by' || key === 'edited_by_name' || key === 'edited_at' || key === 'updated_at') {
      row[key] = value;
    }
  }
  row.dados = {
    ...mergedDados,
    edited_by: actorId,
    edited_by_name: actorName,
    edited_at: now,
    ...(processed.atendido_por ? { atendido_por: processed.atendido_por } : {}),
    ...(processed.atendido_em ? { atendido_em: processed.atendido_em } : {}),
  };
  return row;
}

async function existingFromSheets(empresaId: string, protocolo: string) {
  if (!sheetsWebhookConfigured()) return null;
  try {
    const r = await sheetsServerPost({ action: 'list', empresaId, limit: 8000 });
    if (!r.ok) return null;
    const rows = Array.isArray(r.json?.rows) ? r.json.rows : (Array.isArray(r.json?.data) ? r.json.data : []);
    const dig = protocolo.replace(/\D/g, '');
    return rows.find((x: any) => {
      const p = String(x.Protocolo ?? x.protocolo ?? x.protocolo_ref ?? '').replace(/\D/g, '');
      return p === dig || String(x.Protocolo ?? x.protocolo ?? x.protocolo_ref) === protocolo;
    }) || null;
  } catch { return null; }
}

export async function saveOneCaseAction(caseData: LegalCase): Promise<{ success: boolean; message: string; case?: LegalCase }> {
  try {
    const ctx = await getUserContext();
    const { empresa_id, auth_id } = ctx;
    if (!empresa_id) return { success: false, message: 'Sessão expirada.' };
    if (!caseData?.protocolo) return { success: false, message: 'Protocolo obrigatório.' };

    const processed: any = processarCaso(caseData as any);
    const hybrid = hybridEnabled() && sheetsWebhookConfigured();
    let existing: any = null;

    if (hybrid) {
      existing = await existingFromSheets(empresa_id, processed.protocolo);
    } else {
      const admin = await getSupabaseAdmin();
      const { data } = await admin
        .from('processos')
        .select('created_by,dados,ultimo_retorno,protocolo_ref')
        .eq('empresa_id', empresa_id)
        .eq('protocolo_ref', processed.protocolo)
        .maybeSingle();
      existing = data;
    }

    const owner = existing?.created_by || existing?.CreatedBy || existing?.createdBy || existing?.dados?.created_by || processed.created_by || null;
    const forceTransfer = !!(caseData as any).force_transfer_owner || !!(caseData as any).__transfer_owner;
    if (!forceTransfer) processed.created_by = owner;

    const previousReturn = String(existing?.ultimo_retorno || existing?.UltimoRetorno || existing?.dados?.ultimoRetorno || existing?.dados?.ultimo_retorno || '');
    const currentReturn = String(processed.ultimoRetorno || processed.ultimo_retorno || '');
    if (auth_id && currentReturn && currentReturn !== previousReturn) {
      processed.atendido_por = auth_id;
      processed.atendido_em = new Date().toISOString();
    }

    const actorName = String((ctx as any).nome || (ctx as any).name || (ctx as any).email || auth_id || 'Sistema');
    processed.edited_by = auth_id || null;
    processed.edited_by_name = actorName;
    processed.edited_at = new Date().toISOString();

    const row = buildSheetRow(processed, empresa_id, auth_id || null, actorName, existing);

    if (hybrid) {
      const r = await sheetsServerPost({
        action: 'write',
        rows: [row],
        source: 'LexisPredict',
        audit: {
          edited_by: auth_id,
          edited_by_name: actorName,
          edited_at: processed.edited_at,
          atendido_por: processed.atendido_por,
          atendido_em: processed.atendido_em,
        },
      });
      if (!r.ok) return { success: false, message: r.error || 'Falha ao atualizar a planilha.' };
      return { success: true, message: 'Salvo na carteira/planilha.', case: processed };
    }

    const admin = await getSupabaseAdmin();
    const dbRow: any = {
      empresa_id,
      created_by: processed.created_by || null,
      protocolo_ref: processed.protocolo,
      advogado: processed.advogado || 'NÃO ATRIBUÍDO',
      escritorio: processed.escritorio || null,
      status: processed.status || processed.situacao || 'Sem Prazo',
      risco: processed.risco || 'Normal',
      proximo_retorno: iso(processed.proximoPrazo),
      ultimo_retorno: iso(processed.ultimoRetorno),
      tribunal: processed.tribunal || 'Outros',
      telefone: processed.telefone || '',
      observacoes: processed.observacao || '',
      datajud_ultimo_movimento: processed.datajud_ultimo_movimento,
      datajud_ultimo_nome: processed.datajud_ultimo_nome,
      datajud_consultado_em: processed.datajud_consultado_em,
      tem_atualizacao_pos_retorno: !!processed.tem_atualizacao_pos_retorno,
      datajud_encerrado_tribunal: !!processed.datajud_encerrado_tribunal,
      datajud_encerrado_motivo: processed.datajud_encerrado_motivo,
      indicio_busca_apreensao: !!processed.indicio_busca_apreensao,
      em_cumprimento_sentenca: !!processed.em_cumprimento_sentenca,
      djen_nova_comunicacao: !!processed.djen_nova_comunicacao,
      djen_ultimo_resumo: processed.djen_ultimo_resumo,
      djen_ultimo_link: processed.djen_ultimo_link,
      djen_ultima_data: processed.djen_ultima_data,
      dados: {
        ...(existing?.dados || {}),
        ...processed,
        edited_by: auth_id || null,
        edited_by_name: actorName,
        edited_at: processed.edited_at,
      },
    };
    const { error } = await admin.from('processos').upsert(dbRow, { onConflict: 'protocolo_ref,empresa_id' });
    if (error) return { success: false, message: error.message };

    if (sheetsWebhookConfigured()) {
      void sheetsServerPost({ action: 'write', rows: [row], source: 'LexisPredict', audit: { edited_by: auth_id, edited_by_name: actorName, edited_at: processed.edited_at } });
    }
    return { success: true, message: 'Salvo.', case: processed };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao salvar.' };
  }
}

export async function saveManyCasesAction(cases: LegalCase[]): Promise<{ success: boolean; saved: number; failed: number; message?: string; error?: string }> {
  const list = Array.isArray(cases) ? cases.filter((c) => c?.protocolo).slice(0, 100) : [];
  let saved = 0; const errors: string[] = [];
  for (const c of list) { const r = await saveOneCaseAction(c); if (r.success) saved++; else errors.push(`${c.protocolo}: ${r.message}`); }
  return { success: saved > 0, saved, failed: list.length - saved, message: saved ? `${saved} salvo(s)` : errors[0] || 'Falha ao salvar', error: errors[0] };
}

export async function deleteOneCaseAction(protocolo: string): Promise<{ success: boolean; message: string }> {
  try {
    const ctx = await getUserContext(); if (!ctx.empresa_id || !protocolo) return { success: false, message: 'Sessão ou protocolo inválido.' };
    if (hybridEnabled() && sheetsWebhookConfigured()) {
      const r = await sheetsServerPost({ action: 'write', rows: [{ Protocolo: protocolo, protocolo, empresa_id: ctx.empresa_id, _deleted: true, deleted_at: new Date().toISOString(), deleted_by: ctx.auth_id || null }] });
      return r.ok ? { success: true, message: 'Removido da carteira/planilha.' } : { success: false, message: r.error || 'Falha ao remover.' };
    }
    const admin = await getSupabaseAdmin(); const { error } = await admin.from('processos').delete().eq('empresa_id', ctx.empresa_id).eq('protocolo_ref', protocolo);
    return error ? { success: false, message: error.message } : { success: true, message: 'Removido.' };
  } catch (e: any) { return { success: false, message: e?.message || 'Falha ao remover.' }; }
}

export async function reassignCaseOwnerAction(input: { protocolo: string; novoOwnerAuthId: string }): Promise<{ success: boolean; message: string }> {
  try {
    const { empresa_id, auth_id } = await getUserContext(); if (!empresa_id || !auth_id) return { success: false, message: 'Sessão expirada.' };
    const protocolo = String(input.protocolo || '').trim(), novo = String(input.novoOwnerAuthId || '').trim();
    if (!protocolo || !novo) return { success: false, message: 'Protocolo e novo responsável obrigatórios.' };

    if (hybridEnabled() && sheetsWebhookConfigured()) {
      const existing = await existingFromSheets(empresa_id, protocolo);
      if (!existing) return { success: false, message: 'Processo não encontrado na carteira.' };
      const row = overlayDefined({ ...existing }, {
        Protocolo: protocolo,
        protocolo,
        empresa_id,
        EmpresaId: empresa_id,
        created_by: novo,
        CreatedBy: novo,
        owner_updated_by: auth_id,
        owner_updated_at: new Date().toISOString(),
        edited_by: auth_id,
        edited_at: new Date().toISOString(),
      });
      if (existing.dados && typeof existing.dados === 'object') row.dados = { ...existing.dados, created_by: novo, owner_updated_by: auth_id, owner_updated_at: row.owner_updated_at };
      const r = await sheetsServerPost({ action: 'write', rows: [row], source: 'LexisPredict' });
      return r.ok ? { success: true, message: 'Responsável atualizado.' } : { success: false, message: r.error || 'Falha ao transferir.' };
    }

    const admin = await getSupabaseAdmin();
    const { data: me } = await admin.from('usuarios').select('cargo,role,perfil').eq('empresa_id', empresa_id).eq('auth_user_id', auth_id).maybeSingle();
    if (!canSupervisaoCarteira(me as any)) return { success: false, message: SUPERVISAO_REQUIRED };
    const { data: current } = await admin.from('processos').select('id,dados').eq('empresa_id', empresa_id).eq('protocolo_ref', protocolo).maybeSingle();
    const { error } = await admin.from('processos').update({ created_by: novo, dados: { ...(current?.dados || {}), created_by: novo } }).eq('empresa_id', empresa_id).eq('protocolo_ref', protocolo);
    return error ? { success: false, message: error.message } : { success: true, message: 'Responsável atualizado.' };
  } catch (e: any) { return { success: false, message: e?.message || 'Falha ao transferir.' }; }
}

export async function transferCasesOwnerAction(input: { protocolos: string[]; novoOwnerAuthId: string }): Promise<{ success: boolean; updated: number; message: string }> {
  const list = Array.isArray(input.protocolos) ? input.protocolos.map(String).filter(Boolean).slice(0, 200) : [];
  let updated = 0; const errors: string[] = [];
  for (const protocolo of list) { const r = await reassignCaseOwnerAction({ protocolo, novoOwnerAuthId: input.novoOwnerAuthId }); if (r.success) updated++; else errors.push(`${protocolo}: ${r.message}`); }
  return { success: updated > 0, updated, message: updated ? `${updated} processo(s) transferido(s)` : errors[0] || 'Nenhum atualizado' };
}

export async function stampAndLogEdicaoAction(protocolo: string, extra: Record<string, any> = {}): Promise<{ success: boolean }> {
  try {
    const ctx = await getUserContext(); if (!ctx.empresa_id || !protocolo) return { success: false };
    const now = new Date().toISOString();
    if (hybridEnabled() && sheetsWebhookConfigured()) {
      const existing = await existingFromSheets(ctx.empresa_id, protocolo);
      const row = overlayDefined({ ...(existing || {}) }, {
        Protocolo: protocolo,
        protocolo,
        empresa_id: ctx.empresa_id,
        EmpresaId: ctx.empresa_id,
        ...extra,
        edited_by: ctx.auth_id || null,
        edited_at: now,
      });
      if (existing?.dados && typeof existing.dados === 'object') row.dados = { ...existing.dados, ...extra, auditado_por: ctx.auth_id, auditado_em: now, edited_by: ctx.auth_id, edited_at: now };
      const r = await sheetsServerPost({ action: 'write', rows: [row], source: 'LexisPredict' });
      return { success: !!r.ok };
    }
    const admin = await getSupabaseAdmin();
    const { data: row } = await admin.from('processos').select('id,dados,protocolo_ref').eq('empresa_id', ctx.empresa_id).eq('protocolo_ref', protocolo).maybeSingle();
    if (row) await admin.from('processos').update({ dados: { ...(row.dados || {}), ...extra, auditado_por: ctx.auth_id, auditado_em: now } }).eq('id', row.id);
    return { success: true };
  } catch { return { success: false }; }
}
