/**
 * Catálogo de respostas ao cliente — tom profissional, sem marca, sem inventar resultado.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export interface ScriptTemplate {
  id: string;
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
  keywords: string[];
  /** 0 = máxima prioridade */
  prioridade: number;
  /** Se definido, escolhido quando evento_tipo casa */
  eventoTipos?: string[];
}

export const SCRIPT_CATALOG: ScriptTemplate[] = [
  {
    id: 'audiencia',
    categoria: 'merito',
    titulo: 'Audiência designada',
    texto:
      'Olá, [CLIENTE]. Identificamos a designação de audiência no processo [PROTOCOLO] (referência [DataMov]). Nossa equipe está orientando os próximos passos. Em breve entraremos em contato com as orientações práticas. Qualquer dúvida, estamos à disposição.',
    quandoUsar: 'evento_tipo audiência ou texto de audiência pós-retorno',
    keywords: ['AUDIÊNCIA', 'AUDIENCIA', 'CONCILIAÇÃO', 'INSTRUÇÃO'],
    prioridade: 1,
    eventoTipos: ['audiencia_conciliacao', 'audiencia_instrucao', 'audiencia_julgamento'],
  },
  {
    id: 'sentenca_improcedente',
    categoria: 'merito',
    titulo: 'Decisão desfavorável',
    texto:
      'Olá, [CLIENTE]. Houve uma decisão no processo [PROTOCOLO] que não foi favorável ao pedido (referência [DataMov]). Estamos analisando o teor e as medidas cabíveis. Não é necessário comparecer a lugar algum neste momento; retornaremos com a orientação completa.',
    quandoUsar: 'sentença improcedente',
    keywords: ['IMPROCEDENTE', 'JULGO IMPROCEDENTE'],
    prioridade: 0,
    eventoTipos: ['sentenca_improcedente'],
  },
  {
    id: 'sentenca_procedente',
    categoria: 'merito',
    titulo: 'Decisão favorável',
    texto:
      'Olá, [CLIENTE]. Registramos uma decisão favorável no processo [PROTOCOLO] (referência [DataMov]). Estamos conferindo os detalhes e os próximos atos. Em breve alinhamos os passos seguintes com você.',
    quandoUsar: 'sentença procedente',
    keywords: ['PROCEDENTE'],
    prioridade: 0,
    eventoTipos: ['sentenca_procedente'],
  },
  {
    id: 'baixa_tribunal',
    categoria: 'baixa',
    titulo: 'Encerramento / trânsito',
    texto:
      'Olá, [CLIENTE]. Identificamos movimentação de encerramento ou trânsito no processo [PROTOCOLO]. Estamos validando o teor no sistema do tribunal e, em seguida, confirmamos o que isso significa no seu caso e quais providências restam, se houver.',
    quandoUsar: 'baixa / trânsito',
    keywords: ['TRÂNSITO', 'TRANSITO', 'BAIXA DEFINITIVA', 'ARQUIVAMENTO', 'EXTINÇÃO'],
    prioridade: 0,
    eventoTipos: ['transito_ou_baixa', 'transito_baixa'],
  },
  {
    id: 'cumprimento',
    categoria: 'execucao',
    titulo: 'Fase de cumprimento',
    texto:
      'Olá, [CLIENTE]. O processo [PROTOCOLO] apresenta indícios de fase de cumprimento de sentença. Estamos revisando os atos e o que compete à nossa atuação. Retornamos com orientação objetiva.',
    quandoUsar: 'cumprimento de sentença',
    keywords: ['CUMPRIMENTO DE SENTENÇA', 'EXECUÇÃO'],
    prioridade: 2,
    eventoTipos: ['cumprimento_sentenca'],
  },
  {
    id: 'nova_movimentacao',
    categoria: 'andamento',
    titulo: 'Nova movimentação',
    texto:
      'Olá, [CLIENTE]. Houve uma nova movimentação no processo [PROTOCOLO] após nosso último contato ([Data]). Estamos analisando o conteúdo ([DataMov]) e retornamos com a orientação adequada, sem antecipar conclusões.',
    quandoUsar: 'novidade pós-retorno genérica',
    keywords: ['MOVIMENTAÇÃO', 'JUNTADA', 'PETIÇÃO', 'DESPACHO'],
    prioridade: 3,
    eventoTipos: ['novo_andamento_relevante'],
  },
  {
    id: 'publicacao_diario',
    categoria: 'andamento',
    titulo: 'Publicação no diário',
    texto:
      'Olá, [CLIENTE]. Há publicação oficial relacionada ao processo [PROTOCOLO]. Nossa equipe está lendo o teor e, se houver prazo ou providência, avisamos com antecedência e clareza.',
    quandoUsar: 'DJEN / publicação',
    keywords: ['INTIMAÇÃO', 'PUBLICAÇÃO', 'DJEN', 'DIÁRIO'],
    prioridade: 3,
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
