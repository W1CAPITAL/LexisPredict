'use server';

/**
 * Exportação operacional — CSV + XLSX Dossiê
 * SEM id / created_at / empresa_id / created_by
 * Escopo: apenas carteira visível ao usuário logado (RLS + getStoredCasesForEmpresa)
 */

import { getUserContext, getStoredCasesForEmpresa, registrarAuditoriaAction } from '@/lib/server-db';
import { buildDossieXlsxBase64, buildProcessosProfissionalXlsxBase64 } from '@/lib/xlsx-dossie-builder';
import { EXPORT_HEADERS, tribunalFromProtocolo } from '@/lib/xlsx-schema';

type Row = Record<string, any>;

/**
 * Registra auditoria de exportação (F1). Nunca derruba o export.
 */
async function auditarExportacao(tipo: string, cases: Row[], extra: Record<string, any> = {}) {
  try {
    const protocolos = (cases || [])
      .map((r) => String(r.protocolo_ref || r.protocolo || r.dados?.protocolo || ''))
      .filter(Boolean)
      .slice(0, 200);
    await registrarAuditoriaAction('exportacao', protocolos, { tipo, count: cases?.length || 0, ...extra });
  } catch {
    /* ignore */
  }
}

/**
 * Carrega carteira para exportação:
 * - Supervisor / Superadmin / Administrador → TODOS os processos da empresa
 * - Operador / Visualizador → apenas os processos do próprio usuário
 */
async function loadCasesForSession(): Promise<{
  cases: Row[];
  email: string | null;
  escopo: string;
  cargo: string | null;
  fullCarteira: boolean;
}> {
  const ctx = await getUserContext();
  const { empresa_id, email, isMasterView, isSuperAdmin, isSupervisor, cargo } = ctx as any;
  if (!empresa_id) throw new Error('Sessão expirada. Refaça o login.');

  const fullCarteira = !!(
    isMasterView ||
    isSuperAdmin ||
    isSupervisor ||
    cargo === 'Superadmin' ||
    cargo === 'Supervisor' ||
    cargo === 'Administrador'
  );

  // isAdmin=true usa service role e NÃO filtra por created_by
  const stored = await getStoredCasesForEmpresa(empresa_id, fullCarteira);
  if (!stored?.length) {
    throw new Error('Nenhum processo na carteira visível para exportar.');
  }

  const escopo = fullCarteira
    ? `Carteira completa da empresa (${cargo || 'Supervisor/Superadmin'}) — ${stored.length} processo(s)`
    : `Carteira do operador logado (${cargo || 'Operador'}) — ${stored.length} processo(s)`;

  return {
    cases: stored as Row[],
    email: email || null,
    escopo,
    cargo: cargo || null,
    fullCarteira,
  };
}

function operationalCells(r: Row): (string | number)[] {
  const dados = (r.dados && typeof r.dados === 'object' ? r.dados : {}) as any;
  const protocolo = String(r.protocolo || r.protocolo_ref || dados.protocolo || '');
  const evento = String(r.evento_tipo || dados.evento_tipo || '');
  const status = String(r.status || r.status_prazo || dados.status || '');

  return [
    r.assistente || dados.assistente || r.atendente || '',
    r.escritorio || dados.escritorio || '',
    r.advogado || dados.advogado || '',
    r.cliente || dados.cliente || '',
    r.telefone || dados.telefone || '',
    protocolo,
    r.data_distribuicao || dados.data_distribuicao || '',
    status,
    String(r.observacao || r.observacoes || dados.observacao || '').replace(/\n/g, ' '),
    r.produtos || dados.produtos || '',
    r.datajud_ultimo_movimento || '',
    r.evento_resumo || r.datajud_ultimo_nome || '',
    r.ultimoRetorno || r.ultimo_retorno || '',
    r.proximoRetorno || r.proximo_retorno || r.proximoPrazo || '',
    tribunalFromProtocolo(protocolo, r.tribunal || dados.tribunal),
    evento,
    r.tem_novo_andamento || r.tem_atualizacao_pos_retorno || r.djen_nova_comunicacao ? 'SIM' : 'NAO',
    r.datajud_encerrado_tribunal ? 'SIM' : 'NAO',
    r.indicio_busca_apreensao ? 'SIM' : 'NAO',
    r.em_cumprimento_sentenca || evento === 'cumprimento_sentenca' ? 'SIM' : 'NAO',
    r.djen_ultimo_resumo || '',
    status,
    String(diasSemRetorno(r.ultimoRetorno || r.ultimo_retorno) ?? ''),
    evento === 'sentenca_procedente' ? 'SIM' : 'NAO',
    evento === 'sentenca_improcedente' ? 'SIM' : 'NAO',
  ].map((v) => (v == null ? '' : v));
}

function diasSemRetorno(raw?: string | null): number | null {
  if (!raw) return null;
  const d = parseFlexDate(String(raw));
  if (!d) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
}

function parseFlexDate(raw: string): Date | null {
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = new Date(s.slice(0, 10) + 'T12:00:00');
    return isNaN(dt.getTime()) ? null : dt;
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(y, Number(m[2]) - 1, Number(m[1]), 12);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s + 'T12:00:00');
  return isNaN(dt.getTime()) ? null : dt;
}

/** CSV operacional (sem metadados internos) */
export async function exportCasesToCSVAction() {
  try {
    const { cases } = await loadCasesForSession();
    const lines = [EXPORT_HEADERS.join(',')];
    for (const r of cases) {
      const cells = operationalCells(r).map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const csv = '\uFEFF' + lines.join('\n');
    const day = new Date().toISOString().slice(0, 10);
    await auditarExportacao('csv', cases);
    return {
      success: true as const,
      base64: Buffer.from(csv, 'utf-8').toString('base64'),
      filename: `Gabinete_LexisPredict_${day}.csv`,
      mime: 'text/csv;charset=utf-8',
      count: cases.length,
    };
  } catch (error: any) {
    console.error('[Export CSV]', error);
    return { success: false as const, error: error?.message || 'Falha CSV' };
  }
}

/**
 * XLSX Dossiê — Capa + Analytics + Auditoria + Processos + Mapa_TJ + agregações
 * Botão "Exportar XLSX" / Dossiê Operacional
 */
export async function exportDossieXlsxAction() {
  try {
    const { cases, email, escopo, cargo, fullCarteira } = await loadCasesForSession();
    const result = await buildDossieXlsxBase64(cases, {
      usuario: email || undefined,
      escopo,
      cargo: cargo || undefined,
      fullCarteira,
    });
    await auditarExportacao('xlsx_dossie', cases);
    return {
      success: true as const,
      base64: result.base64,
      filename: result.filename,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: result.count,
      kpis: result.kpis,
    };
  } catch (e: any) {
    console.error('[exportDossieXlsx]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar XLSX' };
  }
}

/** Alias legados */
export async function exportCasesToXlsxAction() {
  return exportDossieXlsxAction();
}

export async function exportCasesXlsxAction() {
  return exportDossieXlsxAction();
}

/**
 * XLSX Profissional — Aba Processos
 * Múltiplas abas: Processos, Resumo, Top Atendentes, Estatísticas, Filtros
 * Formulas, formatação profissional, auto-filtro, frozen panes
 */
export async function exportProcessosProfissionalXlsxAction(filtros?: {
  q?: string;
  statusFilter?: string;
  baOnly?: boolean;
}) {
  try {
    const { cases, email, escopo, cargo, fullCarteira } = await loadCasesForSession();
    
    // Aplicar filtros se fornecidos
    let filtered = cases;
    if (filtros) {
      const query = filtros.q?.toLowerCase().trim() || '';
      if (filtros.statusFilter) {
        filtered = filtered.filter(r => String(r.status || r.dados?.status || '') === filtros.statusFilter);
      }
      if (filtros.baOnly) {
        filtered = filtered.filter(r => !!r.indicio_busca_apreensao || r.dados?.evento_tipo === 'ba');
      }
      if (query) {
        filtered = filtered.filter(r => {
          const dados = r.dados || {};
          return [
            String(dados.cliente || ''),
            String(dados.protocolo || ''),
            String(dados.advogado || ''),
            String(dados.escritorio || ''),
            String(dados.tribunal || ''),
            String(dados.status || ''),
          ].some(v => v.toLowerCase().includes(query));
        });
      }
    }
    
    const result = await buildProcessosProfissionalXlsxBase64(filtered, {
      usuario: email || undefined,
      escopo,
      cargo: cargo || undefined,
      fullCarteira,
      filtros,
    });
    await auditarExportacao('xlsx_profissional', filtered, { filtros: filtros || {} });
    return {
      success: true as const,
      base64: result.base64,
      filename: result.filename,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: result.count,
    };
  } catch (e: any) {
    console.error('[exportProcessosProfissionalXlsx]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar XLSX Profissional' };
  }
}
