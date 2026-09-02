'use server';

import { canSupervisaoCarteira, SUPERVISAO_REQUIRED } from '@/lib/auth-supervisao';
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
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

export async function saveOneCaseAction(caseData: LegalCase): Promise<{ success: boolean; message: string; case?: LegalCase }> {
  try {
    const ctx = await getUserContext();
    const { empresa_id, auth_id } = ctx;
    if (!empresa_id) return { success: false, message: 'Sessão expirada.' };
    if (!caseData?.protocolo) return { success: false, message: 'Protocolo obrigatório.' };

    const processed: any = processarCaso(caseData as any);
    // Supabase é a fonte operacional. Sheets nunca participa da leitura/decisão de salvamento.
    const existing = await existingFromDatabase(empresa_id, processed.protocolo);

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
    const db = await persistToDatabase(empresa_id, processed, existing, auth_id || null, actorName);
    if (!db.success) return { success: false, message: db.message || 'Falha ao salvar.' };

    // Espelho incremental: 1 processo por operação. Falha no Sheets não desfaz a gravação no banco.
    if (sheetsWebhookConfigured()) {
      void sheetsServerPost({
        action: 'upsert_batch',
        rows: [row],
        source: 'LexisPredict',
        actor: auth_id || 'sync',
        actor_name: actorName,
        perfil: 'superadmin',
        audit: {
          edited_by: auth_id,
          edited_by_name: actorName,
          edited_at: processed.edited_at,
          atendido_por: processed.atendido_por,
          atendido_em: processed.atendido_em,
        },
      }).catch(() => {});
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
    const ctx = await getUserContext();
    if (!ctx.empresa_id || !protocolo) return { success: false, message: 'Sessão ou protocolo inválido.' };

    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from('processos')
      .delete()
      .eq('empresa_id', ctx.empresa_id)
      .eq('protocolo_ref', protocolo);
    if (error) return { success: false, message: error.message };

    if (sheetsWebhookConfigured()) {
      void sheetsServerPost({
        action: 'upsert_batch',
        rows: [{
          Protocolo: protocolo,
          protocolo,
          empresa_id: ctx.empresa_id,
          EmpresaId: ctx.empresa_id,
          Status: 'EXCLUÍDO',
          Situacao: 'EXCLUÍDO',
          _deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: ctx.auth_id || null,
        }],
        source: 'LexisPredict',
        actor: ctx.auth_id || 'sync',
        actor_name: String((ctx as any).nome || (ctx as any).email || ctx.auth_id || 'Sistema'),
        perfil: 'superadmin',
      }).catch(() => {});
    }

    return { success: true, message: 'Removido.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao remover.' };
  }
}

export async function reassignCaseOwnerAction(input: { protocolo: string; novoOwnerAuthId: string }): Promise<{ success: boolean; message: string }> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, message: 'Sessão expirada.' };

    const protocolo = String(input.protocolo || '').trim();
    const novo = String(input.novoOwnerAuthId || '').trim();
    if (!protocolo || !novo) return { success: false, message: 'Protocolo e novo responsável obrigatórios.' };

    const admin = await getSupabaseAdmin();
    const { data: me } = await admin.from('usuarios').select('cargo,role,perfil').eq('empresa_id', empresa_id).eq('auth_user_id', auth_id).maybeSingle();
    if (!canSupervisaoCarteira(me as any)) return { success: false, message: SUPERVISAO_REQUIRED };

    const { data: current } = await admin.from('processos').select('*').eq('empresa_id', empresa_id).eq('protocolo_ref', protocolo).maybeSingle();
    if (!current) return { success: false, message: 'Processo não encontrado na carteira.' };

    const now = new Date().toISOString();
    const dados = { ...(current.dados || {}), created_by: novo, owner_updated_by: auth_id, owner_updated_at: now, edited_by: auth_id, edited_at: now };
    const { error } = await admin.from('processos').update({ created_by: novo, dados, updated_at: now }).eq('empresa_id', empresa_id).eq('protocolo_ref', protocolo);
    if (error) return { success: false, message: error.message };

    if (sheetsWebhookConfigured()) {
      const row = buildSheetRow({ ...(current.dados || {}), protocolo, created_by: novo, edited_by: auth_id, edited_at: now }, empresa_id, auth_id, String((me as any)?.nome || auth_id), { ...current, dados });
      void sheetsServerPost({ action: 'upsert_batch', rows: [{ ...row, created_by: novo, CreatedBy: novo, Responsavel: novo }], source: 'LexisPredict', actor: auth_id, actor_name: String((me as any)?.nome || auth_id), perfil: 'superadmin' }).catch(() => {});
    }

    return { success: true, message: 'Responsável atualizado.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao transferir.' };
  }
}

export async function transferCasesOwnerAction(input: { protocolos: string[]; novoOwnerAuthId: string }): Promise<{ success: boolean; updated: number; message: string }> {
  const list = Array.isArray(input.protocolos) ? input.protocolos.map(String).filter(Boolean).slice(0, 200) : [];
  let updated = 0; const errors: string[] = [];
  for (const protocolo of list) { const r = await reassignCaseOwnerAction({ protocolo, novoOwnerAuthId: input.novoOwnerAuthId }); if (r.success) updated++; else errors.push(`${protocolo}: ${r.message}`); }
  return { success: updated > 0, updated, message: updated ? `${updated} processo(s) transferido(s)` : errors[0] || 'Nenhum atualizado' };
}

export async function stampAndLogEdicaoAction(protocolo: string, extra: Record<string, any> = {}): Promise<{ success: boolean }> {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id || !protocolo) return { success: false };
    const now = new Date().toISOString();
    const admin = await getSupabaseAdmin();
    const { data: row } = await admin.from('processos').select('*').eq('empresa_id', ctx.empresa_id).eq('protocolo_ref', protocolo).maybeSingle();
    if (!row) return { success: false };

    const dados = { ...(row.dados || {}), ...extra, auditado_por: ctx.auth_id, auditado_em: now, edited_by: ctx.auth_id, edited_at: now };
    const { error } = await admin.from('processos').update({ dados, updated_at: now }).eq('id', row.id);
    if (error) return { success: false };

    if (sheetsWebhookConfigured()) {
      const actorName = String((ctx as any).nome || (ctx as any).email || ctx.auth_id || 'Sistema');
      const sheetRow = buildSheetRow({ ...(row.dados || {}), ...extra, protocolo, edited_by: ctx.auth_id, edited_at: now }, ctx.empresa_id, ctx.auth_id || null, actorName, { ...row, dados });
      void sheetsServerPost({ action: 'upsert_batch', rows: [sheetRow], source: 'LexisPredict', actor: ctx.auth_id || 'sync', actor_name: actorName, perfil: 'superadmin' }).catch(() => {});
    }
    return { success: true };
  } catch { return { success: false }; }
}
