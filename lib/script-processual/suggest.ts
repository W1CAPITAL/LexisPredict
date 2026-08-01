/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v3.5 - FIDELIDADE DE MÉRITO E PROTEÇÃO DE PASSIVO
 */

import { parseISO, parse, isAfter, isValid, startOfDay, format } from 'date-fns';
import { SCRIPT_CATALOG, ScriptTemplate } from './catalog';
import { EventoTipo } from '../case-logic';

export interface ScriptSuggestion {
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
}

export interface ScriptInput {
  clienteNome?: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  eventoTipo?: EventoTipo | null;
  eventoResumo?: string | null;
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string; dataHora?: string }>;
  djenTexts?: string[];
}

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const { clienteNome = 'Cliente', protocolo, ultimoRetorno, movimentos = [], eventoTipo, eventoResumo, djenTexts = [] } = input;
  
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  // 1. Mapeamento Direto por Evento Unificado (Prioridade Máxima)
  if (eventoTipo && eventoTipo !== 'rotina') {
    const matched = SCRIPT_CATALOG.find(s => s.categoria === mapEventoToCategoria(eventoTipo));
    if (matched) {
      return [createSuggestion(matched, clienteNome, protocolo, ultimoRetorno, sortedMovs[0]?.dataHora || '')];
    }
  }

  // 2. Análise de Janela de Movimentos + DJEN (Fallback Heurístico)
  const windowLimit = 30;
  const movsInWindow = sortedMovs.slice(0, windowLimit);

  const fullWindowText = (eventoResumo || "") + " || " + djenTexts.join(" || ") + " || " + movsInWindow.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  if (!fullWindowText.trim() && movsInWindow.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    return fallback ? [createSuggestion(fallback, clienteNome, protocolo, ultimoRetorno, '')] : [];
  }

  const matchedTemplates = new Map<string, { template: ScriptTemplate, recencia: number, dataMov: string }>();
  
  const isLoss = /(IMPROCEDENTE|IMPROCEDÊNCIA|DESERTO|NÃO CONHECIDO|RECURSO NÃO CONHECIDO|FALTA DE PREPARO)/.test(fullWindowText);
  const isReversal = /(REFORMA DA SENTENÇA|REFORMAR A RESPEITÁVEL SENTENÇA|DAR PROVIMENTO AO RECURSO)/.test(fullWindowText);
  const hasGratuidade = /(GRATUIDADE DA JUSTIÇA|ASSISTÊNCIA JUDICIÁRIA GRATUITA|JG DEFERIDA|GRATUIDADE DEFERIDA|CONCEDIDA A GRATUIDADE)/.test(fullWindowText);

  movsInWindow.forEach((m, idx) => {
    const text = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    
    for (const template of SCRIPT_CATALOG) {
      if (template.id === 'baixa_reversao_derrota' && !isReversal) continue;
      if (template.id === 'baixa_derrota_jg' && (!isLoss || !hasGratuidade)) continue;
      if (template.id === 'baixa_definitiva' && (isLoss || isReversal)) continue;

      if (template.keywords.some(kw => text.includes(kw))) {
        const hasP0Matched = Array.from(matchedTemplates.values()).some(match => match.template.prioridade === 0);
        if (hasP0Matched && template.prioridade > 0) continue;

        if (!matchedTemplates.has(template.id)) {
          matchedTemplates.set(template.id, { template, recencia: idx, dataMov: m.dataHora || '' });
        }
      }
    }
  });

  let finalMatches = Array.from(matchedTemplates.values());
  if (finalMatches.some(m => m.template.prioridade === 0)) {
    finalMatches = finalMatches.filter(m => m.template.prioridade === 0);
  }

  finalMatches.sort((a, b) => a.template.prioridade - b.template.prioridade || a.recencia - b.recencia);

  if (finalMatches.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    if (fallback) finalMatches.push({ template: fallback, recencia: 0, dataMov: movsInWindow[0]?.dataHora || '' });
  }

  return finalMatches.slice(0, 3).map(m => createSuggestion(m.template, clienteNome, protocolo, ultimoRetorno, m.dataMov));
}

function mapEventoToCategoria(tipo: EventoTipo): string {
  switch (tipo) {
    case 'sentenca_procedente':
    case 'sentenca_improcedente':
    case 'sentenca_parcial': return 'sentenca';
    case 'ba': return 'ba';
    case 'audiencia_conciliacao':
    case 'audiencia_instrucao':
    case 'audiencia_julgamento': return 'audiencia';
    case 'transito_ou_baixa': return 'baixa';
    case 'liminar': return 'liminar';
    default: return 'rotina';
  }
}

function createSuggestion(s: ScriptTemplate, nome: string, cnj: string, dateRetornoStr: string | null | undefined, dataMovStr: string): ScriptSuggestion {
  let displayRetorno = 'últimos dias';
  let displayMov = '';

  if (dateRetornoStr) {
    try {
      const cleanStr = dateRetornoStr.trim();
      const d = cleanStr.includes('/') ? parse(cleanStr, 'dd/MM/yyyy', new Date()) : parseISO(cleanStr);
      if (isValid(d)) displayRetorno = format(d, 'dd/MM/yyyy');
    } catch (e) {}
  }

  if (dataMovStr) {
    try {
      const d = parseISO(dataMovStr);
      if (isValid(d)) displayMov = format(d, 'dd/MM/yyyy');
    } catch (e) {}
  }

  return {
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[Nome\]/g, nome)
      .replace(/\[CLIENTE\]/g, nome)
      .replace(/\[CNJ\]/g, cnj)
      .replace(/\[PROTOCOLO\]/g, cnj)
      .replace(/\[Data\]/g, displayRetorno)
      .replace(/\[DataMov\]/g, displayMov || 'recentemente')
      .replace(/\[BANCO\]/g, "Instituição Financeira")
  };
}