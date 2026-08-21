/**
 * Simplificação de juridiquês → linguagem clara.
 * Inspirado em: TeamGHCP/JusTraduz + Tech-Ninjas-DIOX/front-entenda-direito
 *
 * Uso: mensagem ao cliente, resumo de andamento, portal do cliente.
 */

const GLOSSARIO: Array<{ de: RegExp; para: string }> = [
  { de: /\bin limine\b/gi, para: "no início do processo" },
  { de: /\btutela de urg[eê]ncia\b/gi, para: "pedido urgente de proteção" },
  { de: /\bagravo de instrumento\b/gi, para: "recurso contra decisão do juiz" },
  { de: /\bdespacho\b/gi, para: "decisão do juiz" },
  { de: /\bcertid[aã]o de tr[aâ]nsito em julgado\b/gi, para: "confirmação de que a decisão ficou definitiva" },
  { de: /\btr[aâ]nsito em julgado\b/gi, para: "decisão definitiva (não cabe mais recurso)" },
  { de: /\bcumprimento de senten[cç]a\b/gi, para: "fase de pagamento/execução do que foi decidido" },
  { de: /\bbusca e apreens[aã]o\b/gi, para: "ordem para localizar e recolher bem" },
  { de: /\bpenhora\b/gi, para: "bloqueio de bens para garantir o pagamento" },
  { de: /\bintim[aã][cç][aã]o\b/gi, para: "aviso oficial do tribunal" },
  { de: /\bcita[cç][aã]o\b/gi, para: "aviso formal de que existe um processo contra a pessoa" },
  { de: /\brevelia\b/gi, para: "quando a parte não responde no prazo" },
  { de: /\bexequente\b/gi, para: "quem cobra na execução" },
  { de: /\bexecutado\b/gi, para: "quem deve pagar na execução" },
  { de: /\bautor(a)?\b/gi, para: "quem entrou com o processo" },
  { de: /\br[eé]u\b/gi, para: "quem está sendo processado" },
  { de: /\bpeti[cç][aã]o inicial\b/gi, para: "documento que inicia o processo" },
  { de: /\bcontest[aã][cç][aã]o\b/gi, para: "defesa apresentada no processo" },
  { de: /\br[eé]plica\b/gi, para: "resposta à defesa" },
  { de: /\bsentin[cç]a\b/gi, para: "decisão final do juiz na 1ª instância" },
  { de: /\bac[oó]rd[aã]o\b/gi, para: "decisão de um tribunal (grupo de juízes)" },
  { de: /\bjurisprud[eê]ncia\b/gi, para: "decisões anteriores semelhantes" },
  { de: /\bprecedente\b/gi, para: "decisão anterior usada como referência" },
  { de: /\bônus da prova\b/gi, para: "quem precisa provar o que alega" },
  { de: /\bliminar\b/gi, para: "decisão provisória e urgente" },
];

export type SimplificacaoResult = {
  original: string;
  simples: string;
  termosTrocados: number;
};

export function simplificarJuridiques(texto: string): SimplificacaoResult {
  let simples = String(texto || "");
  let termosTrocados = 0;
  for (const { de, para } of GLOSSARIO) {
    const before = simples;
    simples = simples.replace(de, para);
    if (simples !== before) termosTrocados += 1;
  }
  simples = simples.replace(/\s{2,}/g, " ").trim();
  return { original: String(texto || ""), simples, termosTrocados };
}

/** Resumo curto para WhatsApp / cliente (1–3 frases). */
export function resumoParaCliente(andamento: string, maxLen = 280): string {
  const { simples } = simplificarJuridiques(andamento);
  if (simples.length <= maxLen) return simples;
  return simples.slice(0, maxLen - 1).trimEnd() + "…";
}
