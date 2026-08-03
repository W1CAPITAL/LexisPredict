/**
 * Catálogo de scripts ao cliente — Lexis Core
 * Tom: claro, humano, sem promessa indevida, sem marca.
 */

export interface ScriptTemplate {
  id: string;
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
  keywords?: string[];
  prioridade?: number;
  eventoTipos?: string[];
}

export const SCRIPT_CATALOG: ScriptTemplate[] = [
  {
    id: 'alerta_busca_apreensao',
    categoria: 'ba',
    titulo: 'Alerta busca e apreensão',
    texto:
      'Olá, [CLIENTE]. Identificamos indício de Busca e Apreensão no processo [PROTOCOLO]. Trate como prioridade: mantenha o bem em local seguro e evite transferências até nossa orientação. Nossa equipe jurídica já está revisando o teor e retorna com as medidas cabíveis com urgência.',
    quandoUsar: 'indício B.A. / mandado / liminar possessória',
    keywords: ['BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'APREENSÃO DO VEÍCULO', 'MANDADO DE BUSCA', 'REINTEGRAÇÃO DE POSSE'],
    prioridade: 0,
    eventoTipos: ['ba'],
  },
  {
    id: 'baixa_tribunal',
    categoria: 'baixa',
    titulo: 'Encerramento / trânsito',
    texto:
      'Olá, [CLIENTE]. Identificamos movimentação de encerramento ou trânsito no processo [PROTOCOLO]. Estamos validando o teor no sistema do tribunal e, em seguida, confirmamos o que isso significa no seu caso e quais providências restam, se houver.',
    quandoUsar: 'baixa / trânsito',
    keywords: ['TRÂNSITO', 'TRANSITO', 'BAIXA DEFINITIVA', 'ARQUIVAMENTO', 'EXTINÇÃO', 'EXTINTO', 'CANCELAMENTO DA DISTRIBUIÇÃO'],
    prioridade: 0,
    eventoTipos: ['transito_ou_baixa', 'transito_baixa', 'cancelamento_distribuicao'],
  },
  {
    id: 'sentenca_improcedente',
    categoria: 'sentenca',
    titulo: 'Sentença improcedente',
    texto:
      'Olá, [CLIENTE]. Houve sentença no processo [PROTOCOLO] com indício de improcedência. Nossa equipe está lendo os fundamentos com cuidado para avaliar recurso ou outras medidas, sem antecipar resultado. Retornamos com orientação objetiva assim que concluirmos a análise.',
    quandoUsar: 'improcedente / reforma desfavorável',
    keywords: ['IMPROCEDENTE', 'IMPROCEDÊNCIA', 'NEGADO PROVIMENTO', 'RECURSO DO RÉU PROVIDO'],
    prioridade: 1,
    eventoTipos: ['sentenca_improcedente'],
  },
  {
    id: 'sentenca_procedente',
    categoria: 'sentenca',
    titulo: 'Sentença procedente',
    texto:
      'Olá, [CLIENTE]. Identificamos sentença com indício de procedência no processo [PROTOCOLO]. Estamos confirmando o teor e os próximos passos (incluindo eventual cumprimento). Em breve alinhamos com você o que compete à nossa atuação.',
    quandoUsar: 'procedente',
    keywords: ['PROCEDENTE', 'JULGADO PROCEDENTE', 'JULGADA PROCEDENTE'],
    prioridade: 1,
    eventoTipos: ['sentenca_procedente'],
  },
  {
    id: 'sentenca_parcial',
    categoria: 'sentenca',
    titulo: 'Sentença parcial',
    texto:
      'Olá, [CLIENTE]. Houve decisão com indício de procedência parcial no processo [PROTOCOLO]. Estamos detalhando o que foi acolhido e o que não foi, para orientar os próximos passos com precisão.',
    quandoUsar: 'parcialmente procedente',
    keywords: ['PARCIALMENTE PROCEDENTE', 'PROCEDÊNCIA PARCIAL', 'PROCEDENTE EM PARTE'],
    prioridade: 1,
    eventoTipos: ['sentenca_parcial'],
  },
  {
    id: 'cumprimento',
    categoria: 'execucao',
    titulo: 'Fase de cumprimento',
    texto:
      'Olá, [CLIENTE]. O processo [PROTOCOLO] apresenta indícios de fase de cumprimento de sentença. Estamos revisando os atos e o que compete à nossa atuação. Retornamos com orientação objetiva.',
    quandoUsar: 'cumprimento de sentença',
    keywords: ['CUMPRIMENTO DE SENTENÇA', 'EXECUÇÃO DE SENTENÇA', 'FASE DE CUMPRIMENTO'],
    prioridade: 2,
    eventoTipos: ['cumprimento_sentenca'],
  },
  {
    id: 'liminar',
    categoria: 'urgencia',
    titulo: 'Liminar / tutela',
    texto:
      'Olá, [CLIENTE]. Houve movimentação relacionada a liminar ou tutela no processo [PROTOCOLO]. Estamos confirmando se houve deferimento ou indeferimento e o impacto prático no seu caso. Retorno em breve com clareza.',
    quandoUsar: 'liminar / tutela de urgência',
    keywords: ['LIMINAR', 'TUTELA DE URGÊNCIA', 'ANTECIPAÇÃO DE TUTELA', 'TUTELA ANTECIPADA'],
    prioridade: 2,
    eventoTipos: ['liminar'],
  },
  {
    id: 'audiencia',
    categoria: 'audiencia',
    titulo: 'Audiência designada',
    texto:
      'Olá, [CLIENTE]. Identificamos designação ou atualização de audiência no processo [PROTOCOLO]. Confirmaremos data, horário e se sua presença é necessária. Qualquer preparo importante será alinhado com antecedência.',
    quandoUsar: 'audiência',
    keywords: ['AUDIÊNCIA', 'AUDIENCIA', 'CONCILIAÇÃO', 'MEDIAÇÃO', 'INSTRUÇÃO'],
    prioridade: 2,
    eventoTipos: ['audiencia_julgamento', 'audiencia_instrucao', 'audiencia_conciliacao'],
  },
  {
    id: 'emenda_docs',
    categoria: 'pendencia',
    titulo: 'Emenda / documentos',
    texto:
      'Olá, [CLIENTE]. O juízo solicitou adequação ou documentos no processo [PROTOCOLO]. Estamos identificando exatamente o que falta. Se precisarmos de algo da sua parte (documento, assinatura ou informação), avisamos com prazo e orientação clara.',
    quandoUsar: 'emenda à inicial / documentos',
    keywords: ['EMENDA', 'EMENDE', 'ADITAMENTO', 'DOCUMENTAÇÃO', 'REGULARIZAÇÃO'],
    prioridade: 3,
  },
  {
    id: 'ajg',
    categoria: 'pendencia',
    titulo: 'Justiça gratuita',
    texto:
      'Olá, [CLIENTE]. Há movimentação ligada à Justiça Gratuita no processo [PROTOCOLO]. Estamos confirmando se o benefício foi deferido ou se há pendência de comprovação. Assim que houver definição, informamos o efeito prático para você.',
    quandoUsar: 'AJG / gratuidade',
    keywords: ['JUSTIÇA GRATUITA', 'AJG', 'GRATUIDADE', 'HIPOSSUFICI'],
    prioridade: 3,
  },
  {
    id: 'conclusos',
    categoria: 'andamento',
    titulo: 'Conclusos ao juiz',
    texto:
      'Olá, [CLIENTE]. O processo [PROTOCOLO] foi à conclusão (mesa do juiz) para despacho ou decisão. Não há, neste momento, um novo julgamento publicado — estamos monitorando o retorno do magistrado e avisamos qualquer novidade relevante.',
    quandoUsar: 'conclusos',
    keywords: ['CONCLUSOS', 'CONCLUSO PARA', 'CONCLUSÃO'],
    prioridade: 4,
  },
  {
    id: 'nova_movimentacao',
    categoria: 'andamento',
    titulo: 'Nova movimentação',
    texto:
      'Olá, [CLIENTE]. Houve uma nova movimentação no processo [PROTOCOLO] após nosso último contato ([Data]). Estamos analisando o conteúdo ([DataMov]) e retornamos com a orientação adequada, sem antecipar conclusões.',
    quandoUsar: 'novidade pós-retorno genérica',
    keywords: ['MOVIMENTAÇÃO', 'JUNTADA', 'PETIÇÃO', 'DESPACHO', 'INTIMAÇÃO'],
    prioridade: 5,
    eventoTipos: ['novo_andamento_relevante'],
  },
  {
    id: 'publicacao_diario',
    categoria: 'andamento',
    titulo: 'Publicação no diário',
    texto:
      'Olá, [CLIENTE]. Há publicação oficial relacionada ao processo [PROTOCOLO]. Nossa equipe está lendo o teor e, se houver prazo ou providência, avisamos com antecedência e clareza.',
    quandoUsar: 'DJEN / publicação',
    keywords: ['INTIMAÇÃO', 'PUBLICAÇÃO', 'DJEN', 'DIÁRIO', 'DISPONIBILIZAÇÃO'],
    prioridade: 5,
  },
  {
    id: 'rotina_cartorio',
    categoria: 'rotina',
    titulo: 'Movimentação de cartório',
    texto:
      'Olá, [CLIENTE]. No processo [PROTOCOLO] houve atualização de rotina de cartório (ato ordinatório/expediente interno). Não altera, por si só, o mérito do caso. Seguimos monitorando e comunicamos qualquer decisão ou prazo relevante.',
    quandoUsar: 'ato ordinatório / mero expediente',
    keywords: ['ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'AUTOS NO CARTÓRIO'],
    prioridade: 8,
  },
  {
    id: 'prazo_retorno',
    categoria: 'rotina',
    titulo: 'Retorno de acompanhamento',
    texto:
      'Olá, [CLIENTE]. Passando para atualizar o acompanhamento do processo [PROTOCOLO]. Seguimos monitorando os andamentos e qualquer novidade relevante será comunicada. Se precisar de algo neste intervalo, responda esta mensagem.',
    quandoUsar: 'contato de rotina / prazo',
    keywords: [],
    prioridade: 9,
  },
];
