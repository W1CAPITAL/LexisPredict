'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/server-db';
import { parse } from 'csv-parse/sync';
import { processarCaso, formatDateToISO } from '@/lib/case-logic';
import { mapCsvRowToCanonical, sanitizeDateCell, sanitizeProtocolo } from '@/lib/csv-import-engine';

/**
 * Motor de Ingestão P0: Padrão Enterprise
 * Agora com feedback detalhado de auditoria e tratamento resiliente de linhas.
 */
export async function importCsvAction(csvText: string) {
  try {
    const { empresa_id, auth_id } = await getUserContext();

    if (!empresa_id || !auth_id) {
      return { 
        success: false, 
        imported: 0, 
        skipped: 0, 
        skipReasons: [],
        message: 'Sessão administrativa expirada. Refaça o login.' 
      };
    }

    // Detecção inteligente de separador
    const firstLine = csvText.split('\n')[0] || '';
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    let records: any[] = [];
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
        delimiter
      });
    } catch (e) {
      return { 
        success: false, 
        imported: 0, 
        skipped: 0, 
        skipReasons: [],
        message: 'Falha no parsing do arquivo. Verifique se o formato CSV está correto.' 
      };
    }

    if (!records || records.length === 0) {
      return { 
        success: false, 
        imported: 0, 
        skipped: 0, 
        skipReasons: [],
        message: 'Arquivo vazio ou sem cabeçalhos válidos.' 
      };
    }

    const supabase = await createClient();

    // Lookup de usuários para distribuição
    const { data: companyUsers } = await supabase
      .from('usuarios')
      .select('auth_user_id, nome')
      .eq('empresa_id', empresa_id);

    const userLookup = new Map<string, string>();
    companyUsers?.forEach((u: { auth_user_id: string; nome: string | null }) => {
      if (u.nome) {
        userLookup.set(u.nome.trim().toUpperCase(), u.auth_user_id);
      }
    });

    const alertLimit = 3; 
    const byProto = new Map();
    let importedCount = 0;
    let skippedCount = 0;
    const skipReasonsMap: Record<string, number> = {};

    const addSkip = (reason: string) => {
      skippedCount++;
      skipReasonsMap[reason] = (skipReasonsMap[reason] || 0) + 1;
    };

    records.forEach((row) => {
      try {
        const canonical = mapCsvRowToCanonical(row);
        
        // Sanitização de Entrada
        const cleanProtocolo = sanitizeProtocolo(canonical.protocolo);
        const cleanRetorno = sanitizeDateCell(canonical.ultimoRetorno);
        const cleanPrazo = sanitizeDateCell(canonical.proximoPrazo);

        // Validação Mínima
        if (!cleanProtocolo || cleanProtocolo.length < 8) {
          addSkip('PROTOCOLO_INVALIDO');
          return;
        }

        if (!canonical.cliente && !cleanProtocolo) {
          addSkip('LINHA_VAZIA');
          return;
        }

        const caso = processarCaso({
          ...canonical,
          protocolo: cleanProtocolo,
          ultimoRetorno: cleanRetorno,
          proximoPrazo: cleanPrazo,
          statusManual: 'Automatico'
        }, { alertLimit });

        const isoPrazo = formatDateToISO(caso.proximoPrazo);
        const isoRetorno = formatDateToISO(caso.ultimoRetorno);

        // Resolução de Assistente Responsável
        const assistantName = (canonical.assistente || '').trim().toUpperCase();
        const resolvedCreatedBy = userLookup.get(assistantName) || auth_id;

        const dbRow = {
          empresa_id: empresa_id,
          created_by: resolvedCreatedBy,
          protocolo_ref: caso.protocolo,
          advogado: caso.advogado,
          escritorio: caso.escritorio || null,
          status: caso.status,
          risco: caso.risco,
          tribunal: caso.tribunal,
          telefone: caso.telefone,
          status_interno: caso.situacao,
          observacoes: caso.observacao,
          ultimo_retorno: isoRetorno,
          proximo_retorno: isoPrazo,
          dados: { ...caso }
        };

        byProto.set(caso.protocolo, dbRow);
      } catch (e) {
        addSkip('ERRO_PROCESSAMENTO');
      }
    });

    const uniqueRows = Array.from(byProto.values());

    if (uniqueRows.length === 0) {
      return { 
        success: false, 
        imported: 0, 
        skipped: skippedCount,
        skipReasons: Object.entries(skipReasonsMap).map(([reason, count]) => ({ reason, count })),
        message: 'Nenhum registro válido identificado no arquivo.'
      };
    }

    const { data, error } = await supabase
      .from('processos')
      .upsert(uniqueRows, {
        onConflict: 'protocolo_ref,empresa_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      console.error('[Import DB Error]', error);
      return { 
        success: false, 
        imported: 0, 
        skipped: records.length,
        skipReasons: [{ reason: 'ERRO_BANCO_DADOS', count: records.length }],
        message: 'Falha na gravação dos dados no repositório.' 
      };
    }

    importedCount = data?.length || uniqueRows.length;
    const skipSummary = Object.entries(skipReasonsMap)
      .map(([reason, count]) => `${count} ${reason.toLowerCase().replace('_', ' ')}`)
      .join(', ');

    return {
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      skipReasons: Object.entries(skipReasonsMap).map(([reason, count]) => ({ reason, count })),
      message: `${importedCount} processos sincronizados.${skippedCount > 0 ? ` ${skippedCount} ignorados (${skipSummary}).` : ''}`,
    };
  } catch (err: any) {
    console.error('[Import Critical]', err);
    return { 
      success: false, 
      imported: 0, 
      skipped: 0, 
      skipReasons: [],
      message: 'Erro crítico no processamento neural da planilha.' 
    };
  }
}