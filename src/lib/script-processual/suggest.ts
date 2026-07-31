/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v1.4 - ANÁLISE UNIVERSAL EM JANELA
 */

import { parseISO, parse, isAfter, isValid, startOfDay } from 'date-fns';
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

const ROUTINE_KEYWORDS = [
  'ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'DISPONIBILIZAÇÃO', 
  'PUBLICAÇÃO', 'REMESSA', 'RECEBIMENTO', 'MOVIMENTAÇÃO NÃO IDENTIFICADA',
  'AUTOS NO CARTÓRIO', 'RECEBIDOS OS AUTOS', 'INCLUSÃO NO JUÍZO DIGITAL'
];

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const { clienteNome = 'Cliente', protocolo, ultimoRetorno, movimentos = [] } = input;
  
  // 1. Preparação e Ordenação
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  // Parse do último retorno para comparação temporal
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

  // 2. Definição da Janela de Análise (Até 20 movimentos ou todos pós-retorno)
  const windowLimit = 20;
  const movsInWindow = sortedMovs.filter((m, idx) => {
    if (idx < 10) return true; // Mínimo de 10 para segurança
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
    return ROUTINE_KEYWORDS.some(kw => text.includes(kw)) && 
           !text.includes('PETIÇÃO') && !text.includes('LIMINAR') && !text.includes('SENTENÇA');
  });

  if (allRoutine && dateRetorno && isValid(dateRetorno)) {
    const template = SCRIPT_CATALOG.find(s => s.id === 'rotina_pos_retorno');
    if (template) return [createSuggestion(template, clienteNome, protocolo, ultimoRetorno)];
  }

  // 4. Coleta de Correspondências na Janela
  const matches: ScriptTemplate[] = [];
  const matchedIds = new Set<string>();
  const fullWindowText = movsInWindow.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  // Caso Especial: Liminar + JG na mesma janela
  const hasLiminar = fullWindowText.includes('LIMINAR') || fullWindowText.includes('TUTELA');
  const hasJG = /(JUSTIÇA GRATUITA|ASSISTÊNCIA JUDICIÁRIA|GRATUIDADE)/.test(fullWindowText);
  
  if (hasLiminar && hasJG) {
    const template = SCRIPT_CATALOG.find(s => s.id === 'liminar_e_jg');
    if (template) {
      matches.push(template);
      matchedIds.add('liminar_analisada');
      matchedIds.add('justica_gratuita');
    }
  }

  // Varredura Geral
  for (const template of SCRIPT_CATALOG) {
    if (template.id === 'rotina_pos_retorno' || matchedIds.has(template.id)) continue;
    
    if (template.keywords.some(kw => fullWindowText.includes(kw))) {
      matches.push(template);
      matchedIds.add(template.id);
    }
  }

  // 5. Refino e Anti-Ruído
  let finalMatches = matches.sort((a, b) => a.prioridade - b.prioridade);

  // Se houver P0-P2, remove "rotina" para evitar poluição
  if (finalMatches.some(m => m.prioridade <= 2)) {
    finalMatches = finalMatches.filter(m => m.id !== 'rotina' && m.id !== 'rotina_pos_retorno');
  }

  // Fallback se nada bater
  if (finalMatches.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    if (fallback) finalMatches.push(fallback);
  }

  return finalMatches.slice(0, 3).map(s => createSuggestion(s, clienteNome, protocolo, ultimoRetorno));
}

function createSuggestion(s: ScriptTemplate, nome: string, cnj: string, data: string | null | undefined): ScriptSuggestion {
  return {
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[Nome\]/g, nome)
      .replace(/\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, data || 'últimos dias')
  };
}
