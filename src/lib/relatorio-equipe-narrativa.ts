import type { SupervisaoSnapshot, SupervisaoUsuarioGrupo } from "@/app/actions/supervisao-actions";

export type PapelOperador = {
  nomeMatch: string;
  titulo: string;
  papel: string;
};

export const PAPEIS_OPERACAO: PapelOperador[] = [
  {
    nomeMatch: "victor",
    titulo: "Victor Carmo",
    papel: "Procon. O resto do dia é cliente de processo, igual todo mundo.",
  },
  {
    nomeMatch: "kris",
    titulo: "Kris",
    papel: "Audiência e SAC. Quem liga nervoso cai nela. Processo também.",
  },
  {
    nomeMatch: "davi",
    titulo: "Davi Alves Figueredo",
    papel: "Reclame Aqui. Responde depois de checar o que o cliente falou, não no piloto.",
  },
  {
    nomeMatch: "adriana",
    titulo: "Adriana",
    papel: "Fila de processo. Sem cargo de canal público, mas a carteira é do mesmo tamanho.",
  },
];

export const FATO_WHATSAPP =
  "Os quatro esvaziaram a fila do WhatsApp. Três semanas seguidas sem conversa parada.";

function norm(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function papelDe(nome: string): PapelOperador | null {
  const n = norm(nome);
  return PAPEIS_OPERACAO.find((p) => n.includes(p.nomeMatch)) || null;
}

export type RelatorioEquipePessoa = {
  nome: string;
  papel: string;
  linha: string;
  vencidos: number;
};

export type RelatorioEquipeData = {
  geradoEm: string;
  periodoLabel: string;
  kpis: { valor: string; rotulo: string }[];
  pessoas: RelatorioEquipePessoa[];
  leitura: string[];
  canais: string[];
  esconde: string[];
  recado: string;
  proxima: string[];
  whatsapp: string;
};

function linhaPessoa(u: SupervisaoUsuarioGrupo) {
  return `${u.total} processos · ${u.ativos} andando · ${u.atendidosSemana} atendidos na semana · ${u.vencidos} vencidos`;
}

export function montarRelatorioEquipe(
  snap: SupervisaoSnapshot,
  opts?: { geradoEm?: string }
): RelatorioEquipeData {
  const pessoasSrc = (snap.porUsuario || []).length ? snap.porUsuario : (snap.operadores || []).map((o) => ({
    key: o.nome,
    nome: o.nome,
    total: o.total,
    ativos: o.ativos,
    encerrados: o.encerrados,
    baixasTribunal: 0,
    vencidos: o.vencidos,
    novidades: o.novidades,
    atendimentos: o.atendimentos,
    atendidosSemana: o.atendidosSemana,
    semRetorno: o.semRetorno,
    ba: o.ba,
    processos: [],
  }));

  const pessoas: RelatorioEquipePessoa[] = pessoasSrc.map((u) => {
    const p = papelDe(u.nome);
    return {
      nome: p?.titulo || u.nome || "Sem nome",
      papel: p?.papel || "Atendimento processual.",
      linha: linhaPessoa(u as SupervisaoUsuarioGrupo),
      vencidos: u.vencidos || 0,
    };
  });

  const porVenc = [...pessoas].sort((a, b) => b.vencidos - a.vencidos);
  const maisVenc = porVenc.slice(0, 2).filter((p) => p.vencidos > 0);
  const menosVenc = [...pessoas].sort((a, b) => a.vencidos - b.vencidos)[0];

  const leitura: string[] = [
    pessoas.length
      ? `Ninguém está com a carteira inchada sozinho. Deu quase o mesmo tanto para cada um. A diferença é o recado que chega: Procon, SAC, Reclame Aqui.`
      : "Ainda não há quebra por pessoa nesta extração.",
    snap.atendidosSemana || snap.atendimentosTotais
      ? `Atendimento não está frouxo. ${snap.atendidosSemana || 0} no período e ${snap.atendimentosTotais || 0} no acumulado. Quem olha de fora pode achar que atendeu demais. Por dentro é o volume que a assessoria vive.`
      : "Atendimento do período ainda não entrou no consolidado.",
    snap.vencidos
      ? `Vencido da empresa: ${snap.vencidos}.${
          maisVenc.length
            ? ` ${maisVenc.map((p) => `${p.nome.split(" ")[0]} (${p.vencidos})`).join(" e ")} puxam mais.`
            : ""
        }${menosVenc ? ` ${menosVenc.nome.split(" ")[0]} está com ${menosVenc.vencidos}.` : ""} Não é ranking. É fila para a semana que vem.`
      : "Sem vencido na foto de agora.",
    snap.encerrados || snap.baixasTribunal
      ? `Tem processo que o tribunal já baixou e a lista ainda trata como vivo. Por isso o encerrado (${snap.encerrados}) e a baixa (${snap.baixasTribunal}) precisam ser lidos juntos. Se misturar os dois, o vencido mente.`
      : "Encerrado e baixa de tribunal ainda não fecharam neste corte.",
    snap.ba
      ? `B.A. no painel: ${snap.ba}. Olhar caso a caso, não no susto.`
      : "B.A. zerado no painel.",
    snap.novidades
      ? `As ${snap.novidades} novidades são movimento depois do último contato, não alarme de apreensão.`
      : "Sem novidade de andamento neste corte.",
  ];

  const canais = [
    "Victor no Procon: prazo de órgão. Se deixar esfriar, vira multa e cliente no Reclame Aqui.",
    "Kris no SAC e na audiência: é cara da empresa no dia. Atraso aqui não espera o DataJud.",
    "Davi no Reclame Aqui: texto público. Confere o processo, fala com quem atendeu, e só então responde.",
    "Os quatro no processual: retorno, prazo e o que o escritório precisa para o cliente não achar que sumimos.",
  ];

  const esconde = [
    snap.auditadosTribunalSemana
      ? `Tribunal da semana: ${snap.auditadosTribunalSemana} consulta(s).`
      : "Tribunal da semana zerado. Não lê isso como fórum parado. O scan ou não rodou, ou o número foi para outro campo.",
    snap.editadosAppSemana
      ? `Edições no app no período: ${snap.editadosAppSemana}. O resto entra como atendimento.`
      : "Pouca edição de ficha no app. Quase tudo entra como atendimento. Se ninguém corrige dado, o relatório financeiro continua com lixo.",
    snap.encerrados > snap.ativos
      ? `Mais arquivo do que frente: ${snap.encerrados} encerrados contra ${snap.ativos} ativos. Atender por atender gasta o dia. O que ainda move é quitação, cumprimento, audiência e reclamação aberta.`
      : `Ativos ${snap.ativos} · encerrados ${snap.encerrados}.`,
  ];

  const recado =
    "A equipe segura o volume. WhatsApp limpo três semanas não é detalhe. O próximo passo não é atender mais — é baixar os vencidos e parar de tratar baixa de tribunal como caso vivo. Procon, SAC e Reclame Aqui já têm dono. Ferramenta nova só entra se reduzir reclamação ou fechar contrato. Painel bonito sozinho não paga conta.";

  const proxima = [
    ...maisVenc.map((p) => `${p.nome.split(" ")[0]} na fila de vencido (${p.vencidos}).`),
    "Victor: Procon em dia e a fatia de vencido dele.",
    "Davi: Reclame Aqui todo dia. Vencido da carteira dele não pode voltar a subir.",
    "Ninguém deixa o WhatsApp encher de novo. Três semanas zeradas é o chão, não o teto.",
    "Não religar encerramento sozinho no sistema. Arquivo só com gente olhando.",
  ];

  return {
    geradoEm: opts?.geradoEm || new Date().toLocaleString("pt-BR"),
    periodoLabel: snap.periodoLabel || "período atual",
    kpis: [
      { valor: String(snap.total), rotulo: "na base" },
      { valor: String(snap.ativos), rotulo: "ativos" },
      { valor: String(snap.encerrados), rotulo: "já encerrados" },
      { valor: String(snap.baixasTribunal), rotulo: "baixa no tribunal" },
      { valor: String(snap.vencidos), rotulo: "vencidos" },
      { valor: String(snap.novidades), rotulo: "novidade" },
      { valor: String(snap.atendimentosTotais), rotulo: "atendimentos" },
      { valor: String(snap.atendidosSemana), rotulo: "no período" },
    ],
    pessoas,
    leitura,
    canais,
    esconde,
    recado,
    proxima,
    whatsapp: FATO_WHATSAPP,
  };
}
