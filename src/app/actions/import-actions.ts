
'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/server-db';
import { parse } from 'csv-parse/sync';
import { processarCaso, formatDateToISO } from '@/lib/case-logic';

interface CsvRow {
  [key: string]: string;
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Motor de Ingestão P0: Separa Situação da Planilha do Status de Prazo do App.
 * Agora com resolução automática de ASSISTENTE para isolamento de perfil.
 */
export async function importCsvAction(csvText: string) {
  try {
    const { empresa_id, auth_id } = await getUserContext();

    if (!empresa_id || !auth_id) {
      return { success: false, error: 'Sessão administrativa expirada. Refaça o login.' };
    }

    const records: CsvRow[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    });

    if (!records || records.length === 0) {
      return { success: false, error: 'Arquivo vazio ou formato incompatível.' };
    }

    const supabase = await createClient();

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

    records.forEach((row) => {
      const rawData: any = {};
      Object.keys(row).forEach(k => {
        const key = normalizeHeader(k);
        rawData[key] = row[k];
      });

      rawData['STATUS_MANUAL'] = 'Automatico';

      const caso = processarCaso(rawData, { alertLimit });

      if (caso.protocolo && caso.protocolo.length >= 8) {
        const isoPrazo = formatDateToISO(caso.proximoPrazo);
        const isoRetorno = formatDateToISO(caso.ultimoRetorno);

        const assistantKey = normalizeHeader(rawData['ASSISTENTE'] || rawData['ATENDENTE'] || '');
        const assistantName = String(rawData[assistantKey] || rawData['ASSISTENTE'] || rawData['ATENDENTE'] || '').trim().toUpperCase();
        
        const resolvedCreatedBy = userLookup.get(assistantName) || auth_id;

        const dbRow = {
          empresa_id: empresa_id,
          created_by: resolvedCreatedBy,
          protocolo_ref: caso.protocolo,
          advogado: caso.advogado,
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
      }
    });

    const uniqueRows = Array.from(byProto.values());

    if (uniqueRows.length === 0) {
      return { success: false, error: 'Nenhum protocolo válido identificado no arquivo.' };
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
      return { success: false, error: 'Falha na gravação dos dados processados.' };
    }

    return {
      success: true,
      imported: data?.length || uniqueRows.length,
      message: `${data?.length || uniqueRows.length} processos sincronizados e distribuídos entre os assistentes.`,
    };
  } catch (err: any) {
    console.error('[Import Critical]', err);
    return { success: false, error: 'Erro crítico no processamento neural da planilha.' };
  }
}
