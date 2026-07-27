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
 * Agora utilizando o CSV Import Engine centralizado para mapeamento canônico.
 */
export async function importCsvAction(csvText: string) {
  try {
    const { empresa_id, auth_id } = await getUserContext();

    if (!empresa_id || !auth_id) {
      return { success: false, error: 'Sessão administrativa expirada. Refaça o login.' };
    }

    // Detecção inteligente de separador
    const firstLine = csvText.split('\n')[0] || '';
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const records: any[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
      delimiter
    });

    if (!records || records.length === 0) {
      return { success: false, error: 'Arquivo vazio ou formato incompatível.' };
    }

    const supabase = await createClient();

    // Lookup de usuários para distribuição
    const { data: companyUsers } = await supabase
      .from('usuarios')
      .select('auth_user_id, nome')
      .eq('empresa_id', empresa_id);

    const userLookup = new Map<string, string>();
    companyUsers?.forEach(u => {
      if (u.nome) {
        userLookup.set(u.nome.trim().toUpperCase(), u.auth_user_id);
      }
    });

    const alertLimit = 3; 
    const byProto = new Map();
    let imported = 0;
    let skipped = 0;
    const skipReasons: Record<string, number> = { 'PROTOCOLO_INVALIDO': 0 };

    records.forEach((row) => {
      const canonical = mapCsvRowToCanonical(row);
      
      // Sanitização de Entrada
      const cleanProtocolo = sanitizeProtocolo(canonical.protocolo);
      const cleanRetorno = sanitizeDateCell(canonical.ultimoRetorno);
      const cleanPrazo = sanitizeDateCell(canonical.proximoPrazo);

      if (!cleanProtocolo || cleanProtocolo.length < 8) {
        skipped++;
        skipReasons['PROTOCOLO_INVALIDO']++;
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
      const assistantName = canonical.assistente.trim().toUpperCase();
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
    });

    const uniqueRows = Array.from(byProto.values());

    if (uniqueRows.length === 0) {
      return { 
        success: false, 
        error: 'Nenhum protocolo válido identificado no arquivo.',
        skipped,
        skipReasons: Object.entries(skipReasons).map(([reason, count]) => ({ reason, count }))
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
      return { success: false, error: 'Falha na gravação dos dados processados no repositório.' };
    }

    imported = data?.length || uniqueRows.length;

    return {
      success: true,
      imported,
      skipped,
      skipReasons: Object.entries(skipReasons).map(([reason, count]) => ({ reason, count })),
      message: `${imported} registros sincronizados. ${skipped > 0 ? `${skipped} ignorados por inconsistência.` : ''}`,
    };
  } catch (err: any) {
    console.error('[Import Critical]', err);
    return { success: false, error: 'Erro crítico no processamento neural da planilha.' };
  }
}
