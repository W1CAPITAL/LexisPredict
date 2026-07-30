'use server';

/**
 * @fileOverview Server Actions do Módulo Process Scanner v1.1
 * Ponte de execução entre a UI soberana e o serviço MNI Inteligente.
 */

import { ScannerService, MNIProcessResult } from '@/modules/process-scanner/services/scanner-service';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';

export async function startFullScannerJobAction() {
  const { empresa_id } = await getUserContext();
  
  if (!empresa_id) {
    return { success: false, error: "401_SESSAO_EXPIRADA" };
  }

  try {
    // Recupera CNJs e Datas de Retorno para o lote inicial
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const validCases = cases.filter(c => c.protocolo.length >= 20);

    if (validCases.length === 0) {
      return { success: true, processed: 0, message: "Nenhum CNJ válido para processamento." };
    }

    const scanner = new ScannerService();
    const results = await scanner.scanLoteInteligente(validCases);

    // Persistência em Tabela Espelhada (process_scans)
    // Para não alterar o banco existente, salvamos as descobertas úteis em process_scans
    const supabase = await createClient();
    
    if (results.length > 0) {
      const rows = results.map(r => ({
        empresa_id: empresa_id,
        cnj: r.cnj,
        status: r.statusUtil,
        last_sync: new Date().toISOString(),
        metadata: {
          ultimo_evento: r.ultimoEventoNome,
          data_evento: r.dataEvento,
          categoria: r.analysis.categoria,
          necessita_retorno: r.necessitaRetorno
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
    console.error("[Scanner Action Fail]", error.message);
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

  const stats = {
    total: data.length,
    semAndamento: data.filter(d => d.status === 'SEM NOVOS ANDAMENTOS').length,
    novoAndamento: data.filter(d => d.status === 'HOUVE NOVO ANDAMENTO').length,
    encerrados: data.filter(d => d.status === 'PROCESSO ENCERRADO').length,
    emRecurso: data.filter(d => d.metadata?.categoria === 'EM RECURSO').length,
    publicacao: data.filter(d => d.metadata?.categoria === 'NOVA PUBLICAÇÃO').length,
    peticao: data.filter(d => d.metadata?.categoria === 'NOVA PETIÇÃO').length,
    comPrazo: data.filter(d => d.metadata?.categoria === 'COM PRAZO').length,
  };

  return stats;
}
