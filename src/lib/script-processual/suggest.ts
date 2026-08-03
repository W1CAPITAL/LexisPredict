/**
 * ScriptInput com aliases camelCase + snake_case (typecheck limpo).
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
  evento_tipo?: string | null;
  eventoTipo?: string | null;
  evento_resumo?: string | null;
  /** alias UI */
  eventoResumo?: string | null;
  djen_ultimo_resumo?: string | null;
  djenTexts?: string[];
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
  const eventoTipo = input.evento_tipo || input.eventoTipo || null;
  const eventoResumo = input.evento_resumo || input.eventoResumo || null;

  const blob = [
    eventoResumo,
    input.djen_ultimo_resumo,
    ...(input.djenTexts || []),
    ...(input.movimentos || []).map(
      (m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`
    ),
  ]
    .join(' ')
    .toUpperCase();

  const matches: Array<{ template: ScriptTemplate; score: number; dataMov: string }> = [];

  for (const t of SCRIPT_CATALOG) {
    let score = 0;
    if ((t as any).eventoTipos?.length && eventoTipo && (t as any).eventoTipos.includes(eventoTipo)) {
      score += 100 - (t.prioridade ?? 50);
    }
    if (input.datajud_encerrado_tribunal && t.id === 'baixa_tribunal') score += 90;
    if (input.em_cumprimento_sentenca && t.id === 'cumprimento') score += 80;
    if (
      (input.tem_novo_andamento ||
        input.tem_atualizacao_pos_retorno ||
        input.djen_nova_comunicacao) &&
      (t.id === 'nova_movimentacao' || t.id === 'rotina')
    ) {
      score += 40;
    }
    for (const kw of t.keywords || []) {
      if (kw && blob.includes(String(kw).toUpperCase())) score += 25;
    }
    if (score > 0) {
      matches.push({
        template: t,
        score,
        dataMov: String(input.movimentos?.[0]?.dataHora || ''),
      });
    }
  }

  matches.sort(
    (a, b) => b.score - a.score || (a.template.prioridade ?? 99) - (b.template.prioridade ?? 99)
  );

  if (matches.length === 0) {
    const fallback =
      SCRIPT_CATALOG.find((x) => x.id === 'nova_movimentacao') ||
      SCRIPT_CATALOG.find((x) => x.id === 'rotina') ||
      SCRIPT_CATALOG[0];
    if (fallback) matches.push({ template: fallback, score: 1, dataMov: '' });
  }

  return matches
    .slice(0, 3)
    .map((m) =>
      createSuggestion(m.template, clienteNome, protocolo, input.ultimoRetorno, m.dataMov)
    );
}
