/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v1.3 - LÓGICA DE JANELA E PRIORIDADE
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
  
  // 1. Preparação da Janela
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  // Parse do último retorno para comparação cronológica
  let dateRetorno: Date | null = null;
  if (ultimoRetorno) {
    const cleanStr = ultimoRetorno.trim();
    if (cleanStr.includes('/')) {
      dateRetorno = startOfDay(parse(cleanStr, 'dd/MM/yyyy', new Date()));
    } else {
      dateRetorno = startOfDay(parseISO(cleanStr));
    }
  }

  // Define a janela: 20 mais recentes OU todos desde o último retorno
  const windowLimit = 20;
  const movsInWindow = sortedMovs.filter((m, idx) => {
    if (idx < windowLimit) return true;
    if (dateRetorno && isValid(dateRetorno) && m.dataHora) {
       return isAfter(parseISO(m.dataHora), dateRetorno);
    }
    return false;
  });

  if (movsInWindow.length === 0) {
    return [createSuggestion(SCRIPT_CATALOG.find(s => s.id === 'rotina')!, clienteNome, protocolo, ultimoRetorno)];
  }

  // 2. Classificação de Prioridade na Janela
  const matches: ScriptTemplate[] = [];
  const matchedCategories = new Set<string>();

  // Verificamos se TODOS os movimentos na janela são rotina (P6)
  const allRoutine = movsInWindow.every(m => 
    ROUTINE_KEYWORDS.some(kw => (m.nome || '').toUpperCase().includes(kw))
  );

  if (allRoutine && dateRetorno) {
    const template = SCRIPT_CATALOG.find(s => s.id === 'rotina_pos_retorno');
    if (template) return [createSuggestion(template, clienteNome, protocolo, ultimoRetorno)];
  }

  // Detecção de Multi-matches na janela (Prioridade vindo do catálogo)
  const windowText = movsInWindow.map(m => (m.nome || '').toUpperCase()).join(' | ');

  // Caso Especial: Liminar + JG na mesma janela
  const hasLiminar = windowText.includes('LIMINAR') || windowText.includes('TUTELA');
  const hasJG = windowText.includes('JUSTIÇA GRATUITA') || windowText.includes('ASSISTÊNCIA JUDICIÁRIA') || windowText.includes('GRATUIDADE');
  
  if (hasLiminar && hasJG) {
    const template = SCRIPT_CATALOG.find(s => s.id === 'liminar_e_jg');
    if (template) {
      matches.push(template);
      matchedCategories.add('liminar');
      matchedCategories.add('jg');
    }
  }

  // Busca Geral por Prioridade (excluindo o que já foi detectado no caso especial)
  for (const template of SCRIPT_CATALOG) {
    if (template.id === 'rotina_pos_retorno') continue;
    if (template.id === 'liminar_e_jg' && matches.length > 0) continue;

    // Se já temos JG ou Liminar via script combinado, não repetimos
    if (template.id === 'liminar_analisada' && matchedCategories.has('liminar')) continue;
    if (template.id === 'justica_gratuita' && matchedCategories.has('jg')) continue;

    if (template.keywords.some(kw => windowText.includes(kw))) {
      matches.push(template);
      if (matches.length >= 3) break; // Máximo 3 sugestões
    }
  }

  // Fallback: Rotina Geral
  if (matches.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.id === 'rotina');
    if (fallback) matches.push(fallback);
  }

  // 3. Ordenação por Prioridade (P0 primeiro) e Mapeamento
  return matches
    .sort((a, b) => a.prioridade - b.prioridade)
    .map(s => createSuggestion(s, clienteNome, protocolo, ultimoRetorno));
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
