'use server';
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v700.0 ELITE - NÚCLEO SYSTEM UNIFICADO
 * + observabilidade scan_metrics / alert_events / scan_priority
 */
import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
  updateCaseDataJudSystem,
  getSupabaseAdmin
} from '@/lib/server-db';
import { LegalCase, processarCaso, EventoTipo } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes, classifyEventFromText, summarizeDjenKeywords } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { isAfter, parse, isValid, parseISO } from 'date-fns';
import { logScanMetric, logAlertEvent } from '@/lib/scan-metrics';

/**
 * Helper para validar se uma data de evento ainda é posterior ao retorno humano.
 * Essencial para manter flags de novidade ativas até o atendimento.
 */
function movimentoAindaPosRetorno(dataEventoStr: string | null | undefined, ultimoRetornoStr: string | null | undefined): boolean {
  if (!dataEventoStr) return false;
  if (!ultimoRetornoStr || !String(ultimoRetornoStr).trim() || ultimoRetornoStr === '-' || ultimoRetornoStr === '0') return true;
  
  try {
    const dataEvento = parseISO(dataEventoStr);
    if (!isValid(dataEvento)) return true;
    
    const cleanStr = String(ultimoRetornoStr).trim();
    let dataRetorno: Date | undefined;
    
    if (cleanStr.includes('-') && cleanStr.length >= 10) {
      dataRetorno = parseISO(cleanStr.slice(0, 10));
    } else if (cleanStr.includes('/')) {
      dataRetorno = parse(cleanStr, 'dd/MM/yyyy', new Date());
    }
    
    if (dataRetorno && isValid(dataRetorno)) {
      const fimDoDiaRetorno = new Date(dataRetorno);
      fimDoDiaRetorno.setHours(23, 59, 59, 999);
      return isAfter(dataEvento, fimDoDiaRetorno);
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Pesos de Importância Jurídica para seleção de Capa.
 */
function getWeight(t: string | null | undefined): number {
  if (!t) return 0;
  const weights: Record<string, number> = {
    'ba': 100,
    'transito_ou_baixa': 90, 
    'transito_baixa': 90,
    'sentenca_procedente': 85, 
    'sentenca_improcedente': 85, 
    'sentenca_parcial': 84, 
    'liminar': 83,
    'audiencia_julgamento': 80, 
    'audiencia_instrucao': 79, 
    'audiencia_conciliacao': 78,
    'cancelamento_distribuicao': 75,
    'cumprimento_sentenca': 70,
    'novo_andamento_relevante': 50,
    'rotina': 10
  };
  return weights[t] || 0;
}

export async function fetchRepoCases() {
 
