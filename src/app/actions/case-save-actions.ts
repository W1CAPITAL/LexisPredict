'use server';

import { canSupervisaoCarteira, SUPERVISAO_REQUIRED } from '@/lib/auth-supervisao';
import { getUserContext, getSupabaseAdmin, getProfileByAuthId, logAuditoriaSistema } from '@/lib/server-db';
import { LegalCase, processarCaso, formatDateToISO } from '@/lib/case-logic';
import { sheetsServerPost, sheetsWebhookConfigured } from '@/lib/hybrid/sheets-server';

function iso(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const text = String(v).trim();
  if (!text || /^(null|undefined|invalid date)$/i.test(text)) return null;
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = text.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const formatted = formatDateToISO(v as any);
  return formatted && /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : null;
}

const dateOrNull = iso;

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

function protocolVariants(raw: string): string[] {
  const key = String(raw || '').trim();
  const digits = key.replace(/\D/g, '');
  const out: string[] = [];
  if (key) out.push(key);
  if (digits && digits !== key) out.push(digits);
  if (digits.length === 20) {
    const masked = `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16,20)}`;
    out.push(masked);
  }
  return Array.from(new Set(out));
}

/** Colunas reais da tabela processos (CSV/Supabase). Nunca gravar proximo_prazo. */
const PROCESSOS_WRITE_COLS = new Set([
  'empresa_id','protocolo_ref','dados','created_by','ultimo_retorno','proximo_retorno',
  'observacoes','status','risco','status_interno','escritorio','advogado','telefone',
  'tribunal','cliente','atendido_por','updated_at','datajud_ultimo_movimento',
  'datajud_ultimo_nome','datajud_encerrado_tribunal','em_cumprimento_sentenca',
  'djen_ultimo_resumo','tem_atualizacao_pos_retorno','djen_nova_comunicacao',
]);

function pickProcessoPayload(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (PROCESSOS_WRITE_COLS.has(k) && k !== 'proximo_prazo') out[k] = v;
  }
  return out;
}

async function loadProcessoRow(empresaId: string, protocolo: string): Promise<Record<string, any> | null> {
  const admin = await getSupabaseAdmin();
  for (const key of protocolVariants(protocolo)) {
    const { data, error } = await admin
      .from('processos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('protocolo_ref', key)
      .maybeSingle();
    if (error && /proximo_prazo/i.test(String(error.message))) {
      const retry = await admin
        .from('processos')
        .select('id, empresa_id, protocolo_ref, dados, created_by, ultimo_retorno, proximo_retorno, observacoes, status, status_interno, atendido_por, escritorio, advogado, telefone, tribunal, cliente, datajud_ultimo_movimento, datajud_ultimo_nome, datajud_encerrado_tribunal, em_cumprimento_sentenca, djen_ultimo_resumo')
        .eq('empresa_id', empresaId)
        .eq('protocolo_ref', key)
        .maybeSingle();
      if (retry.data) return retry.data as Record<string, any>;
      continue;
    }
    if (error) continue;
    if (data) return data as Record<string, any>;
  }
  return null;
}

async function persistToDatabase(
  empresaId: string,
  processed: Record<string, any>,
  existing: Record<string, any> | null,
  actorId: string | null,
  actorName: string,
): Promise<{ success: boolean; message?: string; data?: any }> {
  const admin = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const protocolo = String(processed.protocolo || processed.protocolo_ref || '').trim();
  if (!protocolo) return { success: false, message: 'Protocolo obrigatório.' };

  const previousDados = existing?.dados && typeof existing.dados === 'object' ? existing.dados : {};
  const mergedDados = {
    ...previousDados,
    ...Object.fromEntries(Object.entries(processed).filter(([, v]) => v !== undefined)),
    edited_by: actorId,
    edited_by_name: actorName,
    edited_at: now,
  };

  // Atualização por ID quando o registro já existe: evita depender de constraint
  // de upsert e impede duplicação/"salvei mas não mudou".
  const directFields: Record<string, string> = {
    status: 'status',
    status_interno: 'situacao',
    created_by: 'created_by',
    atendido_por: 'atendido_por',
    ultimo_retorno: 'ultimo_retorno',
    proximo_retorno: 'proximo_retorno',
    observacoes: 'observacoes',
    datajud_ultimo_movimento: 'datajud_ultimo_movimento',
    datajud_ultimo_nome: 'datajud_ultimo_nome',
    datajud_encerrado_tribunal: 'datajud_encerrado_tribunal',
    djen_ultimo_resumo: 'djen_ultimo_resumo',
    em_cumprimento_sentenca: 'em_cumprimento_sentenca',
  };

  const payload: Record<string, any> = pickProcessoPayload({
    empresa_id: empresaId,
    protocolo_ref: protocolo,
    dados: mergedDados,
  });
  for (const [dbKey, sourceKey] of Object.entries(directFields)) {
    if (processed[sourceKey] !== undefined && PROCESSOS_WRITE_COLS.has(dbKey)) {
      payload[dbKey] = dbKey === 'ultimo_retorno' || dbKey === 'proximo_retorno'
        ? dateOrNull(processed[sourceKey])
        : processed[sourceKey];
    }
  }

  // updated_at é desejável, mas não pode bloquear uma edição se o schema antigo
  // ainda não tiver essa coluna.
  const withUpdated = { ...payload, updated_at: now };

  if (existing?.id) {
    let result = await admin.from('processos').update(withUpdated).eq('id', existing.id).select('*').maybeSingle();
    if (result.error && /updated_at|proximo_prazo|schema cache|column .* does not exist/i.test(String(result.error.message))) {
      const safe = { ...payload };
      delete safe.updated_at;
      delete (safe as any).proximo_prazo;
      result = await admin.from('processos').update(safe).eq('id', existing.id).select('id, protocolo_ref').maybeSingle();
    }
    if (result.error) return { success: false, message: result.error.message };
    return { success: true, data: result.data };
  }

  let result = await admin.from('processos').insert(withUpdated).select('*').maybeSingle();
  if (result.error && /updated_at|schema cache|column .* does not exist/i.test(String(result.error.message))) {
    result = await admin.from('processos').insert(payload).select('*').maybeSingle();
  }
  if (result.error) return { success: false, message: result.error.message };
  return { success: true, data: result.data };
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
    // Aliases de colunas legadas: a planilha pode chamar a coluna só de "Retorno"/"Prazo"
    Retorno: ultimoRetorno,
    ProximoRetorno: proximoRetorno,
    proximo_retorno: proximoRetorno,
    Prazo: proximoRetorno,
    Responsavel: processed.created_by || previous.CreatedBy || previous.Responsavel || previous.responsavel || previousDados.created_by || null,
    Observacao: processed.observacao || processed.observacoes || previous.Observacao || previous.Observacoes || previous.observacao || previous.observacoes || previousDados.observacao || previousDados.observacoes,
    observacoes: processed.observacao || processed.observacoes || previous.observacoes || previous.Observacao || previousDados.observacoes || previousDados.observacao,
    ultimo_movimento: processed.datajud_ultimo_movimento || processed.ultimo_movimento || previous.ultimo_movimento || previousDados.datajud_ultimo_movimento || previousDados.ultimo_movimento,
    fase: processed.fase || previous.fase || previousDados.fase,
    valor_causa: processed.valor_causa || previous.valor_causa || previousDados.valor_causa,
    DatajudEncerrado: hasValue(processed.datajud_encerrado_tribunal) ? !!processed.datajud_encerrado_tribunal : (previous.DatajudEncerrado ?? previous.datajud_encerrado_tribunal ?? previousDados.datajud_encerrado_tribunal),
    datajud_encerrado_tribunal: hasValue(processed.datajud_encerrado_tribunal) ? !!processed.datajud_encerrado_tribunal : (previous.datajud_encerrado_tribunal ?? previous.DatajudEncerrado ?? previousDados.datajud_encerrado_tribunal),
    isBaixaTribunal: processed.isBaixaTribunal ?? previous.isBaixaTribunal ?? previousDados.isBaixaTribunal,
    AtendidoPor: processed.atendido_por_nome || actorName || processed.atendido_por || previous.AtendidoPor || previous.atendido_por || previousDados.atendido_por,
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
    // Edição deve persistir também os campos operacionais que alimentam cards/flags.
    if ((caseData as any).situacao !== undefined) {
      processed.situacao = String((caseData as any).situacao || '').toUpperCase();
      if (processed.situacao === 'ENCERRADO') {
        processed.statusManual = 'Encerrado';
        processed.status = 'Encerrado';
      }
    }
    if ((caseData as any).statusManual !== undefined) processed.statusManual = (caseData as any).statusManual;
    if ((caseData as any).ultimoRetorno !== undefined || (caseData as any).ultimo_retorno !== undefined) {
      processed.ultimoRetorno = dateOrNull((caseData as any).ultimoRetorno ?? (caseData as any).ultimo_retorno);
      processed.ultimo_retorno = processed.ultimoRetorno;
    }
    if ((caseData as any).proximoPrazo !== undefined || (caseData as any).proximo_retorno !== undefined) {
      processed.proximoPrazo = dateOrNull((caseData as any).proximoPrazo ?? (caseData as any).proximo_retorno);
      processed.proximo_retorno = processed.proximoPrazo;
    }
    // Supabase é a fonte operacional. Sheets nunca participa da leitura/decisão de salvamento.
    const existing = await loadProcessoRow(empresa_id, processed.protocolo);

    const owner = existing?.created_by || existing?.CreatedBy || existing?.createdBy || existing?.dados?.created_by || processed.created_by || null;
    const forceTransfer = !!(caseData as any).force_transfer_owner || !!(caseData as any).__transfer_owner;
    if (!forceTransfer) processed.created_by = owner;

    const previousReturn = String(existing?.ultimo_retorno || existing?.UltimoRetorno || existing?.dados?.ultimoRetorno || existing?.dados?.ultimo_retorno || '');
    const currentReturn = String(processed.ultimoRetorno || processed.ultimo_retorno || '');
    const forceAtendido = !!(caseData as any).__force_atendido || !!(caseData as any).atendido_por;
    if (auth_id && (forceAtendido || (currentReturn && currentReturn !== previousReturn))) {
      processed.atendido_por = auth_id;
      processed.atendido_em = new Date().toISOString();
    }

    let actorName = String((ctx as any).nome || (ctx as any).name || (ctx as any).email || '').trim();
    if (!actorName && auth_id) {
      try {
        const admin = await getSupabaseAdmin();
        const { data: u } = await admin
          .from('usuarios')
          .select('nome, email')
          .eq('auth_user_id', auth_id)
          .maybeSingle();
        actorName = String(u?.nome || u?.email || auth_id);
      } catch {
        actorName = auth_id;
      }
    }
    if (!actorName) actorName = 'Sistema';
    processed.edited_by = auth_id || null;
    processed.edited_by_name = actorName;
    processed.edited_at = new Date().toISOString();

    const row = buildSheetRow(processed, empresa_id, auth_id || null, actorName, existing);
    const db = await persistToDatabase(empresa_id, processed, existing, auth_id || null, actorName);
    if (!db.success) return { success: false, message: db.message || 'Falha ao salvar.' };

    try {
      await logAuditoriaSistema({
        empresaId: empresa_id,
        authUserId: auth_id,
        acao: 'edicao',
        protocolo: processed.protocolo,
        detalhes: {
          via: 'saveOneCaseAction',
          editor: actorName,
          situacao: processed.situacao,
          status: processed.status,
          ultimoRetorno: processed.ultimoRetorno || processed.ultimo_retorno || null,
          proximoPrazo: processed.proximoPrazo || processed.proximo_retorno || null,
        },
      });
    } catch { /* auditoria não bloqueia o salvamento */ }

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

/**
 * Fonte única para o botão "Registrar atendimento" em Processos/Cases/Tarefas.
 * Grava retorno, próximo retorno, situação, observação, auditoria e flags em uma única operação.
 */
export async function registrarAtendimentoCompletoAction(input: {
  protocolo: string;
  situacao?: string;
  observacao?: string;
  proximoPrazo?: string;
  via?: string;
  filaLista?: string;
}): Promise<{ success: boolean; message: string; ultimoRetorno?: string; proximoPrazo?: string; case?: LegalCase }> {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id || !input?.protocolo) return { success: false, message: 'Sessão expirada ou protocolo inválido.' };
    const admin = await getSupabaseAdmin();
    const protocolo = String(input.protocolo).trim();
    const existing = await loadProcessoRow(ctx.empresa_id, protocolo);
    if (!existing) return { success: false, message: 'Processo não encontrado na carteira.' };

    const hoje = new Date().toISOString().slice(0, 10);
    const situacao = String(input.situacao || 'EM ANDAMENTO').toUpperCase() === 'ENCERRADO' ? 'ENCERRADO' : 'EM ANDAMENTO';
    const proximo = situacao === 'ENCERRADO' ? null : dateOrNull(input.proximoPrazo);
    const observacao = String(input.observacao || '').trim();
    const previousDados = existing?.dados && typeof existing.dados === 'object' ? existing.dados : {};
    const base = processarCaso({ ...(previousDados as any), protocolo, situacao, proximoPrazo: proximo || '', ultimoRetorno: hoje, observacao, statusManual: situacao === 'ENCERRADO' ? 'Encerrado' : 'Automatico' } as any) as any;
    const actorName = String((ctx as any).nome || (ctx as any).name || (ctx as any).email || ctx.auth_id || 'Sistema');
    const dados = {
      ...previousDados,
      ...base,
      protocolo,
      situacao,
      statusManual: situacao === 'ENCERRADO' ? 'Encerrado' : 'Automatico',
      ultimoRetorno: hoje,
      ultimo_retorno: hoje,
      proximoPrazo: proximo || '',
      proximo_retorno: proximo,
      observacao,
      observacoes: observacao,
      atendido_por: ctx.auth_id || null,
      atendido_em: new Date().toISOString(),
      edited_by: ctx.auth_id || null,
      edited_by_name: actorName,
      edited_at: new Date().toISOString(),
      filaLista: input.filaLista || 'normal',
      tem_atualizacao_pos_retorno: false,
      djen_nova_comunicacao: false,
      tem_novo_andamento: false,
      datajud_encerrado_tribunal: situacao === 'ENCERRADO' ? (base.datajud_encerrado_tribunal ?? existing.datajud_encerrado_tribunal ?? false) : (base.datajud_encerrado_tribunal ?? existing.datajud_encerrado_tribunal ?? false),
    };

    const patch: Record<string, any> = pickProcessoPayload({
      dados,
      ultimo_retorno: hoje,
      proximo_retorno: proximo,
      observacoes: observacao,
      status: situacao === 'ENCERRADO' ? 'Encerrado' : (base.status || existing.status || 'Sem Prazo'),
      status_interno: situacao,
      atendido_por: ctx.auth_id || null,
      datajud_encerrado_tribunal: !!dados.datajud_encerrado_tribunal,
      tem_atualizacao_pos_retorno: false,
      djen_nova_comunicacao: false,
      updated_at: new Date().toISOString(),
    });
    let saved = await admin.from('processos').update(patch).eq('id', existing.id);
    if (saved.error && /updated_at|proximo_prazo|status_interno|schema cache|column .* does not exist/i.test(String(saved.error.message))) {
      const retry = { ...patch };
      delete retry.updated_at; delete retry.status_interno;
      saved = await admin.from('processos').update(retry).eq('id', existing.id);
    }
    if (saved.error) return { success: false, message: saved.error.message };

    try {
      await logAuditoriaSistema({
        empresaId: ctx.empresa_id,
        authUserId: ctx.auth_id,
        acao: situacao === 'ENCERRADO' ? 'encerramento' : 'atendimento',
        protocolo,
        detalhes: { via: input.via || 'app', observacao, ultimoRetorno: hoje, proximoPrazo: proximo, situacao, filaLista: input.filaLista || 'normal' },
      });
    } catch { /* auditoria não desfaz o salvamento */ }

    const savedCase = processarCaso({ ...(previousDados as any), ...dados, ultimoRetorno: hoje, ultimo_retorno: hoje, proximoPrazo: proximo || '', proximo_retorno: proximo, situacao, status: patch.status } as any) as any;
    return { success: true, message: situacao === 'ENCERRADO' ? 'Atendimento salvo e processo encerrado.' : 'Atendimento salvo.', ultimoRetorno: hoje, proximoPrazo: proximo || '', case: savedCase };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao registrar atendimento.' };
  }
}

export async function registrarAtendimentoAction(protocolos: string[], extra: Record<string, any> = {}): Promise<{ success: boolean; updated: number; message: string }> {
  const list = Array.isArray(protocolos) ? protocolos.map(String).filter(Boolean).slice(0, 100) : [];
  let updated = 0;
  for (const protocolo of list) {
    const r = await registrarAtendimentoCompletoAction({ protocolo, situacao: extra.situacao || 'EM ANDAMENTO', observacao: extra.observacao || '', proximoPrazo: extra.proximoPrazo || extra.proximoRetorno || '', via: extra.via || 'app', filaLista: extra.filaLista || 'normal' });
    if (r.success) updated++;
  }
  return { success: updated > 0, updated, message: updated ? `${updated} atendimento(s) registrado(s)` : 'Nenhum atendimento registrado.' };
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
