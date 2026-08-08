/**
 * D3 — Cobertura completa: biblioteca central de modelos reutilizáveis de peças.
 * Uma fonte única para procurações, habilitações, substabelecimentos, revogações,
 * petições e cartas a bancos. Todos aceitam qualquer banco da lista BANCOS_COBERTOS.
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

export type CategoriaPeca =
  | 'Procuração'
  | 'Habilitação'
  | 'Substabelecimento'
  | 'Revogação'
  | 'Petições'
  | 'Cartas';

export interface PecaMeta {
  protocolo?: string;
  cliente?: string;
  banco?: string;
  advogado?: string;
  advogadoPassivo?: string;
  oab?: string;
  uf?: string;
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

/** Lista ampla de bancos/instituições cobertos pelos modelos. */
export const BANCOS_COBERTOS: string[] = [
  'Banco do Brasil', 'Banco Itaú Unibanco', 'Banco Bradesco', 'Banco Santander',
  'Caixa Econômica Federal', 'Nubank', 'Banco Inter', 'Banco Pan', 'Banco BMG',
  'Banco C6 Bank', 'Banco Safra', 'Banco Original', 'Banco Daycoval',
  'Banco Votorantim', 'Banco Mercantil do Brasil', 'Crefisa', 'Losango',
  'Banco Agibank', 'Banco Master', 'Banco Modal', 'Banco Rendimento',
  'Banrisul', 'PagBank', 'Mercado Pago', 'PicPay', 'Will Bank', 'Banco Citibank',
  'Sicoob', 'Sicredi', 'Banco Nexpe', 'Banco Baneses', 'Banco Banestes',
  'Banco do Nordeste', 'Banco da Amazônia', 'BRB', 'Banco Sofisa',
  'Banco Volkswagen', 'Banco Toyota', 'Banco CNH', 'Outra instituição financeira',
];

const cartaComum = (m: PecaMeta): string => {
  const banco = seg(m, 'banco', '[INSTITUIÇÃO FINANCEIRA]');
  const cliente = seg(m, 'cliente', '[NOME DO CLIENTE]');
  const doc = seg(m, 'protocolo', '[Nº DO CONTRATO/PROCESSO]');
  return [
    banco.toUpperCase(),
    'Departamento Jurídico / Ouvidoria',
    '',
    `Assunto: Solicitação de informações e documentos — Cliente ${cliente} — Contrato/Processo nº ${doc}`,
    '',
    `${cliente}, titular do contrato mantido junto a ${banco}, vem, respeitosamente, por intermédio de seu(sua) advogado(a), solicitar que seja disponibilizada cópia integral do contrato, bem como o demonstrativo detalhado de todas as parcelas pagas, eventuais encargos, taxas e cláusulas de reajuste aplicadas.`,
    '',
    'A resposta deverá ser encaminhada no prazo legal, sob pena das providências judiciais cabíveis, inclusive revisão contratual.',
    '',
    'Termos em que pede deferimento.',
    hojeBR(),
    seg(m, 'advogado', '[NOME DO(A) ADVOGADO(A)]').toUpperCase(),
    `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', 'Nº ________')}`,
  ].join('\n');
};

export const MODELOS_DE_PECAS: ModeloPeca[] = [
  {
    id: 'procuracao-geral',
    categoria: 'Procuração',
    titulo: 'Procuração Geral',
    descricao: 'Outorga ampla de poderes ao advogado para representar o cliente.',
    campos: ['cliente', 'advogado', 'oab', 'uf'],
    render: (m) =>
      [
        'PROCURAÇÃO',
        '',
        `Pelo presente instrumento particular de mandato, ${seg(m, 'cliente', '[NOME DO OUTORGANTE]')}, por seu livre e espontânea vontade, nomeia e constitui seu bastante procurador o(a) advogado(a) ${seg(m, 'advogado', '[NOME DO ADVOGADO]')}, inscrito(a) na OAB${m.uf ? '/' + m.uf : ''} sob o n.º ${seg(m, 'oab', '________')}, com escritório profissional em [CIDADE/UF], a quem confere amplos poderes para o foro em geral e os especiais, com a cláusula ad judicia, para representá-lo(a) em juízo ou fora dele, em qualquer juízo, instância ou tribunal, praticando todos os atos necessários à defesa de seus interesses.`,
        '',
        'Poderes específicos: requerer, transigir, receber e dar quitação, firmar compromissos e propostas, acompanhar audiências, apresentar defesas, recursos e contrarrazões, e praticar todos os demais atos necessários ao cumprimento deste mandato. Em caso de celebração de acordo, fica o(a) advogado(a) autorizado(a) a transigir e firmar compromisso.'.replace(/^Poderes específicos: /, m.resumo ? `Observações: ${m.resumo}\n\nPoderes específicos: ` : 'Poderes específicos: '),
        '',
        `${hojeBR()}.`,
        '',
        '____________________________',
        seg(m, 'cliente', '[NOME DO OUTORGANTE]').toUpperCase(),
      ].join('\n'),
  },
  {
    id: 'procuracao-ad-judicia',
    categoria: 'Procuração',
    titulo: 'Procuração Ad Judicia',
    descricao: 'Outorga com poderes específicos para ações (revisional, indenizatória etc.).',
    campos: ['cliente', 'advogado', 'oab', 'uf', 'tipoAcao', 'banco', 'protocolo'],
    render: (m) =>
      [
        'PROCURAÇÃO AD JUDICIA',
        '',
        `Pelo presente instrumento, ${seg(m, 'cliente', '[NOME DO OUTORGANTE]')}, nomeia e constitui seu(sua) bastante procurador(a) o(a) advogado(a) ${seg(m, 'advogado', '[NOME DO ADVOGADO]')}, OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}, com poderes da cláusula ad judicia ET EXTRA, para propor e acompanhar ação ${seg(m, 'tipoAcao', '[TIPO DE AÇÃO — ex.: revisional de cláusulas contratuais]')} em face de ${seg(m, 'banco', '[INSTITUIÇÃO FINANCEIRA]')}, referente ao contrato nº ${seg(m, 'protocolo', '________')}, podendo requerer justiça gratuita, tutelas de urgência, impugnar, recorrer, desistir e transigir, receber e dar quitação, e praticar todos os demais atos necessários ao pleno exercício do mandato.`,
        '',
        `${hojeBR()}.`,
        '',
        '____________________________',
        seg(m, 'cliente', '[NOME DO OUTORGANTE]').toUpperCase(),
      ].join('\n'),
  },
  {
    id: 'habilitacao-simples',
    categoria: 'Habilitação',
    titulo: 'Habilitação de Advogado',
    descricao: 'Juntada de procuração e habilitação nos autos.',
    campos: ['protocolo', 'cliente', 'advogado', 'oab', 'uf', 'orgao', 'banco'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        '',
        'HABILITAÇÃO',
        '',
        `${seg(m, 'advogado', '[NOME DO ADVOGADO]')}, advogado(a) regularmente inscrito(a) na OAB${m.uf ? '/' + m.uf : ''} sob o n.º ${seg(m, 'oab', '________')}, vem respeitosamente à presença de Vossa Excelência requerer a sua HABILITAÇÃO nos presentes autos, em que contende ${seg(m, 'cliente', '[PARTE]')} contra ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}, juntando para tanto a procuração outorgada pela parte, requerendo, outrossim, que doravante as publicações e intimações sejam feitas em seu nome, sob pena de nulidade.`,
        '',
        'Termos em que pede deferimento.',
        '',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO ADVOGADO]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'substabelecimento-sem-reserva',
    categoria: 'Substabelecimento',
    titulo: 'Substabelecimento SEM Reserva',
    descricao: 'Transfere todos os poderes a outro advogado, sem reserva.',
    campos: ['protocolo', 'cliente', 'substabDe', 'substabDeOab', 'substabPara', 'substabParaOab', 'uf', 'banco'],
    render: (m) =>
      [
        'SUBSTABELECIMENTO SEM RESERVA DE PODERES',
        '',
        `Pelo presente instrumento, ${seg(m, 'substabDe', '[ADVOGADO CEDENTE]')}, OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'substabDeOab', '________')}, advogado(a) habilitado(a) nos autos do processo nº ${seg(m, 'protocolo', '________')}, em que contende ${seg(m, 'cliente', '[PARTE]')} contra ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}, SUBSTABELECE, SEM RESERVA DE PODERES, os poderes que lhe foram conferidos ao(à) Dr(a). ${seg(m, 'substabPara', '[ADVOGADO SUBSTABELECIDO]')}, OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'substabParaOab', '________')}, para que represente a parte em todos os atos do processo.`,
        '',
        `${hojeBR()}.`,
        '',
        '____________________________',
        seg(m, 'substabDe', '[ADVOGADO CEDENTE]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'substabDeOab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'substabelecimento-com-reserva',
    categoria: 'Substabelecimento',
    titulo: 'Substabelecimento COM Reserva',
    descricao: 'Transfere poderes mantendo reserva para o cedente.',
    campos: ['protocolo', 'cliente', 'substabDe', 'substabDeOab', 'substabPara', 'substabParaOab', 'uf', 'banco'],
    render: (m) =>
      [
        'SUBSTABELECIMENTO COM RESERVA DE PODERES',
        '',
        `Pelo presente instrumento, ${seg(m, 'substabDe', '[ADVOGADO CEDENTE]')}, OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'substabDeOab', '________')}, SUBSTABELECE, COM RESERVA DE PODERES, ao(à) Dr(a). ${seg(m, 'substabPara', '[ADVOGADO SUBSTABELECIDO]')}, OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'substabParaOab', '________')}, os poderes recebidos nos autos do processo nº ${seg(m, 'protocolo', '________')}, em que contende ${seg(m, 'cliente', '[PARTE]')} contra ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}, permanecendo o(a) substabelecente com plenos poderes para acompanhar e praticar todos os atos processuais.`,
        '',
        `${hojeBR()}.`,
        '',
        '____________________________',
        seg(m, 'substabDe', '[ADVOGADO CEDENTE]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'substabDeOab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'revogacao-poderes',
    categoria: 'Revogação',
    titulo: 'Carta de Revogação de Poderes',
    descricao: 'Revoga o mandato anterior e, opcionalmente, substabelece.',
    campos: ['cliente', 'advogado', 'oab', 'uf', 'protocolo', 'banco'],
    render: (m) =>
      [
        'REVOGAÇÃO DE MANDATO / PODERES',
        '',
        `${seg(m, 'cliente', '[NOME DO OUTORGANTE]')} vem, por meio desta, REVOGAR, nos termos do art. 686 do Código Civil, os poderes anteriormente conferidos ao(à) advogado(a) ${seg(m, 'advogado', '[NOME DO ADVOGADO REVOGADO]')}, OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}, referentes ao processo/contrato nº ${seg(m, 'protocolo', '________')}${m.banco ? `, mantido junto a ${seg(m, 'banco', '________')}` : ''}, ficando sem efeito qualquer ato praticado por este(a) a partir da presente data.`,
        '',
        m.resumo ? `Observações: ${m.resumo}` : '',
        `${hojeBR()}.`,
        '',
        '____________________________',
        seg(m, 'cliente', '[NOME DO OUTORGANTE]').toUpperCase(),
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'peticao-informacoes',
    categoria: 'Petições',
    titulo: 'Petição de Informações / Certidão',
    descricao: 'Requer certidão de andamento e cópia dos atos.',
    campos: ['protocolo', 'cliente', 'banco', 'orgao', 'comarca', 'advogado', 'oab', 'uf'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        '',
        'PETIÇÃO DE INFORMAÇÕES',
        '',
        `${seg(m, 'cliente', '[PARTE AUTORA]')}, nos autos do processo em epígrafe, em que contende contra ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}, vem requerer a Vossa Excelência seja determinada à serventia a expedição de certidão atualizada de andamento processual e cópia dos atos disponíveis, para acompanhamento e providências cabíveis.`,
        '',
        'Termos em que pede deferimento.',
        '',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO ADVOGADO]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'peticao-juntada',
    categoria: 'Petições',
    titulo: 'Petição de Juntada',
    descricao: 'Juntada de procuração e documentos de habilitação.',
    campos: ['protocolo', 'cliente', 'banco', 'orgao', 'comarca', 'advogado', 'oab', 'uf'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        '',
        'PETIÇÃO DE JUNTADA',
        '',
        `Nos termos do art. 287 do CPC, requer a juntada da procuração e documentos de habilitação do(a) patrono(a) do polo ativo, ${seg(m, 'cliente', '[PARTE]')}, bem como a intimação da parte contrária, ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}, para os atos processuais pertinentes.`,
        '',
        'Termos em que pede deferimento.',
        '',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO ADVOGADO]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'peticao-urgencia',
    categoria: 'Petições',
    titulo: 'Petição de Tutela de Urgência',
    descricao: 'Requere tutela de urgência (art. 300 do CPC).',
    campos: ['protocolo', 'cliente', 'banco', 'orgao', 'comarca', 'advogado', 'oab', 'uf', 'resumo'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        '',
        'PEDIDO DE TUTELA DE URGÊNCIA',
        '',
        `A parte autora, ${seg(m, 'cliente', '[PARTE]')}, requer, com fundamento no art. 300 do CPC, a concessão de tutela de urgência em face de ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}.`,
        '',
        m.resumo ? `Fundamentação: ${m.resumo}` : 'Demonstra-se a probabilidade do direito e o perigo de dano ou risco ao resultado útil do processo, razão pela qual se justifica a medida liminar.',
        '',
        'Termos em que pede deferimento.',
        '',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO ADVOGADO]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'peticao-atualizacao',
    categoria: 'Petições',
    titulo: 'Petição de Atualização Cadastral',
    descricao: 'Atualiza dados de endereço, telefone e e-mail da parte.',
    campos: ['protocolo', 'cliente', 'banco', 'orgao', 'comarca', 'advogado', 'oab', 'uf'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        '',
        'PETIÇÃO DE ATUALIZAÇÃO CADASTRAL',
        '',
        `A parte ${seg(m, 'cliente', '[PARTE]')} requer o registro de atualização cadastral nos autos (endereço, telefone e e-mail), nos termos do art. 77, V, do CPC, para fins de intimação, devendo constar dos sistemas do juízo os novos dados.`,
        '',
        'Termos em que pede deferimento.',
        '',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO ADVOGADO]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n'),
  },
  {
    id: 'carta-banco-documentos',
    categoria: 'Cartas',
    titulo: 'Carta ao Banco — Cópia do Contrato',
    descricao: 'Solicita cópia do contrato e demonstrativo ao banco.',
    campos: ['banco', 'cliente', 'protocolo', 'advogado', 'oab', 'uf'],
    render: cartaComum,
  },
  {
    id: 'carta-banco-revisao',
    categoria: 'Cartas',
    titulo: 'Carta ao Banco — Notificação de Revisão',
    descricao: 'Notifica o banco sobre cobrança indevida e intenção de revisão.',
    campos: ['banco', 'cliente', 'protocolo', 'advogado', 'oab', 'uf', 'resumo'],
    render: (m) => {
      const banco = seg(m, 'banco', '[INSTITUIÇÃO FINANCEIRA]');
      return [
        banco.toUpperCase(),
        'Departamento Jurídico / Ouvidoria',
        '',
        `Assunto: Notificação de cobrança indevida / intenção de revisão contratual — ${seg(m, 'cliente', '[NOME DO CLIENTE]')} — Contrato nº ${seg(m, 'protocolo', '________')}`,
        '',
        `${seg(m, 'cliente', '[NOME DO CLIENTE]')} notifica ${banco} sobre a existência de cláusulas e encargos supostamente abusivos (${m.resumo ? m.resumo : 'juros, tarifas e encargos aplicados'}), manifestando a intenção de buscar a revisão contratual, judicialmente ou de forma consensual.`,
        '',
        'Solicita-se resposta escrita no prazo legal, sob pena de serem adotadas as providências cabíveis, inclusive ação revisional. Fica desde já reservado o direito de cobrança em dobro de valores indevidos (art. 42, § único, CDC).',
        '',
        'Termos em que pede deferimento.',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO(A) ADVOGADO(A)]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n');
    },
  },
  {
    id: 'carta-banco-quitacao',
    categoria: 'Cartas',
    titulo: 'Carta ao Banco — Quitação / Baixa de Restrição',
    descricao: 'Requer quitação e baixa de restrição cadastral.',
    campos: ['banco', 'cliente', 'protocolo', 'advogado', 'oab', 'uf'],
    render: (m) => {
      const banco = seg(m, 'banco', '[INSTITUIÇÃO FINANCEIRA]');
      return [
        banco.toUpperCase(),
        'Departamento Jurídico / Ouvidoria',
        '',
        `Assunto: Quitação e baixa de restrição — ${seg(m, 'cliente', '[NOME DO CLIENTE]')} — Contrato nº ${seg(m, 'protocolo', '________')}`,
        '',
        `${seg(m, 'cliente', '[NOME DO CLIENTE]')}, contrato nº ${seg(m, 'protocolo', '________')} junto a ${banco}, requer a emissão de termo de quitação e a imediata baixa de eventuais restrições cadastrais (SPC/Serasa), no prazo previsto em lei, sob pena de responsabilização e de medida judicial.`,
        '',
        'Termos em que pede deferimento.',
        hojeBR(),
        seg(m, 'advogado', '[NOME DO(A) ADVOGADO(A)]').toUpperCase(),
        `OAB${m.uf ? '/' + m.uf : ''} ${seg(m, 'oab', '________')}`,
      ].join('\n');
    },
  },
];

export function renderModelo(modeloId: string, meta: PecaMeta): string | null {
  const modelo = MODELOS_DE_PECAS.find((x) => x.id === modeloId);
  if (!modelo) return null;
  return modelo.render(meta || {});
}

export const CATEGORIAS: CategoriaPeca[] = [
  'Procuração',
  'Habilitação',
  'Substabelecimento',
  'Revogação',
  'Petições',
  'Cartas',
];
