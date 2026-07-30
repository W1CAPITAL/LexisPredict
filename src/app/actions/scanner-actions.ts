'use server';

/**
 * @fileOverview Server Actions do Motor de Auditoria v10.0
 * Correção de tipagem explícita para compatibilidade TSC.
 */

import { ScannerService, AuditResult } from '@/modules/process-scanner/services/scanner-service';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { detectarAtualizacaoPosRetorno } from '@/lib/datajud-sync';

export async function startFullScannerJobAction() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, error: "401_SESSAO_EXPIRADA" };

  try {
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const validCases = cases.filter(c => c.protocolo && c.protocolo.length >= 8);

    if (validCases.length === 0) {
      return { success: true, processed: 0, message: "Nenhum processo." };
    }

    const scanner = new ScannerService();
    // Passamos como any para evitar erro de propriedade 'metadata' no LegalCase
    const results = await scanner.scanLoteInteligente(validCases as any[]);

    const supabase = await createClient();
    
    if (results.length > 0) {
      const auditRows = results.map((r: AuditResult) => ({
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
          tribunal: r.tribunal,
          classe: r.metadata.classe,
          orgao: r.metadata.orgao,
          source: r.debug.source
        }
      }));

      await supabase.from('process_scans').upsert(auditRows, { onConflict: 'cnj' });

      for (const res of results) {
        if (res.localizado && res.mudancaDetectada) {
          const targetCase = validCases.find(c => c.protocolo === res.cnj);
          if (targetCase) {
             const check = detectarAtualizacaoPosRetorno(targetCase.ultimoRetorno, [{
               dataHora: res.dataUltimoEvento,
               nome: res.analysis.detalhes
             }]);

             if (check.alerta) {
                await supabase
                  .from('processos')
                  .update({ 
                    tem_atualizacao_pos_retorno: true,
                    datajud_ultimo_nome: res.analysis.detalhes,
                    datajud_ultimo_movimento: res.dataUltimoEvento,
                    datajud_consultado_em: res.dataAuditoria
                  })
                  .eq('protocolo_ref', res.cnj)
                  .eq('empresa_id', empresa_id);
             }
          }
        }
      }
    }

    return { success: true, processed: results.length, results: results };
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
    localizados: data.filter((d: any) => d.status !== 'Processo Não Localizado').length,
    naoLocalizados: data.filter((d: any) => d.status === 'Processo Não Localizado').length,
    mudancasDetectadas: data.filter((d: any) => d.metadata?.mudanca_detectada === true).length,
    semAlteracao: data.filter((d: any) => d.metadata?.mudanca_detectada === false).length,
    possivelEncerramento: data.filter((d: any) => d.metadata?.categoria === 'Possível encerramento').length,
    possivelArquivamento: data.filter((d: any) => d.metadata?.categoria === 'Possível arquivamento').length,
    emRecurso: data.filter((d: any) => d.metadata?.categoria === 'Em recurso').length,
    peticao: data.filter((d: any) => d.metadata?.categoria === 'Nova petição').length,
    publicacao: data.filter((d: any) => d.metadata?.categoria === 'Nova publicação').length,
    sentenca: data.filter((d: any) => d.metadata?.categoria === 'Nova sentença').length,
    parados30: data.filter((d: any) => d.metadata?.dias_parado >= 30 && d.metadata?.dias_parado < 90).length,
    parados90: data.filter((d: any) => d.metadata?.dias_parado >= 90 && d.metadata?.dias_parado < 180).length,
    parados180: data.filter((d: any) => d.metadata?.dias_parado >= 180).length,
  };
}
