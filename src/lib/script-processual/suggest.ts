/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v1.7 - ANÁLISE PROFUNDA E ANTI-RUÍDO
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

  // 2. Definição da Janela de Análise (Mínimo 10, Máximo 20 ou Pós-Retorno)
  const windowLimit = 20;
  const movsInWindow = sortedMovs.filter((m, idx) => {
    if (idx < 10) return true; 
    if (idx >= windowLimit) return false;
    if (dateRetorno && isValid(dateRetorno) && m.dataHora) {
       return isAfter(parseISO(m.dataHora), dateRetorno);
    }
    return true;
  });

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

  // 4. Coleta de Correspondências (Deduplicada por ID)
  const matchedTemplates = new Map<string, { template: ScriptTemplate, recencia: number }>();
  
  const fullWindowText = movsInWindow.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  // --- CASOS ESPECIAIS E PREFERÊNCIAS ---
  
  // A. Liminar + JG Combinado (Vence individuais)
  const hasLiminar = fullWindowText.includes('LIMINAR') || fullWindowText.includes('TUTELA');
  const hasJG = /(JUSTIÇA GRATUITA|ASSISTÊNCIA JUDICIÁRIA|GRATUIDADE)/.test(fullWindowText);
  
  if (hasLiminar && hasJG) {
    const combined = SCRIPT_CATALOG.find(s => s.id === 'liminar_e_jg');
    if (combined) matchedTemplates.set(combined.id, { template: combined, recencia: -1 });
  }

  // Varredura Geral
  movsInWindow.forEach((m, idx) => {
    const text = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    
    for (const template of SCRIPT_CATALOG) {
      // Ignora templates automáticos ou já processados no caso especial
      if (template.id === 'rotina_pos_retorno' || template.id === 'liminar_e_jg') continue;
      
      // Conflito Liminar/JG: Se já temos o combinado, ignora as partes individuais
      if (matchedTemplates.has('liminar_e_jg')) {
        if (['liminar_analisada', 'justica_gratuita', 'liminar_deferida', 'liminar_indeferida'].includes(template.id)) continue;
      }

      // Conflito Específico vs Neutro: liminar_deferida vence liminar_analisada
      if (template.keywords.some(kw => text.includes(kw))) {
        // Se for neutro mas já temos específico na janela, pula
        if (template.id === 'liminar_analisada' && (fullWindowText.includes('DEFERIDA') || fullWindowText.includes('INDEFERIDA'))) continue;
        if (template.id === 'justica_gratuita' && (fullWindowText.includes('INDEFERIDA') || fullWindowText.includes('INDEFERIMENTO'))) continue;

        if (!matchedTemplates.has(template.id)) {
          matchedTemplates.set(template.id, { template, recencia: idx });
        }
      }
    }
  });

  // 5. Filtro Anti-Ruído e Ordenação
  let finalMatches = Array.from(matchedTemplates.values());

  // Regra Anti-Ruído: Se houver P0-P2, remove scripts de rotina pura
  if (finalMatches.some(m => m.template.prioridade <= 2)) {
    finalMatches = finalMatches.filter(m => m.template.id !== 'rotina' && m.template.id !== 'rotina_pos_retorno');
  }

  // Ordenação: Prioridade ASC, Recência ASC (idx menor = mais recente)
  finalMatches.sort((a, b) => {
    if (a.template.prioridade !== b.template.prioridade) {
      return a.template.prioridade - b.template.prioridade;
    }
    return a.recencia - b.recencia;
  });

  // Fallback final
  if (finalMatches.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    if (fallback) finalMatches.push({ template: fallback, recencia: 0 });
  }

  return finalMatches.slice(0, 3).map(m => createSuggestion(m.template, clienteNome, protocolo, ultimoRetorno));
}

function createSuggestion(s: ScriptTemplate, nome: string, cnj: string, dateStr: string | null | undefined): ScriptSuggestion {
  let displayDate = 'últimos dias';
  if (dateStr) {
    try {
      const cleanStr = dateStr.trim();
      const d = cleanStr.includes('/') ? parse(cleanStr, 'dd/MM/yyyy', new Date()) : parseISO(cleanStr);
      if (isValid(d)) displayDate = format(d, 'dd/MM/yyyy');
    } catch (e) {}
  }

  return {
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[Nome\]/g, nome)
      .replace(/\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, displayDate)
  };
}
