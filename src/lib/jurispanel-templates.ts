/**
 * 46 categorias autorais de minutas e triagens. São estruturas, não peças prontas
 * para protocolo e não foram copiadas de conteúdo proprietário do Astrea.
 */
export const JURISPANEL_TIPOS = {
  "Cível": [
    "Petição Inicial",
    "Contestação Cível",
    "Impugnação à Contestação",
    "Alegações Finais Cível",
    "Apelação Cível",
    "Contrarrazões de Apelação",
    "Contrarrazões ao Recurso Inominado",
    "Contrarrazões de Embargos de Declaração",
    "Agravo de Instrumento",
    "Contraminuta de Agravo de Instrumento",
    "Embargos de Declaração",
    "Recurso Especial",
    "Mandado de Segurança",
    "Recurso Inominado",
    "Impugnação ao Cumprimento de Sentença",
    "Cumprimento de Sentença",
    "Embargos à Execução",
    "Manifestação Processual",
    "Impugnação aos Embargos à Execução",
    "Impugnação ao Laudo Pericial",
    "Agravo Interno",
    "Exceção de Pré-Executividade",
    "Agravo em Recurso Especial",
    "Contrarrazões ao Recurso Especial",
    "Embargos de Terceiro",
    "Notificação Extrajudicial Detalhada"
  ],
  "Trabalhista": [
    "Contrarrazões ao Recurso Ordinário Trabalhista",
    "Recurso Ordinário Trabalhista",
    "Reclamação Trabalhista",
    "Contestação Trabalhista",
    "Recurso de Revista",
    "Impugnação à Contestação Trabalhista"
  ],
  "Previdenciário": [
    "Razões do Requerimento de Revisão do Benefício Administrativo",
    "Razões de Recurso Previdenciário Administrativo",
    "Requerimento de Concessão de Benefício Previdenciário Administrativo",
    "Inicial de Ação de Concessão de Benefício Previdenciário",
    "Ação de Revisão de Benefício Previdenciário"
  ],
  "Parecer": [
    "Parecer Jurídico"
  ],
  "Criminal": [
    "Queixa-Crime",
    "Resposta à Acusação",
    "Habeas Corpus",
    "Apelação Criminal",
    "Alegações Finais Criminais",
    "Pedido de Liberdade Provisória",
    "Recurso em Sentido Estrito"
  ],
  "Trânsito": [
    "Defesa Prévia"
  ]
} as const;
export const JURISPANEL_TIPOS_LISTA = Object.entries(JURISPANEL_TIPOS).flatMap(
  ([categoria, tipos]) => (tipos as readonly string[]).map(titulo => ({categoria,titulo}))
);
export const JURISPANEL_TOTAL_TIPOS = JURISPANEL_TIPOS_LISTA.length;
export type TemplateValues = { cnj:string; cliente:string; fatos:string; fundamentos:string; pedidos:string; provas?:string };

export function preencherModeloAutor(texto:string,values:TemplateValues):string {
  const v:Record<string,string> = {
    CNJ:values.cnj, CLIENTE:values.cliente, FATOS:values.fatos,
    FUNDAMENTOS:values.fundamentos, PEDIDOS:values.pedidos, PROVAS:values.provas||''
  };
  return texto.replace(/\{\{(CNJ|CLIENTE|FATOS|FUNDAMENTOS|PEDIDOS|PROVAS)\}\}/g,
    (_,chave:string)=>v[chave]||'[CONFERIR '+chave+']');
}

export function criarEstruturaAutoral(tipo:string):string {
  const found=JURISPANEL_TIPOS_LISTA.find(x=>x.titulo===tipo);
  if(!found)throw new Error('Tipo jurídico desconhecido');
  const prefixo=found.categoria==='Parecer'?'PARECER JURÍDICO':'MINUTA DE '+tipo.toLocaleUpperCase('pt-BR');
  return [
    prefixo,'',
    'Processo: {{CNJ}}',
    'Parte interessada: {{CLIENTE}}','',
    'I — CONTEXTO FÁTICO','{{FATOS}}','',
    'II — FUNDAMENTOS E ELEMENTOS DE PROVA','{{FUNDAMENTOS}}','{{PROVAS}}','',
    'III — PEDIDOS / CONCLUSÃO','{{PEDIDOS}}','',
    '[CONFERIR: competência, legitimidade, rito, requisitos, legislação, jurisprudência, prazos, prova e assinatura.]',
    '[MINUTA ORIGINAL NÃO HOMOLOGADA: REVISÃO POR PROFISSIONAL HABILITADO OBRIGATÓRIA.]'
  ].join('\n');
}
