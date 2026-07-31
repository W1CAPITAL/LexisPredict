/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SUGESTÃO DE SCRIPTS v1.1
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
  'AUTOS NO CARTÓRIO', 'RECEBIDOS OS AUTOS'
];

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const { clienteNome = 'Cliente', protocolo, ultimoRetorno, movimentos = [] } = input;
  
  // 1. Ordenar movimentos por data DESC
  const sortedMovs = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const lastMovName = (sortedMovs[0]?.nome || '').toUpperCase();

  // 2. Regra de Rotina desde o Último Retorno
  let onlyRoutineSinceLastReturn = false;
  if (ultimoRetorno && sortedMovs.length > 0) {
    try {
      let dateRetorno: Date | null = null;
      const cleanStr = ultimoRetorno.trim();
      
      if (cleanStr.includes('/')) {
        dateRetorno = startOfDay(parse(cleanStr, 'dd/MM/yyyy', new Date()));
      } else {
        dateRetorno = startOfDay(parseISO(cleanStr));
      }

      if (dateRetorno && isValid(dateRetorno)) {
        const movsAfter = sortedMovs.filter(m => m.dataHora && isAfter(parseISO(m.dataHora), dateRetorno!));
        
        if (movsAfter.length > 0) {
          onlyRoutineSinceLastReturn = movsAfter.every(m => 
            ROUTINE_KEYWORDS.some(kw => (m.nome || '').toUpperCase().includes(kw))
          );
        }
      }
    } catch (e) {}
  }

  // 3. Seleção de Candidatos
  let suggestions: ScriptTemplate[] = [];

  if (onlyRoutineSinceLastReturn) {
    const template = SCRIPT_CATALOG.find(s => s.categoria === 'rotina_pos_retorno');
    if (template) suggestions.push(template);
  } else {
    // Busca por keywords na prioridade do catálogo
    for (const template of SCRIPT_CATALOG) {
      if (template.keywords.some(kw => lastMovName.includes(kw))) {
        suggestions.push(template);
        break;
      }
    }
  }

  // Fallback: Se não achou nada, sugere Rotina Geral
  if (suggestions.length === 0) {
    const fallback = SCRIPT_CATALOG.find(s => s.categoria === 'rotina');
    if (fallback) suggestions.push(fallback);
  }

  // 4. Mapeamento Final com Placeholders
  return suggestions.map(s => ({
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[Nome\]/g, clienteNome)
      .replace(/\[CNJ\]/g, protocolo)
      .replace(/\[Data\]/g, ultimoRetorno || 'últimos dias')
  }));
}
