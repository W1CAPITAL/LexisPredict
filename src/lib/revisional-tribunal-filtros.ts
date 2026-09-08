/**
 * Taxonomia alinhada a rótulos comuns de tribunais (PJe / DataJud / DJEN)
 * para carteira de revisão de contratos bancários / consumidor.
 * Uso: filtros do gerador e classificação de lista.
 */

export type FiltroRevisionalId =
  | "procedimento_comum_civel"
  | "acao_revisional"
  | "alienacao_fiduciaria"
  | "contratos_bancarios"
  | "busca_apreensao"
  | "cumprimento_sentenca"
  | "execucao_titulo"
  | "extinto_sem_merito"
  | "extinto_com_merito"
  | "improcedente"
  | "procedente_parcial"
  | "em_andamento";

export type TipoFiltro = "classe" | "assunto" | "resultado" | "fase";

export interface FiltroRevisional {
  id: FiltroRevisionalId;
  tipo: TipoFiltro;
  /** Nome completo como costuma aparecer no tribunal / capa */
  nomeTribunal: string;
  /** Aliases para match em texto livre (movimento, classe, assunto) */
  aliases: string[];
  /** Incluir por padrão no gerador de carteira revisional */
  defaultOn: boolean;
}

/** Catálogo — nomes no padrão de capa/classe/assunto dos TJs */
export const FILTROS_REVISIONAL: FiltroRevisional[] = [
  {
    id: "procedimento_comum_civel",
    tipo: "classe",
    nomeTribunal: "PROCEDIMENTO COMUM CÍVEL",
    aliases: [
      "procedimento comum cível",
      "procedimento comum civel",
      "procedimento comum",
      "proc. comum cível",
      "classe: 7",
      "procedimento comum (7)",
    ],
    defaultOn: true,
  },
  {
    id: "acao_revisional",
    tipo: "assunto",
    nomeTribunal: "Ação revisional de contrato bancário",
    aliases: [
      "ação revisional",
      "acao revisional",
      "revisional de contrato",
      "revisão de contrato",
      "revisao de contrato",
      "revisional bancária",
      "revisional bancaria",
      "revisão de cláusulas",
      "revisao de clausulas",
      "contrato bancário",
      "contratos bancários",
    ],
    defaultOn: true,
  },
  {
    id: "alienacao_fiduciaria",
    tipo: "assunto",
    nomeTribunal: "Alienação fiduciária",
    aliases: [
      "alienação fiduciária",
      "alienacao fiduciaria",
      "alienação fiduciária de bens móveis",
      "fidúcia",
      "fiducia",
      "busca e apreensão em alienação fiduciária",
    ],
    defaultOn: true,
  },
  {
    id: "contratos_bancarios",
    tipo: "assunto",
    nomeTribunal: "Contratos bancários",
    aliases: [
      "contratos bancários",
      "contratos bancarios",
      "direito bancário",
      "direito bancario",
      "empréstimo",
      "emprestimo",
      "financiamento de veículo",
      "financiamento de veiculo",
      "cdc",
      "crédito e financiamento",
      "credito e financiamento",
    ],
    defaultOn: true,
  },
  {
    id: "busca_apreensao",
    tipo: "classe",
    nomeTribunal: "Busca e apreensão",
    aliases: [
      "busca e apreensão",
      "busca e apreensao",
      "busca apreensão",
      "ação de busca e apreensão",
    ],
    defaultOn: false,
  },
  {
    id: "cumprimento_sentenca",
    tipo: "fase",
    nomeTribunal: "Cumprimento de sentença",
    aliases: [
      "cumprimento de sentença",
      "cumprimento de sentenca",
      "cumprimento provisório",
      "cumprimento definitivo",
      "instauração de cumprimento",
    ],
    defaultOn: false,
  },
  {
    id: "execucao_titulo",
    tipo: "classe",
    nomeTribunal: "Execução de título extrajudicial",
    aliases: [
      "execução de título extrajudicial",
      "execucao de titulo extrajudicial",
      "execução extrajudicial",
      "execucao extrajudicial",
    ],
    defaultOn: false,
  },
  {
    id: "extinto_sem_merito",
    tipo: "resultado",
    nomeTribunal: "Extinto sem resolução do mérito",
    aliases: [
      "extinto sem resolução do mérito",
      "extinto sem resolucao do merito",
      "extinção sem resolução do mérito",
      "extincao sem resolucao do merito",
      "sem resolução de mérito",
      "sem resolucao de merito",
      "art. 485",
      "artigo 485",
      "indeferido a petição inicial",
      "indeferida a peticao inicial",
      "abandono de causa",
      "ausência de pressupostos",
    ],
    defaultOn: false,
  },
  {
    id: "extinto_com_merito",
    tipo: "resultado",
    nomeTribunal: "Extinto com resolução do mérito",
    aliases: [
      "extinto com resolução do mérito",
      "extinto com resolucao do merito",
      "extinção com resolução do mérito",
      "art. 487",
      "artigo 487",
    ],
    defaultOn: false,
  },
  {
    id: "improcedente",
    tipo: "resultado",
    nomeTribunal: "Improcedente",
    aliases: ["improcedente", "julgo improcedente", "pedido improcedente"],
    defaultOn: false,
  },
  {
    id: "procedente_parcial",
    tipo: "resultado",
    nomeTribunal: "Procedente em parte",
    aliases: [
      "procedente em parte",
      "parcialmente procedente",
      "julgo parcialmente procedente",
      "procedente",
    ],
    defaultOn: false,
  },
  {
    id: "em_andamento",
    tipo: "fase",
    nomeTribunal: "Em andamento",
    aliases: ["em andamento", "em tramitação", "em tramitacao", "ativo"],
    defaultOn: true,
  },
];

export function filtrosDefaultOn(): FiltroRevisionalId[] {
  return FILTROS_REVISIONAL.filter((f) => f.defaultOn).map((f) => f.id);
}

export function normMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True se o texto (classe/assunto/movimento) casar com algum filtro ativo */
export function matchFiltrosRevisional(
  texto: string,
  ativos: FiltroRevisionalId[]
): { ok: boolean; hits: FiltroRevisionalId[] } {
  const n = normMatch(texto);
  if (!n) return { ok: false, hits: [] };
  const hits: FiltroRevisionalId[] = [];
  for (const f of FILTROS_REVISIONAL) {
    if (!ativos.includes(f.id)) continue;
    const names = [f.nomeTribunal, ...f.aliases].map(normMatch);
    if (names.some((a) => a && (n.includes(a) || a.includes(n)))) hits.push(f.id);
  }
  return { ok: hits.length > 0, hits };
}

const NOMES = [
  "Ana", "Bruno", "Carla", "Diego", "Eliane", "Fábio", "Gabriela", "Henrique",
  "Isabel", "João", "Karen", "Lucas", "Mariana", "Nicolas", "Olivia", "Paulo",
  "Queila", "Rafael", "Sabrina", "Tiago", "Úrsula", "Vitor", "Wagner", "Yasmin", "Zélia",
];
const MEIO = [
  "Alves", "Barbosa", "Cardoso", "Dias", "Esteves", "Fernandes", "Gomes", "Hahn",
  "Ibrahim", "Junqueira", "Klein", "Lima", "Mendes", "Nogueira", "Oliveira", "Pereira",
  "Queiroz", "Ribeiro", "Silva", "Teixeira", "Uchoa", "Vieira", "Xavier",
];
const SOBRE = [
  "da Silva", "de Souza", "dos Santos", "de Oliveira", "Rodrigues", "Ferreira",
  "Almeida", "Nascimento", "Moreira", "Carvalho", "Araújo", "Melo", "Costa", "Rocha",
];

export function gerarNomeCompleto(): string {
  const a = NOMES[Math.floor(Math.random() * NOMES.length)];
  const b = MEIO[Math.floor(Math.random() * MEIO.length)];
  const c = SOBRE[Math.floor(Math.random() * SOBRE.length)];
  return `${a} ${b} ${c}`.replace(/\s+/g, " ").trim();
}

export interface ProcessoGerado {
  processo: string;
  nome_completo: string;
  classe: string;
  assunto: string;
  situacao: string;
  filtros: string;
}

function pickClasse(ativos: FiltroRevisionalId[]): string {
  const classes = FILTROS_REVISIONAL.filter(
    (f) => f.tipo === "classe" && ativos.includes(f.id)
  );
  if (!classes.length) {
    return FILTROS_REVISIONAL.find((f) => f.id === "procedimento_comum_civel")!.nomeTribunal;
  }
  return classes[Math.floor(Math.random() * classes.length)].nomeTribunal;
}

function pickAssunto(ativos: FiltroRevisionalId[]): string {
  const assuntos = FILTROS_REVISIONAL.filter(
    (f) => f.tipo === "assunto" && ativos.includes(f.id)
  );
  if (!assuntos.length) {
    return "Ação revisional de contrato bancário";
  }
  // Preferir combinar revisional + alienação quando ambos ativos
  const hasRev = assuntos.find((a) => a.id === "acao_revisional");
  const hasAl = assuntos.find((a) => a.id === "alienacao_fiduciaria");
  const hasCb = assuntos.find((a) => a.id === "contratos_bancarios");
  const parts: string[] = [];
  if (hasRev) parts.push(hasRev.nomeTribunal);
  if (hasAl && Math.random() > 0.35) parts.push(hasAl.nomeTribunal);
  if (hasCb && Math.random() > 0.5) parts.push(hasCb.nomeTribunal);
  if (!parts.length) {
    return assuntos[Math.floor(Math.random() * assuntos.length)].nomeTribunal;
  }
  return parts.join("; ");
}

function pickSituacao(ativos: FiltroRevisionalId[]): string {
  const resultados = FILTROS_REVISIONAL.filter(
    (f) => (f.tipo === "resultado" || f.tipo === "fase") && ativos.includes(f.id)
  );
  if (!resultados.length) return "Em andamento";
  return resultados[Math.floor(Math.random() * resultados.length)].nomeTribunal;
}

export function montarProcessoGerado(cnjFmt: string, ativos: FiltroRevisionalId[]): ProcessoGerado {
  const classe = pickClasse(ativos);
  const assunto = pickAssunto(ativos);
  const situacao = pickSituacao(ativos);
  const hits = matchFiltrosRevisional(`${classe} ${assunto} ${situacao}`, ativos).hits;
  return {
    processo: cnjFmt,
    nome_completo: gerarNomeCompleto(),
    classe,
    assunto,
    situacao,
    filtros: hits.join("|"),
  };
}
