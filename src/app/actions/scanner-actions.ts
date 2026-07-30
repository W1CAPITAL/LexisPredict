'use server';

/**
 * @fileOverview Server Actions do Motor de Auditoria Consolidada v9.0
 * Instrumentação de rastreio para identificação de interrupções.
 */

import { ScannerService, AuditResult } from '@/modules/process-scanner/services/scanner-service';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { detectarAtualizacaoPosRetorno } from '@/lib/datajud-sync';

export async function startFullScannerJobAction() {
  console.log("\n[ACTION] Scanner iniciado");
  
  const { empresa_id, auth_id } = await getUserContext();
  if (!empresa_id) {
    console.error("[ACTION] Falha: Sessão expirada.");
    return { success: false, error: "401_SESSAO_EXPIRADA" };
  }

  try {
    console.log("[ACTION] Banco conectado. Buscando carteira...");
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const validCases = cases.filter(c => c.protocolo && c.protocolo.length >= 8);

    console.log(`[ACTION] Quantidade de processos encontrada: ${validCases.length}`);

    if (validCases.length === 0) {
      return { success: true, processed: 0, message: "Nenhum processo para auditoria." };
    }

    const scanner = new ScannerService();
    // O rito scanLoteInteligente já possui logs internos para cada processo
    const results = await scanner.scanLoteInteligente(validCases);

    console.log("[ACTION] Gravando resultados no repositório de auditoria...");
    const supabase = await createClient();
    
    if (results.length > 0) {
      const auditRows = results.map(r => ({
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

      const { error: upsertError } = await supabase.from('process_scans').upsert(auditRows, { onConflict: 'cnj' });
      if (upsertError) {
        console.error("[ACTION] Erro ao salvar auditoria:", upsertError.message);
      } else {
        console.log("[ACTION] Processo salvo no banco com sucesso.");
      }

      // Sincronia Reativa
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

    console.log("[ACTION] Job de Scanner concluído com sucesso.");
    return { 
      success: true, 
      processed: results.length,
      results: results,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("[ACTION] Falha crítica no fluxo do scanner:", error.message);
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
    emRecurso: data.filter(d => d.metadata?.categoria === 'Em recurso').length,
    peticao: data.filter(d => d.metadata?.categoria === 'Nova petição').length,
    publicacao: data.filter(d => d.metadata?.categoria === 'Nova publicação').length,
    sentenca: data.filter(d => d.metadata?.categoria === 'Nova sentença').length,
    parados30: data.filter(d => d.metadata?.dias_parado >= 30 && d.metadata?.dias_parado < 90).length,
    parados90: data.filter(d => d.metadata?.dias_parado >= 90 && d.metadata?.dias_parado < 180).length,
    parados180: data.filter(d => d.metadata?.dias_parado >= 180).length,
  };
}
