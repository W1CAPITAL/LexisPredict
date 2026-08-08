/**
 * D3 — Cobertura completa: biblioteca central de modelos reutilizáveis de peças.
 * Princípio de especificidade: só cita banco/CNPJ/processo se o meta trouxer o dado;
 * caso contrário a peça permanece limpa e reutilizável.
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
  enderecoCliente?: string;
  banco?: string;
  cnpjBanco?: string;
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
  valorContrato?: string;
  valorProposta?: string;
  protocoloProcon?: string;
  cidade?: string;
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

/** Só inclui o trecho se o campo existir — evita peças genéricas “cheias de colchetes”. */
function se(m: PecaMeta, k: keyof PecaMeta, template: (v: string) => string): string {
  const v = m[k];
  if (typeof v !== 'string' || !v.trim()) return '';
  return template(v.trim());
}

function juntar(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((p) => typeof p === 'string' && p.length > 0).join('\n');
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

  {
    id: 'procuracao-ad-judicia-et-extra',
    categoria: 'Procuração',
    titulo: 'Procuração Ad Judicia et Extra (completa)',
    descricao: 'Poderes judiciais e extrajudiciais amplos, com cláusula de foro e substabelecimento.',
    campos: ['cliente', 'cpfCliente', 'rgCliente', 'enderecoCliente', 'advogado', 'oab', 'uf', 'banco', 'cnpjBanco', 'protocolo', 'cidade', 'data'],
    render: (m) =>
      [
        'PROCURAÇÃO "AD JUDICIA ET EXTRA"',
        '',
        `OUTORGANTE: ${seg(m, 'cliente', '[NOME COMPLETO]')}, portador(a) do CPF nº ${seg(m, 'cpfCliente', '[CPF]')} e RG nº ${seg(m, 'rgCliente', '[RG]')}, residente e domiciliado(a) em ${seg(m, 'enderecoCliente', '[ENDEREÇO COMPLETO]')}.`,
        '',
        `OUTORGADO(A): ${seg(m, 'advogado', '[NOME DO ADVOGADO]')}, inscrito(a) na OAB/${seg(m, 'uf', 'SP')} sob o nº ${seg(m, 'oab', '[NÚMERO]')}, com escritório profissional no foro da comarca competente.`,
        '',
        'PODERES: Por este instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui seu bastante procurador o(a) OUTORGADO(A), a quem confere amplos poderes para o foro em geral, com a cláusula "ad judicia et extra", podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo uma, outras e demais instâncias, usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes especiais para confessar, reconhecer a procedência do pedido, desistir, renunciar ao direito sobre o qual se funda a ação, firmar compromissos ou acordos, receber e dar quitação, agindo em conjunto ou isoladamente, podendo substabelecer esta a outrem, com ou sem reservas de poderes.',
        '',
        m.banco
          ? `Abrange, em especial, medidas judiciais e extrajudiciais relativas a contratos e relações mantidas junto a ${seg(m, 'banco', '[INSTITUIÇÃO]')}${m.cnpjBanco ? `, CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}${m.protocolo ? `, inclusive processo/contrato nº ${seg(m, 'protocolo', '')}` : ''}.`
          : 'Abrange todas as medidas judiciais e extrajudiciais necessárias à defesa dos interesses do(a) OUTORGANTE.',
        '',
        `Local e data: ${seg(m, 'cidade', '[CIDADE]')}, ${seg(m, 'data', hojeBR())}.`,
        '',
        '_________________________________',
        seg(m, 'cliente', '[NOME DO OUTORGANTE]').toUpperCase(),
        'OUTORGANTE',
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'habilitacao-completa',
    categoria: 'Habilitação',
    titulo: 'Habilitação nos autos (completa)',
    descricao: 'Petição de habilitação com qualificação, poderes e pedidos finais.',
    campos: ['protocolo', 'cliente', 'cpfCliente', 'banco', 'cnpjBanco', 'orgao', 'comarca', 'tribunal', 'classeAcao', 'advogado', 'oab', 'uf', 'resumo'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        m.tribunal ? `${seg(m, 'tribunal', '')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        m.classeAcao ? `Classe: ${seg(m, 'classeAcao', '')}` : '',
        '',
        'HABILITAÇÃO',
        '',
        `${seg(m, 'advogado', '[NOME DO ADVOGADO]')}, inscrito(a) na OAB/${seg(m, 'uf', 'SP')} sob o nº ${seg(m, 'oab', '________')}, vem, respeitosamente, à presença de Vossa Excelência, com fulcro no art. 105 do Código de Processo Civil, requerer sua HABILITAÇÃO nos autos em epígrafe, na qualidade de patrono(a) de ${seg(m, 'cliente', '[NOME DA PARTE]')}${m.cpfCliente ? `, CPF ${seg(m, 'cpfCliente', '')}` : ''}, em face de ${seg(m, 'banco', '[PARTE CONTRÁRIA]')}${m.cnpjBanco ? `, CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}.`,
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
        hojeBR(),
        '',
        seg(m, 'advogado', '[NOME DO ADVOGADO]').toUpperCase(),
        `OAB/${seg(m, 'uf', 'SP')} ${seg(m, 'oab', '________')}`,
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'extrajudicial-notificacao',
    categoria: 'Extrajudicial',
    titulo: 'Notificação extrajudicial ao credor',
    descricao: 'Notificação formal para revisão/negociação de contrato bancário.',
    campos: ['cliente', 'cpfCliente', 'banco', 'cnpjBanco', 'protocolo', 'valorContrato', 'resumo', 'cidade', 'data'],
    render: (m) =>
      [
        'NOTIFICAÇÃO EXTRAJUDICIAL',
        '',
        `AO(À): ${seg(m, 'banco', '[INSTITUIÇÃO FINANCEIRA]').toUpperCase()}${m.cnpjBanco ? ` — CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}`,
        '',
        `NOTIFICANTE: ${seg(m, 'cliente', '[NOME]')}, CPF ${seg(m, 'cpfCliente', '[CPF]')}.`,
        '',
        `REF.: Contrato/operação nº ${seg(m, 'protocolo', '[NÚMERO]')}${m.valorContrato ? `, valor de referência ${seg(m, 'valorContrato', '')}` : ''}.`,
        '',
        'Prezados Senhores,',
        '',
        'Vimos, por meio da presente, NOTIFICAR extrajudicialmente V. Sas. para que, no prazo de 10 (dez) dias úteis, apresentem demonstrativo detalhado do contrato em referência (CET, taxas, seguros, tarifas e evolução do saldo), bem como indiquem canal formal para proposta de composição amigável, sob pena de adoção das medidas judiciais e administrativas cabíveis.',
        '',
        m.resumo ? `Fundamentos e pedidos específicos: ${m.resumo}` : '',
        '',
        'Esta notificação não implica reconhecimento de dívida além do eventualmente devido, nem renúncia a direitos.',
        '',
        `${seg(m, 'cidade', '[CIDADE]')}, ${seg(m, 'data', hojeBR())}.`,
        '',
        '_________________________________',
        seg(m, 'cliente', '[NOME]').toUpperCase(),
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'procon-resposta',
    categoria: 'PROCON',
    titulo: 'Minuta de resposta / defesa PROCON',
    descricao: 'Estrutura de resposta a reclamação no PROCON (consumidor ou assessoria).',
    campos: ['cliente', 'cpfCliente', 'banco', 'protocoloProcon', 'protocolo', 'resumo', 'cidade', 'data'],
    render: (m) =>
      [
        'ILUSTRÍSSIMO(A) SENHOR(A) DIRETOR(A) / ATENDENTE DO PROCON',
        '',
        `Protocolo PROCON nº ${seg(m, 'protocoloProcon', '[NÚMERO PROCON]')}`,
        m.protocolo ? `Contrato/processo relacionado: ${seg(m, 'protocolo', '')}` : '',
        '',
        `Reclamante: ${seg(m, 'cliente', '[NOME]')}, CPF ${seg(m, 'cpfCliente', '[CPF]')}.`,
        `Reclamado: ${seg(m, 'banco', '[FORNECEDOR / INSTITUIÇÃO]')}.`,
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
        `${seg(m, 'cidade', '[CIDADE]')}, ${seg(m, 'data', hojeBR())}.`,
        '',
        '_________________________________',
        'Representante / Interessado',
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'quitacao-proposta',
    categoria: 'Quitação',
    titulo: 'Proposta de quitação / acordo',
    descricao: 'Carta formal de proposta de quitação com valor e condições.',
    campos: ['cliente', 'cpfCliente', 'banco', 'cnpjBanco', 'protocolo', 'valorContrato', 'valorProposta', 'resumo', 'cidade', 'data'],
    render: (m) =>
      [
        'PROPOSTA DE QUITAÇÃO / ACORDO EXTRAJUDICIAL',
        '',
        `Destinatário: ${seg(m, 'banco', '[CREDOR]').toUpperCase()}${m.cnpjBanco ? `, CNPJ ${seg(m, 'cnpjBanco', '')}` : ''}`,
        `Proponente: ${seg(m, 'cliente', '[NOME]')}, CPF ${seg(m, 'cpfCliente', '[CPF]')}`,
        `Contrato nº ${seg(m, 'protocolo', '[NÚMERO]')}`,
        m.valorContrato ? `Saldo / valor de referência: ${seg(m, 'valorContrato', '')}` : '',
        '',
        `PROPOSTA: O proponente oferece a quantia de ${seg(m, 'valorProposta', '[R$ ___]')} para quitação integral do contrato acima, com baixa definitiva de restrições e emissão de termo de quitação no prazo de 5 (cinco) dias úteis após a compensação do pagamento.`,
        '',
        m.resumo ? `Condições adicionais: ${m.resumo}` : 'A proposta é válida por 10 (dez) dias corridos a contar do recebimento.',
        '',
        'Solicita-se resposta formal por escrito (e-mail ou protocolo).',
        '',
        `${seg(m, 'cidade', '[CIDADE]')}, ${seg(m, 'data', hojeBR())}.`,
        '',
        '_________________________________',
        seg(m, 'cliente', '[NOME]').toUpperCase(),
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'limpa-nome-requerimento',
    categoria: 'Limpa Nome',
    titulo: 'Requerimento de baixa em birôs',
    descricao: 'Solicitação de exclusão/baixa de apontamento após quitação ou indevido.',
    campos: ['cliente', 'cpfCliente', 'banco', 'protocolo', 'resumo', 'cidade', 'data'],
    render: (m) =>
      [
        'REQUERIMENTO DE BAIXA / EXCLUSÃO DE APONTAMENTO',
        '',
        `Ao(À) ${seg(m, 'banco', '[CREDOR / GESTOR DE COBRANÇA]')}`,
        'e aos órgãos de proteção ao crédito (SPC, Serasa e congêneres),',
        '',
        `${seg(m, 'cliente', '[NOME]')}, CPF ${seg(m, 'cpfCliente', '[CPF]')}, requer a imediata BAIXA de qualquer apontamento restritivo vinculado ao contrato/operação nº ${seg(m, 'protocolo', '[NÚMERO]')}, ${m.resumo || 'em razão de quitação / ausência de inadimplemento / apontamento indevido, conforme documentos anexos.'}`,
        '',
        'Fundamenta-se no CDC e na legislação aplicável à proteção de dados e crédito ao consumidor, requerendo comunicação da baixa no prazo legal.',
        '',
        `${seg(m, 'cidade', '[CIDADE]')}, ${seg(m, 'data', hojeBR())}.`,
        '',
        '_________________________________',
        seg(m, 'cliente', '[NOME]').toUpperCase(),
      ].filter(Boolean).join('\n'),
  },
  {
    id: 'peticao-cumprimento',
    categoria: 'Petições',
    titulo: 'Petição — cumprimento de sentença',
    descricao: 'Requer início ou andamento de cumprimento de sentença.',
    campos: ['protocolo', 'cliente', 'banco', 'orgao', 'comarca', 'advogado', 'oab', 'uf', 'resumo', 'valorContrato'],
    render: (m) =>
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
        m.orgao ? `Da ${seg(m, 'orgao', '________')}` : '',
        m.comarca ? `Comarca de ${seg(m, 'comarca', '________')}` : '',
        '',
        `Processo nº ${seg(m, 'protocolo', '____________________')}`,
        '',
        'REQUERIMENTO DE CUMPRIMENTO DE SENTENÇA',
        '',
        `${seg(m, 'cliente', '[EXEQUENTE]')}, já qualificado(a) nos autos em que contende contra ${seg(m, 'banco', '[EXECUTADO]')}, vem, com fulcro nos arts. 513 e seguintes do CPC, requerer o cumprimento da sentença / acórdão transitado em julgado${m.valorContrato ? `, no valor de ${seg(m, 'valorContrato', '')}` : ''}.`,
        '',
        m.resumo || 'Requer a intimação da parte contrária para cumprimento da obrigação no prazo legal, sob pena de penhora e demais atos executivos.',
        '',
        'Termos em que pede deferimento.',
        '',
        hojeBR(),
        seg(m, 'advogado', '[ADVOGADO]').toUpperCase(),
        `OAB/${seg(m, 'uf', 'SP')} ${seg(m, 'oab', '________')}`,
      ].filter(Boolean).join('\n'),
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
  'Extrajudicial',
  'PROCON',
  'Quitação',
  'Limpa Nome',
];
