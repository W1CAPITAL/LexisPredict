'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v465.0 ELITE
 */

import { 
  getStoredCasesForEmpresa, 
  saveStoredCasesForEmpresa, 
  getUserContext, 
  getStoredNotes, 
  getEmpresaUsers,
  updateCaseDataJudSystem
} from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, gerarHashAuditoria, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { headers } from 'next/headers';

export async function fetchRepoCases() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return await getStoredCasesForEmpresa(empresa_id);
}

export async function fetchRepoNotes() {
  return await getStoredNotes();
}

export async function syncRepoCases(cases: LegalCase[]) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, message: "Sessão expirada." };
  return await saveStoredCasesForEmpresa(cases, empresa_id);
}

export async function recalibrateCasesAction(alertLimit: number = 3) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, error: "Sessão expirada." };
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const updatedCases = cases.map(c => isCasoEncerrado(c) ? c : processarCaso({ ...c, statusManual: 'Automatico' }, { alertLimit }));
    await saveStoredCasesForEmpresa(updatedCases, empresa_id);
    return { success: true, count: updatedCases.length, message: "Urgências recalculadas." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchTeamPerformanceAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { users: [], cases: [] };
    const [users, cases] = await Promise.all([
      getEmpresaUsers(),
      getStoredCasesForEmpresa(empresa_id, true)
    ]);
    return { users, cases };
  } catch (e: any) {
    return { users: [], cases: [] };
  }
}

export async function scanOneDataJudAction(protocolo: string, fast = true) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
       return { success: false, protocolo, error: "401_SESSAO_EXPIRADA", message: "Sessão expirada" };
    }

    const supabase = await createClient();
    const { data: dbItem } = await supabase
      .from('processos')
      .select('*')
      .eq('protocolo_ref', protocolo)
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (!dbItem) return { success: false, protocolo, error: "NOT_FOUND", message: "Processo não localizado" };

    const target = processarCaso({
      ...(dbItem.dados as any),
      id: dbItem.id.toString(),
      created_by: dbItem.created_by,
      ultimoRetorno: dbItem.ultimo_retorno || '',
      datajud_hash: dbItem.datajud_hash
    });

    if (isCasoEncerrado(target)) return { success: true, protocolo, message: "Já encerrado", skipped: true };

    const dataJud = await fetchDataJud(protocolo, 1, { fast });
    
    if (dataJud && !dataJud.error) {
      const movimentos = dataJud.movimentos || [];
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, movimentos);
      const enc = detectarEncerradoNoTribunal(movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      const cump = detectarCumprimentoSentenca(movimentos);
      const newHash = gerarHashAuditoria(movimentos);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: !!check.alerta, 
        datajud_encerrado_tribunal: !!enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        datajud_hash: newHash,
        indicio_busca_apreensao: !!ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
        em_cumprimento_sentenca: !enc.encerrado && cump.ativo,
        cumprimento_sentenca_motivo: !enc.encerrado ? cump.motivo : null,
        cumprimento_sentenca_consultado_em: new Date().toISOString(),
        tribunal: dataJud.tribunal || target.tribunal
      };

      await updateCaseDataJudSystem(dbItem.id, patch);
      return { success: true, protocolo, casePatch: patch, movimentos, case: { ...target, ...patch } };
    }
    
    return { success: false, protocolo, message: dataJud?.message || "Erro no tribunal", error: true };
  } catch (e: any) {
    return { success: false, protocolo, message: `Falha técnica`, error: true };
  }
}

export async function scanSingleCaseAction(protocolo: string) {
  return await scanOneDataJudAction(protocolo, false);
}

/**
 * Realiza a auditoria DJEN via Proxy gru1 (São Paulo) para evitar 403.
 */
export async function scanOneDjenAction(protocolo: string, opts?: { dataInicio?: string; dataFim?: string }) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, message: "Sessão expirada." };

    const supabase = await createClient();
    const { data: dbItem } = await supabase
      .from('processos')
      .select('*')
      .eq('protocolo_ref', protocolo)
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (!dbItem) return { success: false, message: "Processo não localizado." };

    const sigla = dbItem.tribunal && dbItem.tribunal.length >= 2 && !/^outros$/i.test(dbItem.tribunal) 
      ? dbItem.tribunal : undefined;

    // Disparo via Proxy gru1 (Túnel Brasil)
    const secret = process.env.DATAJUD_WORKER_SECRET;
    const h = await headers();
    const host = h.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    let data;
    try {
      const proxyRes = await fetch(`${baseUrl}/api/djen-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo, siglaTribunal: sigla, ...opts }),
        signal: AbortSignal.timeout(20000)
      });
      data = await proxyRes.json();
    } catch {
      // Fallback local se proxy falhar (iap1 tentará direto)
      data = await fetchDjenComunicacoes(protocolo, { siglaTribunal: sigla, ...opts });
    }

    if (data.isGeoBlocked) return { success: false, message: "Bloqueio regional (403). Verifique o túnel gru1." };
    if (data.isRateLimited) return { success: false, message: "Rate limit DJEN — aguarde 1 minuto." };
    if (!data.success) return { success: false, message: data.error || "Falha na comunicação DJEN" };

    const check = detectarNovaComunicacaoDjen(dbItem.ultimo_retorno, data.items);
    const patch = {
      djen_consultado_em: new Date().toISOString(),
      djen_nova_comunicacao: !!check.alerta,
      djen_ultima_data: check.dataUltima,
      djen_ultimo_resumo: check.resumo,
      djen_ultimo_link: check.link,
      djen_count: data.count
    };

    await updateCaseDataJudSystem(dbItem.id, patch);
    return { success: true, protocolo, casePatch: patch, comunicacoes: data.items, message: check.alerta ? "Nova comunicação no DJEN" : `Comunicações DJEN: ${data.count}` };
  } catch (e: any) {
    return { success: false, message: "Erro técnico na auditoria DJEN." };
  }
}

export async function runDataJudScanAction(targetEmpresaId?: string) {
  try {
    const ctx = await getUserContext();
    const empresa_id = targetEmpresaId || ctx.empresa_id;
    if (!empresa_id) return { success: false, error: "Sessão expirada." };
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const batch = cases.filter(c => !isCasoEncerrado(c)).slice(0, 30);
    for (const c of batch) await scanOneDataJudAction(c.protocolo, true);
    return { success: true, scanned: batch.length, message: `Auditados ${batch.length} registros.` };
  } catch { return { success: false, error: "Falha na varredura." }; }
}

export async function clearDataJudAuditAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false };
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const updated = cases.map(c => ({
      ...c,
      tem_atualizacao_pos_retorno: false,
      datajud_encerrado_tribunal: false,
      djen_nova_comunicacao: false,
      djen_ultimo_resumo: null,
      djen_ultima_data: null,
      djen_consultado_em: null,
      djen_count: 0
    }));
    await saveStoredCasesForEmpresa(updated, empresa_id);
    return { success: true };
  } catch { return { success: false }; }
}

export async function runCloudWorkerAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) throw new Error("Sessão expirada.");
    const h = await headers();
    const host = h.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;
    fetch(`${baseUrl}/api/datajud-worker?empresa_id=${empresa_id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.DATAJUD_WORKER_SECRET}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    }).catch(() => {});
    return { success: true, message: "Lote disparado no servidor." };
  } catch (e: any) { return { success: false, error: e.message }; }
}
