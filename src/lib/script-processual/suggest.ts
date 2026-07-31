/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v2.2 - PROTOCOLO DE FIDELIDADE DE MÉRITO
 */

import { parseISO, parse, isAfter, isValid, startOfDay, format } from 'date-fns';
import { SCRIPT_CATALOG, ScriptTemplate } from './catalog';

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
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string; dataHora?: string }>;
}

const NON_ROUTINE_TERMS = [
  'PETIÇÃO', 'PETICAO', 'LIMINAR', 'SENTENÇA', 'SENTENCA', 'DECISÃO', 'DECISAO',
  'ACÓRDÃO', 'ACORDAO', 'AUDIÊNCIA', 'AUDIENCIA', 'ALVARÁ', 'ALVARA', 'PROCEDENTE', 'IMPROCEDENTE',
  'ACORDO', 'PERÍCIA', 'PERITO', 'PENHORA', 'CUMPRIMENTO', 'APELAÇÃO', 'APELACAO', 'CONTESTAÇÃO', 
  'CONTESTACAO', 'GRATUIDADE', 'TUTELA', 'BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'TRÂNSITO', 
  'TRANSITO', 'BAIXA DEFINITIVA', 'RÉPLICA', 'REPLICA', 'DECURSO', 'CITACAO', 'CITAÇÃO', 'SANEAMENTO', 
  'DESERTO', 'NÃO CONHECIDO', 'MAJORADOS', 'MAJORAÇÃO'
];

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const { clienteNome = 'Cliente', protocolo, ultimoRetorno, movimentos = [] } = input;
  
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const windowLimit = 25;
  const movsInWindow = sortedMovs.slice(0, windowLimit);

  if (movsInWindow.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    return fallback ? [createSuggestion(fallback, clienteNome, protocolo, ultimoRetorno, '')] : [];
  }

  const fullWindowText = movsInWindow.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  const matchedTemplates = new Map<string, { template: ScriptTemplate, recencia: number, dataMov: string }>();
  
  // REGRA DE OURO v2.2: Identificação de "Derrota/Falha Técnica" com precedência sobre "Baixa Neutra"
  const isLoss = /(IMPROCEDENTE|IMPROCEDÊNCIA|DESERTO|NÃO CONHECIDO|RECURSO NÃO CONHECIDO|FALTA DE PREPARO)/.test(fullWindowText);
  const isMajorado = /(MAJORADOS|MAJORAÇÃO|MAJORO)/.test(fullWindowText);

  movsInWindow.forEach((m, idx) => {
    const text = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    
    for (const template of SCRIPT_CATALOG) {
      if (template.keywords.some(kw => text.includes(kw))) {
        // Bloqueio de Baixa Neutra se houver indício de Derrota
        if (template.id === 'baixa_definitiva' && (isLoss || isMajorado)) continue;
        
        // Bloqueio de ritos intermediários se o processo já está em Baixa (P0)
        const hasP0Matched = Array.from(matchedTemplates.values()).some(match => match.template.prioridade === 0);
        if (hasP0Matched && template.prioridade > 0) continue;

        if (!matchedTemplates.has(template.id)) {
          matchedTemplates.set(template.id, { template, recencia: idx, dataMov: m.dataHora || '' });
        }
      }
    }
  });

  let finalMatches = Array.from(matchedTemplates.values());

  // Limpeza de ritos intermediários se houver um P0 (Encerramento)
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
  };
}
