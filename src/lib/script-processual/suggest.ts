/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v2.1 - ALGORITMO DE RECÊNCIA E RELEVÂNCIA
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
  'TRANSITO', 'BAIXA DEFINITIVA', 'RÉPLICA', 'REPLICA', 'DECURSO', 'CITACAO', 'CITAÇÃO', 'SANEAMENTO', 'EMBARGOS'
];

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const { clienteNome = 'Cliente', protocolo, ultimoRetorno, movimentos = [] } = input;
  
  // 1. Preparação e Ordenação DESC
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  // Parse do último retorno para comparação temporal (date-only)
  let dateRetorno: Date | null = null;
  if (ultimoRetorno) {
    const cleanStr = ultimoRetorno.trim();
    try {
      if (cleanStr.includes('/')) {
        dateRetorno = startOfDay(parse(cleanStr, 'dd/MM/yyyy', new Date()));
      } else {
        dateRetorno = startOfDay(parseISO(cleanStr));
      }
    } catch (e) { dateRetorno = null; }
  }

  // 2. Janela de Análise (Até 20 movimentos)
  const windowLimit = 20;
  const movsInWindow = sortedMovs.slice(0, windowLimit);

  if (movsInWindow.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    return fallback ? [createSuggestion(fallback, clienteNome, protocolo, ultimoRetorno)] : [];
  }

  // 3. Verificação de "Apenas Rotina" (Regra de Carência)
  const allRoutine = movsInWindow.every(m => {
    const text = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    return !NON_ROUTINE_TERMS.some(kw => text.includes(kw));
  });

  if (allRoutine && dateRetorno && isValid(dateRetorno)) {
    const template = SCRIPT_CATALOG.find(s => s.id === 'rotina_pos_retorno');
    if (template) return [createSuggestion(template, clienteNome, protocolo, ultimoRetorno)];
  }

  // 4. Coleta de Correspondências com Regra de Recência (Recency Cap)
  const matchedTemplates = new Map<string, { template: ScriptTemplate, recencia: number, dataMov: string }>();
  
  const fullWindowText = movsInWindow.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  // A. Caso Especial: Liminar + JG Combinado
  const hasLiminar = fullWindowText.includes('LIMINAR') || fullWindowText.includes('TUTELA');
  const hasJG = /(JUSTIÇA GRATUITA|ASSISTÊNCIA JUDICIÁRIA|GRATUIDADE)/.test(fullWindowText);
  if (hasLiminar && hasJG) {
    const combined = SCRIPT_CATALOG.find(s => s.id === 'liminar_e_jg');
    if (combined) matchedTemplates.set(combined.id, { template: combined, recencia: -1, dataMov: movsInWindow[0]?.dataHora || '' });
  }

  // B. Varredura Geral com Regra de Recência para P3+
  movsInWindow.forEach((m, idx) => {
    const text = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    
    for (const template of SCRIPT_CATALOG) {
      if (template.id === 'rotina_pos_retorno' || template.id === 'liminar_e_jg') continue;
      
      // REGRA DE OURO v2.1: Eventos de prioridade Média/Baixa (P3, P4, P5) 
      // só são considerados se forem MUITO recentes (top 5 movimentos).
      if (template.prioridade >= 3 && idx >= 5) continue;

      // Conflito Específico vs Neutro (Deferida/Indeferida sempre vencem Analisada)
      if (template.keywords.some(kw => text.includes(kw))) {
        if (template.id === 'liminar_analisada' && (fullWindowText.includes('DEFERIDA') || fullWindowText.includes('INDEFERIDA'))) continue;
        if (template.id === 'justica_gratuita' && (fullWindowText.includes('INDEFERIDA') || fullWindowText.includes('INDEFERIMENTO'))) continue;
        if (matchedTemplates.has('liminar_e_jg') && ['liminar_analisada', 'justica_gratuita'].includes(template.id)) continue;

        if (!matchedTemplates.has(template.id)) {
          matchedTemplates.set(template.id, { template, recencia: idx, dataMov: m.dataHora || '' });
        }
      }
    }
  });

  // 5. Ordenação e Filtro Anti-Ruído
  let finalMatches = Array.from(matchedTemplates.values());

  // REGRA DE OURO v2.1 (TRAVA P0): Se houver encerramento (P0), bloqueia TODA a sujeira intermediária.
  const hasP0 = finalMatches.some(m => m.template.prioridade === 0);
  if (hasP0) {
    finalMatches = finalMatches.filter(m => m.template.prioridade === 0);
  } else {
    // Anti-ruído padrão (se prioridade <= 2, remove rotinas)
    if (finalMatches.some(m => m.template.prioridade <= 2)) {
      finalMatches = finalMatches.filter(m => m.template.id !== 'rotina' && m.template.id !== 'rotina_pos_retorno');
    }
  }

  finalMatches.sort((a, b) => {
    if (a.template.prioridade !== b.template.prioridade) {
      return a.template.prioridade - b.template.prioridade;
    }
    return a.recencia - b.recencia;
  });

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
      .replace(/\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, displayRetorno)
      .replace(/\[DataMov\]/g, displayMov || 'recentemente')
  };
}
