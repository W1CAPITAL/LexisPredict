/**
 * Núcleo neural determinístico — ranking de respostas ao cliente.
 * Usado por Tarefas e Processos (mesma inteligência).
 */
import { parseISO, parse, isValid, format } from 'date-fns';
import { SCRIPT_CATALOG, ScriptTemplate } from './catalog';

export interface ScriptSuggestion {
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
  score?: number;
  id?: string;
}

export interface ScriptInput {
  clienteNome?: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string; dataHora?: string }>;
  evento_tipo?: string | null;
  eventoTipo?: string | null;
  evento_resumo?: string | null;
  eventoResumo?: string | null;
  djen_ultimo_resumo?: string | null;
  djenTexts?: string[];
  tem_novo_andamento?: boolean;
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  indicio_busca_apreensao?: boolean;
  busca_apreensao?: boolean;
  datajud_ultimo_nome?: string | null;
}

function fmtDate(raw?: string | null): string {
  if (!raw) return '';
  try {
    const clean = String(raw).trim();
    const d = clean.includes('/')
      ? parse(clean.slice(0, 10), 'dd/MM/yyyy', new Date())
      : parseISO(clean.slice(0, 10));
    if (isValid(d)) return format(d, 'dd/MM/yyyy');
  } catch {
    /* */
  }
  return '';
}

function firstName(full?: string) {
  const p = String(full || 'Cliente')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  if (!p) return 'Cliente';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function createSuggestion(
  s: ScriptTemplate,
  nome: string,
  cnj: string,
  dateRetornoStr?: string | null,
  dataMovStr?: string,
  score?: number
): ScriptSuggestion {
  const displayRetorno = fmtDate(dateRetornoStr) || 'nos últimos dias';
  const displayMov = fmtDate(dataMovStr) || 'recentemente';
  return {
    id: s.id,
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    score,
    texto: s.texto
      .replace(/\[CLIENTE\]|\[Nome\]/g, nome)
      .replace(/\[PROTOCOLO\]|\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, displayRetorno)
      .replace(/\[DataMov\]/g, displayMov),
  };
}

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const clienteNome = firstName(input.clienteNome);
  const protocolo = input.protocolo || '';
  const eventoTipo = (input.evento_tipo || input.eventoTipo || '') as string;
  const eventoResumo = input.evento_resumo || input.eventoResumo || '';
  const isBA = !!(input.indicio_busca_apreensao || input.busca_apreensao || eventoTipo === 'ba');
  const isBaixa = !!(
    input.datajud_encerrado_tribunal ||
    eventoTipo === 'transito_ou_baixa' ||
    eventoTipo === 'transito_baixa'
  );
  const isCump = !!(input.em_cumprimento_sentenca || eventoTipo === 'cumprimento_sentenca');
  const isNovo = !!(
    input.tem_novo_andamento ||
    input.tem_atualizacao_pos_retorno ||
    input.djen_nova_comunicacao
  );

  const sortedMovs = [...(input.movimentos || [])].sort(
    (a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  const dataMovRef =
    sortedMovs[0]?.dataHora ||
    '';

  const blob = [
    eventoResumo,
    input.djen_ultimo_resumo,
    input.datajud_ultimo_nome,
    ...(input.djenTexts || []),
    ...sortedMovs.slice(0, 12).map((m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`),
  ]
    .join(' ')
    .toUpperCase();

  const matches: Array<{ template: ScriptTemplate; score: number }> = [];

  for (const t of SCRIPT_CATALOG) {
    let score = 0;

    if (isBA && (t.id === 'alerta_busca_apreensao' || t.categoria === 'ba')) score += 220;
    if (isBaixa && (t.categoria === 'baixa' || t.id === 'baixa_tribunal')) score += 180;
    if (isCump && t.id === 'cumprimento') score += 140;

    if (t.eventoTipos?.length && eventoTipo && t.eventoTipos.includes(eventoTipo)) {
      score += 120 - (t.prioridade ?? 50);
    }

    for (const kw of t.keywords || []) {
      if (kw && blob.includes(String(kw).toUpperCase())) score += 28;
    }

    if (isNovo && (t.id === 'nova_movimentacao' || t.id === 'publicacao_diario')) score += 35;
    if (input.djen_nova_comunicacao && t.id === 'publicacao_diario') score += 45;

    // Penaliza rotina se há mérito forte
    if (score > 0 && t.categoria === 'rotina' && (isBA || isBaixa)) score -= 30;

    if (score > 0) matches.push({ template: t, score });
  }

  matches.sort((a, b) => b.score - a.score || (a.template.prioridade ?? 99) - (b.template.prioridade ?? 99));

  if (matches.length === 0) {
    const fallback =
      SCRIPT_CATALOG.find((x) => x.id === 'nova_movimentacao') ||
      SCRIPT_CATALOG.find((x) => x.id === 'prazo_retorno') ||
      SCRIPT_CATALOG[0];
    if (fallback) matches.push({ template: fallback, score: 1 });
  }

  // Diversidade: sempre oferecer publicação + acompanhamento se faltar
  const ids = new Set(matches.map((m) => m.template.id));
  const ensure = (id: string, sc: number) => {
    if (ids.has(id)) return;
    const tpl = SCRIPT_CATALOG.find((x) => x.id === id);
    if (tpl) {
      matches.push({ template: tpl, score: sc });
      ids.add(id);
    }
  };
  if (input.djen_nova_comunicacao) ensure('publicacao_diario', 50);
  if (matches.length < 3) ensure('prazo_retorno', 5);
  if (matches.length < 2) ensure('rotina_cartorio', 3);

  matches.sort((a, b) => b.score - a.score || (a.template.prioridade ?? 99) - (b.template.prioridade ?? 99));

  return matches
    .slice(0, 4)
    .map((m) =>
      createSuggestion(m.template, clienteNome, protocolo, input.ultimoRetorno, dataMovRef, m.score)
    );
}

/** Alias legado */
export const gerarSugestoesScript = suggestScripts;
