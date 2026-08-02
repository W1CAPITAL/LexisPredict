/**
 * Sugestão de resposta: primeiro evento_tipo, depois keywords, depois rotina segura.
 * Nunca inventa resultado; não cita nome de empresa.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { parseISO, parse, isValid, format } from 'date-fns';
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
  /** Campos unificados do scan */
  evento_tipo?: string | null;
  evento_resumo?: string | null;
  djen_ultimo_resumo?: string | null;
  tem_novo_andamento?: boolean;
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
}

function fmtDate(raw?: string | null): string {
  if (!raw) return '';
  try {
    const clean = raw.trim();
    const d = clean.includes('/')
      ? parse(clean, 'dd/MM/yyyy', new Date())
      : parseISO(clean);
    if (isValid(d)) return format(d, 'dd/MM/yyyy');
  } catch {
    //
  }
  return '';
}

function createSuggestion(
  s: ScriptTemplate,
  nome: string,
  cnj: string,
  dateRetornoStr?: string | null,
  dataMovStr?: string
): ScriptSuggestion {
  const displayRetorno = fmtDate(dateRetornoStr) || 'nos últimos dias';
  const displayMov = fmtDate(dataMovStr) || 'recentemente';
  return {
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[CLIENTE\]|\[Nome\]/g, nome)
      .replace(/\[PROTOCOLO\]|\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, displayRetorno)
      .replace(/\[DataMov\]/g, displayMov),
  };
}

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const clienteNome = (input.clienteNome || 'Cliente').split(/\s+/)[0] || 'Cliente';
  const protocolo = input.protocolo || '';
  const ultimoRetorno = input.ultimoRetorno;
  const movimentos = input.movimentos || [];

  const blob = [
    input.evento_resumo,
    input.djen_ultimo_resumo,
    ...movimentos.map((m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`),
  ]
    .join(' ')
    .toUpperCase();

  const matches: Array<{ template: ScriptTemplate; score: number; dataMov: string }> = [];

  for (const t of SCRIPT_CATALOG) {
    let score = 0;

    if (t.eventoTipos?.length && input.evento_tipo && t.eventoTipos.includes(input.evento_tipo)) {
      score += 100 - t.prioridade;
    }

    if (input.datajud_encerrado_tribunal && t.id === 'baixa_tribunal') score += 90;
    if (input.em_cumprimento_sentenca && t.id === 'cumprimento') score += 80;
    if (
      (input.tem_novo_andamento || input.tem_atualizacao_pos_retorno || input.djen_nova_comunicacao) &&
      t.id === 'nova_movimentacao'
    ) {
      score += 40;
    }

    for (const kw of t.keywords) {
      if (kw && blob.includes(kw.toUpperCase())) score += 25;
    }

    if (score > 0) {
      const dataMov =
        movimentos[0]?.dataHora ||
        input.evento_resumo ||
        '';
      matches.push({ template: t, score, dataMov: String(dataMov) });
    }
  }

  matches.sort((a, b) => b.score - a.score || a.template.prioridade - b.template.prioridade);

  // Fallback: se há novidade/baixa, nunca só “rotina vazia”
  if (matches.length === 0) {
    if (input.datajud_encerrado_tribunal) {
      const t = SCRIPT_CATALOG.find((x) => x.id === 'baixa_tribunal')!;
      matches.push({ template: t, score: 1, dataMov: '' });
    } else if (input.tem_novo_andamento || input.tem_atualizacao_pos_retorno || input.djen_nova_comunicacao) {
      const t = SCRIPT_CATALOG.find((x) => x.id === 'nova_movimentacao')!;
      matches.push({ template: t, score: 1, dataMov: '' });
    } else {
      const t = SCRIPT_CATALOG.find((x) => x.id === 'prazo_retorno')!;
      matches.push({ template: t, score: 1, dataMov: '' });
    }
  }

  return matches.slice(0, 3).map((m) =>
    createSuggestion(m.template, clienteNome, protocolo, ultimoRetorno, m.dataMov)
  );
}
