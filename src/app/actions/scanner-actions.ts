'use server';

/**
 * @fileOverview Server Actions do Motor de Auditoria v6.0
 */

import { ScannerService, AuditResult } from '@/modules/process-scanner/services/scanner-service';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';

export async function startFullScannerJobAction() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, error: "401_SESSAO_EXPIRADA" };

  try {
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const validCases = cases.filter(c => c.protocolo.length >= 8);

    if (validCases.length === 0) {
      return { success: true, processed: 0, message: "Nenhum processo para auditoria." };
    }

    const scanner = new ScannerService();
    const results: AuditResult[] = [];
    
    // Execução sequencial para evitar bloqueios de IP (Rate Limit)
    for (const c of validCases) {
      const res = await scanner.auditarProcesso(c.protocolo, c.metadata?.hash);
      if (res) results.push(res);
    }

    const supabase = await createClient();
    if (results.length > 0) {
      const rows = results.map(r => ({
        empresa_id: empresa_id,
        cnj: r.cnj,
        status: r.statusAuditoria,
        last_sync: r.dataAuditoria,
        metadata: {
          ultimo_evento: r.analysis.detalhes,
          data_evento: r.dataUltimoEvento,
          categoria: r.analysis.categoria,
          criticidade: r.analysis.criticidade,
          confianca: r.analysis.confianca,
          dias_parado: r.diasSemMovimentacao,
          mudanca_detectada: r.mudancaDetectada,
          hash: r.hash,
          tribunal: r.tribunal
        }
      }));

      await supabase.from('process_scans').upsert(rows, { onConflict: 'cnj' });
    }

    return { 
      success: true, 
      processed: results.length,
      results: results,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchMniStatsAction() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('process_scans')
    .select('*')
    .eq('empresa_id', empresa_id);

  if (!data) return null;

  return {
    total: data.length,
    localizados: data.filter(d => d.status !== 'Processo Não Localizado').length,
    naoLocalizados: data.filter(d => d.status === 'Processo Não Localizado').length,
    mudancasDetectadas: data.filter(d => d.metadata?.mudanca_detectada === true).length,
    semAlteracao: data.filter(d => d.metadata?.mudanca_detectada === false).length,
    possivelEncerramento: data.filter(d => d.metadata?.categoria === 'Possível encerramento').length,
    possivelArquivamento: data.filter(d => d.metadata?.categoria === 'Possível arquivamento').length,
    parados30: data.filter(d => d.metadata?.dias_parado >= 30 && d.metadata?.dias_parado < 90).length,
    parados90: data.filter(d => d.metadata?.dias_parado >= 90 && d.metadata?.dias_parado < 180).length,
    parados180: data.filter(d => d.metadata?.dias_parado >= 180).length,
  };
}
