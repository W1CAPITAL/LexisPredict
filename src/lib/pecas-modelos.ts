/**
 * Biblioteca de modelos — padrão de qualificação e estrutura de
 * Procuração Ad Judicia (outorgante / outorgado / objeto / poderes /
 * poderes excepcionais / finalidade / local e data / assinatura).
 * OAB aceita 1–2+ caracteres. Quebras de linha preservadas para o PDF.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { sanitizePecaTexto } from '@/lib/pecas-sanitize';

export type CategoriaPeca =
  | 'Procuração'
  | 'Habilitação'
  | 'Substabelecimento'
  | 'Revogação'
  | 'Petições'
  | 'Cartas'
  | 'Extrajudicial'
  | 'PROCON'
  | 'Quitação'
  | 'Limpa Nome';

export interface PecaMeta {
  protocolo?: string;
  cliente?: string;
  cpfCliente?: string;
  rgCliente?: string;
  orgaoRgCliente?: string;
  nacionalidadeCliente?: string;
  estadoCivilCliente?: string;
  profissaoCliente?: string;
  enderecoCliente?: string;
  telefoneCliente?: string;
  emailCliente?: string;
  banco?: string;
  cnpjBanco?: string;
  includeBanco?: boolean;
  advogado?: string;
  oab?: string;
  uf?: string;
  cpfAdvogado?: string;
  rgAdvogado?: string;
  enderecoAdvogado?: string;
  advogado2?: string;
  oab2?: string;
  uf2?: string;
  advogadoPassivo?: string;
  tribunal?: string;
  comarca?: string;
  orgao?: string;
  classeAcao?: string;
  resumo?: string;
  substabDe?: string;
  substabDeOab?: string;
  substabPara?: string;
  substabParaOab?: string;
  tipoAcao?: string;
  data?: string;
  valorContrato?: string;
  valorProposta?: string;
  protocoloProcon?: string;
  cidade?: string;
  parteContraria?: string;
  cpfParteContraria?: string;
}

export interface ModeloPeca {
  id: string;
  categoria: CategoriaPeca;
  titulo: string;
  descricao: string;
  campos: (keyof PecaMeta)[];
  render: (m: PecaMeta) => string;
}

const hojeBR = () => new Date().toLocaleDateString('pt-BR');

function seg(m: PecaMeta, k: keyof PecaMeta, fallback: string): string {
  const v = m[k];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/** Nomes: mín. 2 chars. OAB/UF: aceita qualquer texto (OAB pode ter 1–2 dígitos). */
function nomeSeg(m: PecaMeta, k: keyof PecaMeta, fallback: string): string {
  const v = typeof m[k] === 'string' ? (m[k] as string).trim() : '';
  if (!v) return fallback;
  const key = String(k);
  if (/oab/i.test(key) || key === 'uf' || key === 'uf2') {
    return v;
  }
  if (v.length < 2) return fallback;
  if (/^(teste|test|xxx|asdf)$/i.test(v)) return fallback;
  return v;
}

function qualificaCliente(m: PecaMeta): string {
  const nome = nomeSeg(m, 'cliente', '[NOME COMPLETO DO OUTORGANTE]');
  const parts: string[] = [nome];
  const nac = seg(m, 'nacionalidadeCliente', '');
  const civil = seg(m, 'estadoCivilCliente', '');
  const prof = seg(m, 'profissaoCliente', '');
  if (nac || civil || prof) {
    parts.push([nac, civil, prof].filter(Boolean).join(', '));
  }
  const rg = seg(m, 'rgCliente', '');
  const orgao = seg(m, 'orgaoRgCliente', '');
  if (rg) {
    parts.push(
      `portador(a) da cédula de identidade n.º ${rg}${orgao ? ` expedida por ${orgao}` : ''}`
    );
  }
  const cpf = seg(m, 'cpfCliente', '');
  if (cpf) parts.push(`inscrito(a) no CPF sob o n.º ${cpf}`);
  const end = seg(m, 'enderecoCliente', '');
  if (end) parts.push(`residente e domiciliado(a) em ${end}`);
  const tel = seg(m, 'telefoneCliente', '');
  if (tel) parts.push(`telefone: ${tel}`);
  const email = seg(m, 'emailCliente', '');
  if (email) parts.push(`endereço eletrônico: ${email}`);
  return parts.join(', ');
}

function qualificaAdvogado(
  m: PecaMeta,
  nomeKey: keyof PecaMeta,
  oabKey: keyof PecaMeta,
  ufKey: keyof PecaMeta
): string {
  const nome = nomeSeg(m, nomeKey, '[NOME DO ADVOGADO]');
  const oab = nomeSeg(m, oabKey, '________');
  const uf = nomeSeg(m, ufKey, '__');
  const parts = [
    `${nome}, advogado(a), regularmente inscrito(a) na Ordem dos Advogados do Brasil — Seccional ${uf} (OAB/${uf}) sob o n.º ${oab}`,
  ];
  const cpf = seg(m, 'cpfAdvogado', '');
  if (cpf && nomeKey === 'advogado') parts.push(`CPF n.º ${cpf}`);
  const end = seg(m, 'enderecoAdvogado', '');
  if (end && nomeKey === 'advogado') parts.push(`com endereço profissional em ${end}`);
  return parts.join(', ');
}

function blocoFinalidade(m: PecaMeta): string {
  const tipo = seg(m, 'tipoAcao', '') || seg(m, 'classeAcao', '');
  const banco = seg(m, 'banco', '');
  const cnpj = seg(m, 'cnpjBanco', '');
  const prot = seg(m, 'protocolo', '');
  const parte = seg(m, 'parteContraria', '') || banco;
  const resumo = seg(m, 'resumo', '');
  const bits: string[] = [];
  if (tipo) bits.push(`em demanda da natureza de ${tipo}`);
  if (parte) bits.push(`em face de ${parte}${cnpj ? `, CNPJ ${cnpj}` : ''}`);
  if (prot) bits.push(`relacionada ao processo/contrato n.º ${prot}`);
  if (resumo) bits.push(resumo);
  if (!bits.length) {
    return 'Representar o(a) outorgante e promover a defesa de seus interesses e direitos em juízo ou fora dele, em quaisquer medidas judiciais ou administrativas necessárias.';
  }
  return `Representar o(a) outorgante e promover a defesa de seus interesses ${bits.join(', ')}.`;
}

function localData(m: PecaMeta): string {
  const cidade = nomeSeg(m, 'cidade', '[CIDADE]');
  const data = seg(m, 'data', hojeBR());
  return `${cidade}, ${data}.`;
}

function assinatura(m: PecaMeta, rotulo = 'Outorgante'): string {
  return [
    '',
    '_________________________________',
    nomeSeg(m, 'cliente', '[NOME DO OUTORGANTE]').toUpperCase(),
    rotulo,
  ].join('\n');
}

export const BANCOS_COBERTOS: string[] = [
  'Banco do Brasil',
  'Banco Itaú Unibanco',
  'Banco Bradesco',
  'Banco Santander',
  'Caixa Econômica Federal',
  'Nubank',
  'Banco Inter',
  'Banco Pan',
  'Banco BMG',
  'Banco C6 Bank',
  'Banco Safra',
  'Banco Original',
  'Banco Daycoval',
  'Banco Votorantim',
  'Crefisa',
  'Losango',
  'Banco Agibank',
  'Banrisul',
  'Sicoob',
  'Sicredi',
  'PagBank',
  'Mercado Pago',
  'PicPay',
  'Outra instituição financeira',
];

export const CATEGORIAS: CategoriaPeca[] = [
  'Procuração',
  'Habilitação',
  'Substabelecimento',
  'Revogação',
  'Petições',
  'Cartas',
  'Extrajudicial',
  'PROCON',
  'Quitação',
  'Limpa Nome',
];

const CAMPOS_OUTORGANTE: (keyof PecaMeta)[] = [
  'cliente',
  'nacionalidadeCliente',
  'estadoCivilCliente',
  'profissaoCliente',
  'cpfCliente',
  'rgCliente',
  'orgaoRgCliente',
  'enderecoCliente',
  'telefoneCliente',
  'emailCliente',
  'cidade',
  'data',
];

const CAMPOS_ADVOGADO: (keyof PecaMeta)[] = [
  'advogado',
  'oab',
  'uf',
  'cpfAdvogado',
  'enderecoAdvogado',
  'advogado2',
  'oab2',
  'uf2',
];

export const MODELOS_DE_PECAS: ModeloPeca[] = [
  {
    id: 'procuracao-ad-judicia',
    categoria: 'Procuração',
    titulo: 'Procuração Ad Judicia et Extra',
    descricao:
      'Modelo completo: outorgante qualificado, outorgado(s), objeto, poderes, poderes excepcionais e finalidade.',
    campos: [
      ...CAMPOS_OUTORGANTE,
      ...CAMPOS_ADVOGADO,
      'banco',
      'cnpjBanco',
      'protocolo',
      'tipoAcao',
      'classeAcao',
      'parteContraria',
      'resumo',
    ],
    render: (m) => {
      const outorgados = [qualificaAdvogado(m, 'advogado', 'oab', 'uf')];
      if (nomeSeg(m, 'advogado2', '')) {
        outorgados.push(qualificaAdvogado(m, 'advogado2', 'oab2', 'uf2'));
      }
      return [
        'PROCURAÇÃO AD JUDICIA ET EXTRA',
        '',
        'Pelo presente instrumento particular de mandato por mim subscrito:',
        '',
        `Outorgante: ${qualificaCliente(m)}; constituo e nomeio como meu(s) bastante(s) procurador(es):`,
        '',
        `Outorgado(s): ${outorgados.join('; e ')}.`,
        '',
        'Objeto: Representar o(a) outorgante, assim como promover a defesa de seus interesses e direitos.',
        '',
        'Poderes: Por intermédio deste instrumento, confiro-lhes amplos poderes para o foro em geral, com a cláusula “ad judicia et extra”. Outorgo-lhes poderes para propor ações e acompanhar os recursos legais competentes, podendo promover quaisquer medidas judiciais ou administrativas, assinar termos, ofertar defesa direta ou indireta, interpor recursos, ajuizar ações e conduzir os processos, solicitar e ter acesso a documentos de qualquer natureza. Concede-se, ainda, poderes para substabelecer este mandato a outrem, com ou sem reserva de poderes.',
        '',
        'Poderes Excepcionais: Outorgam-se poderes especiais para receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber e dar quitação, firmar compromisso e assinar declaração de hipossuficiência econômica, nos termos do art. 105 da Lei n.º 13.105/2015 (Código de Processo Civil).',
        '',
        `Finalidade: ${blocoFinalidade(m)}`,
        '',
        localData(m),
        assinatura(m, 'Outorgante'),
      ].join('\n');
    },
  },
  {
    id: 'procuracao-geral',
    categoria: 'Procuração',
    titulo: 'Procuração Geral (qualificada)',
    descricao: 'Versão completa com qualificação do outorgante e poderes ad judicia.',
    campos: [...CAMPOS_OUTORGANTE, ...CAMPOS_ADVOGADO, 'banco', 'protocolo', 'resumo'],
    render: (m) =>
      [
        'PROCURAÇÃO',
        '',
        'Pelo presente instrumento particular de mandato por mim subscrito:',
        '',
        `Outorgante: ${qualificaCliente(m)}; nomeio e constituo meu bastante procurador:`,
        '',
        `Outorgado: ${qualificaAdvogado(m, 'advogado', 'oab', 'uf')}.`,
        '',
        'Poderes: Conferem-se amplos poderes para o foro em geral, com a cláusula ad judicia et extra, para representar o(a) outorgante em juízo ou fora dele, em qualquer juízo, instância ou tribunal, praticando todos os atos necessários à defesa de seus interesses, podendo substabelecer com ou sem reserva.',
        '',
        'Poderes Específicos: Requerer, transigir, receber e dar quitação, firmar compromissos e propostas, acompanhar audiências, apresentar defesas, recursos e contrarrazões, e praticar demais atos necessários ao cumprimento deste mandato.',
        '',
        m.resumo ? `Observações: ${m.resumo}` : '',
        '',
        localData(m),
        assinatura(m, 'Outorgante'),
      ]
        .filter((l) => l !== '')
        .join('\n'),
  },
  {
    id: 'habilitacao-completa',
    categoria: 'Habilitação',
    titulo: 'Habilitação nos autos',
    descricao: 'Petição de habilitação com qualificação, fundamento no art. 105 do CPC e pedidos.',
    campos: [
      'protocolo',
      'cliente',
      'cpfCliente',
      'banco',
      'cnpjBanco',
      'orgao',
      'comarca',
      'tribunal',
      'classeAcao',
      'advogado',
      'oab',
      'uf',
      'enderecoAdvogado',
      'resumo',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '')}` : '',
        m.tribunal ? seg(m, 'tribunal', '') : '',
        '',
        `Processo n.º ${seg(m, 'protocolo', '____________________')}`,
        m.classeAcao ? `Classe: ${seg(m, 'classeAcao', '')}` : '',
        '',
        'HABILITAÇÃO',
        '',
        `${qualificaAdvogado(m, 'advogado', 'oab', 'uf')}, vem, respeitosamente, à presença de Vossa Excelência, com fulcro no art. 105 do Código de Processo Civil, requerer sua HABILITAÇÃO nos autos em epígrafe, na qualidade de patrono(a) de ${nomeSeg(m, 'cliente', '[NOME DA PARTE]')}${m.cpfCliente ? `, CPF ${seg(m, 'cpfCliente', '')}` : ''}${m.banco ? `, em face de ${seg(m, 'banco', '')}${m.cnpjBanco ? `, CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}` : ''}.`,
        '',
        'Junta, para tanto, instrumento de procuração outorgando os poderes necessários, bem como documentos de identificação quando exigidos.',
        '',
        m.resumo ? `Esclarece ainda: ${m.resumo}` : '',
        '',
        'Requer:',
        'a) o regular recebimento da presente habilitação;',
        'b) a anotação do nome do(a) signatário(a) para fins de intimação e publicações;',
        'c) a expedição de certidão de habilitação, se necessário.',
        '',
        'Termos em que pede deferimento.',
        '',
        localData(m),
        '',
        nomeSeg(m, 'advogado', '[ADVOGADO]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'oab', '________')}`,
      ]
        .filter((l) => l !== undefined)
        .join('\n'),
  },
  {
    id: 'substabelecimento-sem-reserva',
    categoria: 'Substabelecimento',
    titulo: 'Substabelecimento sem reserva de poderes',
    descricao: 'Transfere poderes integralmente ao substabelecido.',
    campos: [
      'substabDe',
      'substabDeOab',
      'uf',
      'substabPara',
      'substabParaOab',
      'cliente',
      'protocolo',
      'banco',
      'cidade',
      'data',
      'resumo',
    ],
    render: (m) =>
      [
        'SUBSTABELECIMENTO SEM RESERVA DE PODERES',
        '',
        `Substabelecente: ${nomeSeg(m, 'substabDe', '[ADVOGADO CEDENTE]')}, OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'substabDeOab', '________')}.`,
        '',
        `Substabelecido: ${nomeSeg(m, 'substabPara', '[ADVOGADO SUBSTABELECIDO]')}, OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'substabParaOab', '________')}.`,
        '',
        `Pelo presente, o substabelecente SUBSTABELECE, sem reserva de poderes, ao substabelecido, os poderes que lhe foram outorgados por ${nomeSeg(m, 'cliente', '[OUTORGANTE]')}${m.protocolo ? `, nos autos/contrato n.º ${seg(m, 'protocolo', '')}` : ''}${m.banco ? `, envolvendo ${seg(m, 'banco', '')}` : ''}, para o foro em geral, com a cláusula ad judicia et extra.`,
        '',
        m.resumo ? `Observações: ${m.resumo}` : '',
        '',
        localData(m),
        '',
        '_________________________________',
        nomeSeg(m, 'substabDe', '[SUBSTABELECENTE]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'substabDeOab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'substabelecimento-com-reserva',
    categoria: 'Substabelecimento',
    titulo: 'Substabelecimento com reserva de poderes',
    descricao: 'Transfere poderes mantendo reserva ao substabelecente.',
    campos: [
      'substabDe',
      'substabDeOab',
      'uf',
      'substabPara',
      'substabParaOab',
      'cliente',
      'protocolo',
      'banco',
      'cidade',
      'data',
      'resumo',
    ],
    render: (m) =>
      [
        'SUBSTABELECIMENTO COM RESERVA DE PODERES',
        '',
        `Substabelecente: ${nomeSeg(m, 'substabDe', '[ADVOGADO CEDENTE]')}, OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'substabDeOab', '________')}.`,
        '',
        `Substabelecido: ${nomeSeg(m, 'substabPara', '[ADVOGADO SUBSTABELECIDO]')}, OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'substabParaOab', '________')}.`,
        '',
        `Pelo presente, o substabelecente SUBSTABELECE, com reserva de iguais poderes, ao substabelecido, os poderes que lhe foram outorgados por ${nomeSeg(m, 'cliente', '[OUTORGANTE]')}${m.protocolo ? `, nos autos/contrato n.º ${seg(m, 'protocolo', '')}` : ''}${m.banco ? `, envolvendo ${seg(m, 'banco', '')}` : ''}, podendo o substabelecido praticar todos os atos inerentes ao mandato, em conjunto ou isoladamente.`,
        '',
        m.resumo ? `Observações: ${m.resumo}` : '',
        '',
        localData(m),
        '',
        '_________________________________',
        nomeSeg(m, 'substabDe', '[SUBSTABELECENTE]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'substabDeOab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'revogacao-poderes',
    categoria: 'Revogação',
    titulo: 'Revogação de poderes',
    descricao:
      'Revoga mandato anteriormente conferido (art. 686 do Código Civil). Sem substabelecimento.',
    campos: [
      'cliente',
      'cpfCliente',
      'advogado',
      'oab',
      'uf',
      'protocolo',
      'banco',
      'resumo',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'REVOGAÇÃO DE MANDATO / PODERES',
        '',
        `Outorgante: ${qualificaCliente(m)}.`,
        '',
        `Pelo presente, REVOGO, nos termos do art. 686 do Código Civil, os poderes anteriormente conferidos ao(à) advogado(a) ${nomeSeg(m, 'advogado', '[ADVOGADO]')}, OAB/${nomeSeg(m, 'uf', '__')} n.º ${nomeSeg(m, 'oab', '________')}${
          m.protocolo
            ? `, referentes ao processo/contrato n.º ${seg(m, 'protocolo', '')}`
            : ''
        }${
          m.banco ? `, mantido junto a ${seg(m, 'banco', '')}` : ''
        }, ficando sem efeito qualquer ato praticado por este(a) a partir da presente data, salvo os já regularmente praticados na vigência do mandato.`,
        '',
        m.resumo ? `Observações: ${m.resumo}` : '',
        '',
        localData(m),
        '',
        '_________________________________',
        nomeSeg(m, 'cliente', '[NOME DO OUTORGANTE]').toUpperCase(),
        'Outorgante',
      ]
        .filter((l) => l !== undefined && l !== null && l !== '')
        .join('\n'),
  },
  {
    id: 'peticao-informacoes',
    categoria: 'Petições',
    titulo: 'Petição de informações / certidão',
    descricao: 'Requer certidão de andamento e cópia dos atos.',
    campos: [
      'protocolo',
      'cliente',
      'banco',
      'orgao',
      'comarca',
      'advogado',
      'oab',
      'uf',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '')}` : '',
        '',
        `Processo n.º ${seg(m, 'protocolo', '____________________')}`,
        '',
        'PETIÇÃO DE INFORMAÇÕES',
        '',
        `${nomeSeg(m, 'cliente', '[PARTE]')}, nos autos em que contende${m.banco ? ` contra ${seg(m, 'banco', '')}` : ''}, vem requerer a Vossa Excelência seja determinada à serventia a expedição de certidão atualizada de andamento processual e cópia dos atos disponíveis, para acompanhamento e providências cabíveis.`,
        '',
        'Termos em que pede deferimento.',
        '',
        localData(m),
        '',
        nomeSeg(m, 'advogado', '[ADVOGADO]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'peticao-juntada',
    categoria: 'Petições',
    titulo: 'Petição de juntada',
    descricao: 'Juntada de procuração e documentos de habilitação.',
    campos: [
      'protocolo',
      'cliente',
      'banco',
      'orgao',
      'comarca',
      'advogado',
      'oab',
      'uf',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '')}` : '',
        '',
        `Processo n.º ${seg(m, 'protocolo', '____________________')}`,
        '',
        'PETIÇÃO DE JUNTADA',
        '',
        `${nomeSeg(m, 'advogado', '[ADVOGADO]')}, OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'oab', '________')}, vem juntar aos autos instrumento de procuração e documentos pertinentes à representação de ${nomeSeg(m, 'cliente', '[PARTE]')}${m.banco ? `, em face de ${seg(m, 'banco', '')}` : ''}, requerendo o regular recebimento e a anotação para fins de intimação.`,
        '',
        'Termos em que pede deferimento.',
        '',
        localData(m),
        '',
        nomeSeg(m, 'advogado', '[ADVOGADO]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'peticao-cumprimento',
    categoria: 'Petições',
    titulo: 'Petição — cumprimento de sentença',
    descricao: 'Requer início ou andamento de cumprimento de sentença.',
    campos: [
      'protocolo',
      'cliente',
      'banco',
      'orgao',
      'comarca',
      'advogado',
      'oab',
      'uf',
      'resumo',
      'valorContrato',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '')}` : '',
        '',
        `Processo n.º ${seg(m, 'protocolo', '____________________')}`,
        '',
        'REQUERIMENTO DE CUMPRIMENTO DE SENTENÇA',
        '',
        `${nomeSeg(m, 'cliente', '[EXEQUENTE]')}, já qualificado(a) nos autos em que contende contra ${nomeSeg(m, 'banco', '[EXECUTADO]')}, vem, com fulcro nos arts. 513 e seguintes do CPC, requerer o cumprimento da sentença / acórdão transitado em julgado${m.valorContrato ? `, no valor de ${seg(m, 'valorContrato', '')}` : ''}.`,
        '',
        m.resumo ||
          'Requer a intimação da parte contrária para cumprimento da obrigação no prazo legal, sob pena de penhora e demais atos executivos.',
        '',
        'Termos em que pede deferimento.',
        '',
        localData(m),
        '',
        nomeSeg(m, 'advogado', '[ADVOGADO]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'carta-banco-documentos',
    categoria: 'Cartas',
    titulo: 'Carta ao banco — documentos',
    descricao: 'Solicita cópia do contrato e demonstrativos.',
    campos: [
      'cliente',
      'cpfCliente',
      'banco',
      'cnpjBanco',
      'protocolo',
      'advogado',
      'oab',
      'uf',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        nomeSeg(m, 'banco', '[INSTITUIÇÃO FINANCEIRA]').toUpperCase(),
        m.cnpjBanco ? `CNPJ ${seg(m, 'cnpjBanco', '')}` : '',
        'Departamento Jurídico / Ouvidoria',
        '',
        `Assunto: Solicitação de informações e documentos — ${nomeSeg(m, 'cliente', '[CLIENTE]')} — Contrato/Processo n.º ${seg(m, 'protocolo', '[NÚMERO]')}`,
        '',
        `${qualificaCliente(m)}, titular de relação contratual mantida junto a essa instituição, vem solicitar cópia integral do contrato e demonstrativo detalhado de parcelas, encargos, taxas e cláusulas aplicáveis, no prazo legal, sob pena das medidas cabíveis.`,
        '',
        'Termos em que pede deferimento.',
        '',
        localData(m),
        '',
        nomeSeg(m, 'advogado', '[ADVOGADO]').toUpperCase(),
        `OAB/${nomeSeg(m, 'uf', '__')} ${nomeSeg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'carta-banco-quitacao',
    categoria: 'Cartas',
    titulo: 'Carta — proposta de quitação',
    descricao: 'Proposta formal de quitação com valor.',
    campos: [
      'cliente',
      'cpfCliente',
      'banco',
      'cnpjBanco',
      'protocolo',
      'valorContrato',
      'valorProposta',
      'resumo',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'PROPOSTA DE QUITAÇÃO / ACORDO EXTRAJUDICIAL',
        '',
        `Destinatário: ${nomeSeg(m, 'banco', '[CREDOR]').toUpperCase()}${m.cnpjBanco ? `, CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}`,
        '',
        `Proponente: ${qualificaCliente(m)}`,
        `Contrato n.º ${seg(m, 'protocolo', '[NÚMERO]')}`,
        m.valorContrato ? `Saldo / valor de referência: ${seg(m, 'valorContrato', '')}` : '',
        '',
        `PROPOSTA: O proponente oferece a quantia de ${seg(m, 'valorProposta', '[R$ ___]')} para quitação integral do contrato acima, com baixa definitiva de restrições e emissão de termo de quitação no prazo de 5 (cinco) dias úteis após a compensação do pagamento.`,
        '',
        m.resumo
          ? `Condições adicionais: ${m.resumo}`
          : 'A proposta é válida por 10 (dez) dias corridos a contar do recebimento.',
        '',
        'Solicita-se resposta formal por escrito.',
        '',
        localData(m),
        assinatura(m, 'Proponente'),
      ].join('\n'),
  },
  {
    id: 'extrajudicial-notificacao',
    categoria: 'Extrajudicial',
    titulo: 'Notificação extrajudicial ao credor',
    descricao: 'Notificação formal para revisão/negociação contratual.',
    campos: [
      'cliente',
      'cpfCliente',
      'rgCliente',
      'enderecoCliente',
      'banco',
      'cnpjBanco',
      'protocolo',
      'valorContrato',
      'resumo',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'NOTIFICAÇÃO EXTRAJUDICIAL',
        '',
        `AO(À): ${nomeSeg(m, 'banco', '[INSTITUIÇÃO]').toUpperCase()}${m.cnpjBanco ? ` — CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}`,
        '',
        `NOTIFICANTE: ${qualificaCliente(m)}.`,
        '',
        `REF.: Contrato/operação n.º ${seg(m, 'protocolo', '[NÚMERO]')}${m.valorContrato ? `, valor de referência ${seg(m, 'valorContrato', '')}` : ''}.`,
        '',
        'Prezados Senhores,',
        '',
        'Vimos NOTIFICAR extrajudicialmente V. Sas. para que, no prazo de 10 (dez) dias úteis, apresentem demonstrativo detalhado do contrato em referência (CET, taxas, seguros, tarifas e evolução do saldo), bem como indiquem canal formal para proposta de composição amigável, sob pena de adoção das medidas judiciais e administrativas cabíveis.',
        '',
        m.resumo ? `Fundamentos e pedidos específicos: ${m.resumo}` : '',
        '',
        'Esta notificação não implica reconhecimento de dívida além do eventualmente devido, nem renúncia a direitos.',
        '',
        localData(m),
        assinatura(m, 'Notificante'),
      ].join('\n'),
  },
  {
    id: 'procon-resposta',
    categoria: 'PROCON',
    titulo: 'Minuta PROCON',
    descricao: 'Estrutura de reclamação/defesa no PROCON.',
    campos: [
      'cliente',
      'cpfCliente',
      'enderecoCliente',
      'banco',
      'protocoloProcon',
      'protocolo',
      'resumo',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'ILUSTRÍSSIMO(A) SENHOR(A) DIRETOR(A) / ATENDENTE DO PROCON',
        '',
        `Protocolo PROCON n.º ${seg(m, 'protocoloProcon', '[NÚMERO]')}`,
        m.protocolo ? `Contrato/processo relacionado: ${seg(m, 'protocolo', '')}` : '',
        '',
        `Reclamante: ${qualificaCliente(m)}.`,
        `Reclamado: ${nomeSeg(m, 'banco', '[FORNECEDOR / INSTITUIÇÃO]')}.`,
        '',
        'DOS FATOS',
        m.resumo || '[Descrever objetivamente os fatos, datas e documentos anexos.]',
        '',
        'DO DIREITO',
        'Aplicam-se as normas do Código de Defesa do Consumidor (Lei 8.078/1990), em especial os deveres de informação, transparência e boa-fé objetiva.',
        '',
        'DOS PEDIDOS',
        'Requer-se a análise da reclamação, a intimação da parte contrária para esclarecimentos e a busca de solução conciliatória, com a juntada dos documentos que instruem o presente.',
        '',
        localData(m),
        '',
        '_________________________________',
        'Reclamante / Representante',
      ].join('\n'),
  },
  {
    id: 'limpa-nome-requerimento',
    categoria: 'Limpa Nome',
    titulo: 'Requerimento de baixa em birôs',
    descricao: 'Solicita exclusão de apontamento após quitação ou indevido.',
    campos: [
      'cliente',
      'cpfCliente',
      'enderecoCliente',
      'banco',
      'protocolo',
      'resumo',
      'cidade',
      'data',
    ],
    render: (m) =>
      [
        'REQUERIMENTO DE BAIXA / EXCLUSÃO DE APONTAMENTO',
        '',
        `Ao(À) ${nomeSeg(m, 'banco', '[CREDOR / GESTOR DE COBRANÇA]')}`,
        'e aos órgãos de proteção ao crédito (SPC, Serasa e congêneres),',
        '',
        `${qualificaCliente(m)}, requer a imediata BAIXA de qualquer apontamento restritivo vinculado ao contrato/operação n.º ${seg(m, 'protocolo', '[NÚMERO]')}, ${m.resumo || 'em razão de quitação / ausência de inadimplemento / apontamento indevido, conforme documentos anexos.'}`,
        '',
        'Fundamenta-se no CDC e na legislação aplicável à proteção de dados e crédito ao consumidor, requerendo comunicação da baixa no prazo legal.',
        '',
        localData(m),
        assinatura(m, 'Requerente'),
      ].join('\n'),
  },
];

export function renderModelo(modeloId: string, meta: PecaMeta): string | null {
  const modelo = MODELOS_DE_PECAS.find((x) => x.id === modeloId);
  if (!modelo) return null;
  const m = { ...(meta || {}) };
  if (m.includeBanco === false) {
    m.banco = '';
    m.cnpjBanco = '';
  }
  return sanitizePecaTexto(modelo.render(m), { includeBanco: m.includeBanco !== false });
}
