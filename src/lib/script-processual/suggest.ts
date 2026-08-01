/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v4.1 - HIERARQUIA DE EVENTO E FIDELIDADE UNIFICADA
 */

import { parseISO, parse, isValid, format } from 'date-fns';
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
  // Flags Operacionais (Prioridade Máxima)
  tem_novo_andamento?: boolean;
  datajud_encerrado_tribunal?: boolean;
  indicio_busca_apreensao?: boolean;
  em_cumprimento_sentenca?: boolean;
}

/**
 * Motor de Sugestão Inteligente. 
 * Hierarquia: 1. Flags Críticas | 2. Tipo de Evento | 3. Keywords | 4. Fallback
 */
export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const { 
    clienteNome = 'Cliente', 
    protocolo, 
    ultimoRetorno, 
    movimentos = [], 
    eventoTipo, 
    eventoResumo, 
    djenTexts = [],
    tem_novo_andamento,
    datajud_encerrado_tribunal,
    indicio_busca_apreensao,
    em_cumprimento_sentenca
  } = input;
  
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const matchedTemplates = new Map<string, { template: ScriptTemplate, dataMov: string }>();

  // 1. NIVEL A: FLAGS E EVENTO TIPO (Peso Máximo - FIDELIDADE DE MÉRITO)
  if (indicio_busca_apreensao || eventoTipo === 'ba') {
    addMatch(matchedTemplates, 'alerta_busca_apreensao', sortedMovs[0]?.dataHora || '');
  }

  if (datajud_encerrado_tribunal || eventoTipo === 'transito_baixa' || eventoTipo === 'transito_ou_baixa') {
    addMatch(matchedTemplates, 'possivel_baixa_tribunal', sortedMovs[0]?.dataHora || '');
  }

  // Mapeamento direto de mérito para evitar mistura de Procedente/Improcedente
  if (eventoTipo === 'sentenca_procedente') {
    addMatch(matchedTemplates, 'sentenca_procedente', sortedMovs[0]?.dataHora || '');
  } else if (eventoTipo === 'sentenca_improcedente') {
    addMatch(matchedTemplates, 'sentenca_improcedente', sortedMovs[0]?.dataHora || '');
  } else if (eventoTipo === 'liminar') {
    addMatch(matchedTemplates, 'liminar_concedida', sortedMovs[0]?.dataHora || '');
  } else if (eventoTipo === 'cumprimento_sentenca' || em_cumprimento_sentenca) {
    addMatch(matchedTemplates, 'cumprimento_sentenca', sortedMovs[0]?.dataHora || '');
  }

  if (tem_novo_andamento && matchedTemplates.size < 3) {
    addMatch(matchedTemplates, 'movimentacao_pos_retorno', sortedMovs[0]?.dataHora || '');
  }

  // 2. NIVEL B: KEYWORDS (Reforço - Ordenado por Prioridade Numérica)
  if (matchedTemplates.size < 3) {
    const fullText = `${eventoResumo || ''} ${djenTexts.join(' ')} ${movimentos.map(m => m.nome).join(' ')}`.toUpperCase();
    
    const catalogSorted = [...SCRIPT_CATALOG].sort((a, b) => a.prioridade - b.prioridade);

    for (const template of catalogSorted) {
      if (matchedTemplates.has(template.id)) continue;
      if (template.keywords.length > 0 && template.keywords.some(kw => fullText.includes(kw))) {
        addMatch(matchedTemplates, template.id, sortedMovs[0]?.dataHora || '');
      }
      if (matchedTemplates.size >= 3) break;
    }
  }

  // 3. FALLBACK: ROTINA
  if (matchedTemplates.size === 0) {
    addMatch(matchedTemplates, 'rotina', sortedMovs[0]?.dataHora || '');
  }

  return Array.from(matchedTemplates.values())
    .map(m => createSuggestion(m.template, clienteNome, protocolo, ultimoRetorno, m.dataMov));
}

function addMatch(map: Map<string, any>, templateId: string, dataMov: string) {
  const template = SCRIPT_CATALOG.find(s => s.id === templateId);
  if (template) map.set(templateId, { template, dataMov });
}

function createSuggestion(s: ScriptTemplate, nome: string, cnj: string, dateRetornoStr: string | null | undefined, dataMovStr: string): ScriptSuggestion {
  let displayRetorno = 'nos últimos dias';
  let displayMov = 'recentemente';

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
      .replace(/\[DataMov\]/g, displayMov)
  };
}
