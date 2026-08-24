/**
 * Conhecimento estruturado — Ação Revisional de Contrato (crédito/consumidor).
 * Uso: chat IA, checklist de triagem, modelos de peças, cálculos.
 * Não substitui parecer jurídico.
 */

export type TemaRevisional =
  | 'juros_remuneratorios'
  | 'capitalizacao'
  | 'comissao_permanencia'
  | 'tac_tec'
  | 'venda_casada'
  | 'tabela_price'
  | 'onerosidade_excessiva'
  | 'inversao_onus';

export interface TeseRevisional {
  id: TemaRevisional;
  titulo: string;
  resumo: string;
  fundamentos: string[];
  jurisprudenciaChave: string[];
  observacaoPratica: string;
  riscoAtual: 'baixo' | 'medio' | 'alto';
}

export const TESES_REVISIONAIS: TeseRevisional[] = [
  {
    id: 'juros_remuneratorios',
    titulo: 'Taxa de juros remuneratórios abusiva',
    resumo:
      'Taxa contratual muito acima da média de mercado para a mesma espécie de operação (BACEN), podendo ensejar redução à média.',
    fundamentos: [
      'CDC arts. 6º, 39 e 51, IV',
      'Comparação com taxa média divulgada pelo Banco Central para o mesmo produto',
    ],
    jurisprudenciaChave: [
      'STJ — orientação de redução à média de mercado quando a taxa for manifestamente excessiva em relação à média do período e do tipo de contrato',
    ],
    observacaoPratica:
      'Comparar sempre o mesmo produto (ex.: veículo ≠ empréstimo pessoal). Só alegar “juros abusivos” sem prova da média tende a não prosperar.',
    riscoAtual: 'medio',
  },
  {
    id: 'capitalizacao',
    titulo: 'Capitalização / anatocismo',
    resumo:
      'Capitalização com periodicidade inferior à anual é permitida em contratos com instituições do SFN a partir de 31/03/2000, se pactuada de forma expressa.',
    fundamentos: [
      'Súmula 539/STJ',
      'MP 1.963-17/2000 (reeditada como MP 2.170-36/2001), art. 5º',
    ],
    jurisprudenciaChave: [
      'Súmula 539/STJ: capitalização inferior à anual permitida em contratos do SFN a partir de 31/3/2000, desde que expressamente pactuada',
    ],
    observacaoPratica:
      'Tese genérica de “anatocismo ilegal” costuma falhar se houver pacto expresso. Avaliar se a capitalização está clara no contrato e se há forma velada (ex.: sistemas de amortização).',
    riscoAtual: 'alto',
  },
  {
    id: 'comissao_permanencia',
    titulo: 'Comissão de permanência',
    resumo:
      'Encargo pós-inadimplemento; vedada cumulação indevida com correção monetária e outros encargos em duplicidade. Normativo CMN/BACEN alterou a disciplina (Res. 4.558/2017).',
    fundamentos: [
      'Resolução CMN nº 4.558/2017',
      'Orientação STJ sobre limites e vedação de cumulação indevida',
    ],
    jurisprudenciaChave: [
      'STJ — comissão de permanência limitada e sem cumulação com correção monetária e juros da mora de forma abusiva',
    ],
    observacaoPratica:
      'Conferir o que foi cobrado após o atraso e se há empilhamento de encargos (comissão + mora + correção + multa).',
    riscoAtual: 'medio',
  },
  {
    id: 'tac_tec',
    titulo: 'TAC / TEC e tarifas administrativas',
    resumo:
      'Tarifas de abertura/cadastro e congêneres: ilegalidade consolidada em diversos cenários após 30/04/2008; antes dessa data, analisar abusividade caso a caso.',
    fundamentos: [
      'CDC art. 51, IV',
      'Orientação STJ sobre tarifas bancárias e data-corte 30/04/2008',
    ],
    jurisprudenciaChave: [
      'STJ — tratamento das tarifas TAC/TEC conforme data da contratação e natureza do serviço efetivamente prestado',
    ],
    observacaoPratica:
      'Verificar data do contrato, valor cobrado e se houve serviço real. Bis in idem com a remuneração já embutida nos juros é argumento frequente.',
    riscoAtual: 'medio',
  },
  {
    id: 'venda_casada',
    titulo: 'Venda casada (seguro e produtos acessórios)',
    resumo:
      'Condicionar o crédito à contratação de seguro ou outro produto é prática ilegal; valores pagos indevidamente podem ensejar repetição (em dobro quando cabível).',
    fundamentos: ['CDC arts. 39, I e 51', 'Prática abusiva de condicionamento'],
    jurisprudenciaChave: [
      'STJ/TJ — invalidade de venda casada de seguro prestamista e produtos acessórios sem liberdade real de contratação',
    ],
    observacaoPratica:
      'Provar que o seguro/produto foi imposto ou que não houve opção real. Pedir exclusão da cobrança e devolução dos valores.',
    riscoAtual: 'baixo',
  },
  {
    id: 'tabela_price',
    titulo: 'Tabela Price / sistema de amortização',
    resumo:
      'Discussão sobre juros compostos embutidos no sistema francês de amortização; tese controversa e com baixa taxa de êxito isolada.',
    fundamentos: ['Análise do sistema de amortização pactuado', 'CDC e boa-fé objetiva'],
    jurisprudenciaChave: [
      'Jurisprudência majoritária tende a admitir a Price quando pactuada de forma clara',
    ],
    observacaoPratica:
      'Evitar usar Price como tese isolada. Combinar com prova de taxa acima da média, tarifas ilegais ou venda casada.',
    riscoAtual: 'alto',
  },
  {
    id: 'onerosidade_excessiva',
    titulo: 'Onerosidade excessiva / fato superveniente',
    resumo:
      'Revisão por alteração superveniente que torne a prestação excessivamente onerosa (CC e CDC), além das cláusulas abusivas ab initio.',
    fundamentos: ['CC arts. 317 e 478 e ss. (quando aplicáveis)', 'CDC arts. 6º e 51'],
    jurisprudenciaChave: [
      'Doutrina e jurisprudência sobre revisão por onerosidade excessiva e cláusulas abusivas no CDC',
    ],
    observacaoPratica:
      'Documentar mudança concreta da capacidade de pagamento e o desequilíbrio do contrato — não basta alegação genérica de “dificuldade financeira”.',
    riscoAtual: 'medio',
  },
  {
    id: 'inversao_onus',
    titulo: 'Inversão do ônus da prova / acesso ao contrato',
    resumo:
      'Consumidor hipossuficiente pode requerer inversão do ônus e exibição do contrato/demonstrativos quando a instituição se recusa a fornecer.',
    fundamentos: ['CDC art. 6º, VIII', 'CPC arts. 396 e ss. (exibição de documento)'],
    jurisprudenciaChave: [
      'CDC — facilitação da defesa do consumidor e inversão do ônus quando verossímil a alegação e hipossuficiente a parte',
    ],
    observacaoPratica:
      'Sempre pedir na inicial a exibição do contrato, CET, planilha de evolução do débito e comprovantes de tarifas/seguros.',
    riscoAtual: 'baixo',
  },
];

export const TIPOS_CONTRATO_REVISIONAIS = [
  'Financiamento de veículo / alienação fiduciária',
  'Consórcio',
  'Crédito imobiliário',
  'Empréstimo pessoal',
  'Cheque especial',
  'Cartão de crédito',
  'Crédito consignado',
  'Outro contrato bancário',
] as const;

export const CHECKLIST_TRIAGEM_REVISIONAL = [
  'Contrato completo e aditivos',
  'CET e planilha de evolução do débito',
  'Comprovantes de pagamento',
  'Data da contratação (relevante para TAC/TEC e capitalização)',
  'Taxa contratual vs. média BACEN do mesmo produto/período',
  'Seguros e produtos acessórios (venda casada)',
  'Encargos de mora / comissão de permanência cobrados',
  'Negativação ou risco de busca e apreensão (pedir tutela)',
  'Valor da causa e interesse em depósito judicial de parcela incontroversa',
] as const;

export function tesesParaPromptIA(): string {
  return TESES_REVISIONAIS.map(
    (t) =>
      `- ${t.titulo} [${t.riscoAtual}]: ${t.resumo} | Fundamentos: ${t.fundamentos.join('; ')} | Prática: ${t.observacaoPratica}`
  ).join('\n');
}
