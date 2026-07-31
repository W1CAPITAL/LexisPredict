/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * CATÁLOGO DE SCRIPTS DE GABINETE v1.4 - MÓDULO TYPE-SAFE
 */

export interface ScriptTemplate {
  id: string;
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
  keywords: string[];
  prioridade: number; // 0 (maior) a 6 (menor)
}

export const SCRIPT_CATALOG: ScriptTemplate[] = [
  {
    id: 'baixa_definitiva',
    categoria: 'baixa_definitiva',
    titulo: 'Processo Finalizado (Baixa)',
    texto: 'Olá, [Nome]! Temos uma ótima notícia: o tribunal oficializou a Baixa Definitiva (Trânsito em Julgado) do processo [CNJ]. Isso significa que o caso foi encerrado no sistema judicial e não cabem mais recursos. Nossa equipe agora segue com os ritos internos de arquivamento.',
    quandoUsar: 'Usar quando identificar Trânsito em Julgado ou Baixa Definitiva.',
    keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE', 'CANCELADA A DISTRIBUIÇÃO', 'EXTINÇÃO DO PROCESSO'],
    prioridade: 0
  },
  {
    id: 'busca_apreensao',
    categoria: 'busca_apreensao',
    titulo: 'Alerta de Busca e Apreensão',
    texto: 'URGENTE: Sr(a). [Nome], identificamos um novo andamento de Busca e Apreensão no seu processo [CNJ]. Nossa equipe jurídica já está em prontidão para as medidas de defesa. É fundamental que mantenha o veículo em local seguro e aguarde nossas orientações imediatas.',
    quandoUsar: 'Prioridade Máxima. Usar ao detectar Mandado de Busca ou Liminar de Posse.',
    keywords: ['BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'APREENSÃO DO VEÍCULO', 'LIMINAR DEFERIDA', 'REINTEGRAÇÃO DE POSSE'],
    prioridade: 1
  },
  {
    id: 'liminar_e_jg',
    categoria: 'liminar_e_jg',
    titulo: 'Liminar e Justiça Gratuita Analisadas',
    texto: 'Olá, [Nome]! O juiz realizou a análise dos nossos pedidos iniciais no processo [CNJ], tratando tanto da liminar quanto do pedido de Justiça Gratuita. Nossa equipe jurídica já está analisando o teor detalhado desta decisão para os próximos passos. Seguimos acompanhando de perto.',
    quandoUsar: 'Usar quando houver movimentos de Liminar e Justiça Gratuita na mesma janela.',
    keywords: ['LIMINAR', 'ASSISTÊNCIA JUDICIÁRIA', 'JUSTIÇA GRATUITA', 'GRATUIDADE'],
    prioridade: 1
  },
  {
    id: 'liminar_analisada',
    categoria: 'liminar_analisada',
    titulo: 'Análise de Liminar',
    texto: 'Olá, [Nome]! Houve uma atualização importante: o juiz apreciou o pedido de liminar no seu processo [CNJ]. Nossos advogados estão realizando a leitura técnica da decisão para verificar os termos decididos e as providências necessárias. Entraremos em contato com o parecer completo.',
    quandoUsar: 'Usar quando houver análise de Liminar/Tutela sem deferimento/indeferimento explícito no nome.',
    keywords: ['LIMINAR', 'TUTELA', 'ANTECIPAÇÃO DE TUTELA', 'DECISÃO INTERLOCUTÓRIA'],
    prioridade: 1
  },
  {
    id: 'justica_gratuita',
    categoria: 'justica_gratuita',
    titulo: 'Justiça Gratuita Apreciada',
    texto: 'Oi, [Nome]! O pedido de Justiça Gratuita do processo [CNJ] foi analisado pelo juízo. Esta é uma etapa importante para a continuidade da ação sem custos processuais imediatos. Nossa equipe está conferindo o despacho para garantir que tudo esteja regularizado.',
    quandoUsar: 'Usar quando houver menção à gratuidade da justiça ou assistência judiciária.',
    keywords: ['ASSISTÊNCIA JUDICIÁRIA', 'JUSTIÇA GRATUITA', 'GRATUIDADE'],
    prioridade: 1
  },
  {
    id: 'sentenca_improcedente',
    categoria: 'sentenca_improcedente',
    titulo: 'Sentença Desfavorável (Análise)',
    texto: 'Olá, [Nome]! Informamos que o juiz proferiu uma sentença improcedente no processo [CNJ]. Nossa equipe jurídica já está realizando a leitura técnica dos fundamentos da decisão para preparar o recurso cabível e buscar a reforma da sentença.',
    quandoUsar: 'Usar quando houver improcedência total ou parcial desfavorável.',
    keywords: ['IMPROCEDENTE', 'IMPROCEDÊNCIA', 'NEGADO PROVIMENTO'],
    prioridade: 2
  },
  {
    id: 'apelacao',
    categoria: 'apelacao',
    titulo: 'Interposição de Recurso (Apelação)',
    texto: 'Olá, [Nome]! Informamos que houve o protocolo do Recurso de Apelação no processo [CNJ]. Este procedimento visa levar o caso para reapreciação pelos desembargadores no tribunal de segunda instância. Seguimos monitorando o prazo de remessa.',
    quandoUsar: 'Usar quando houver interposição de recurso ou apelação.',
    keywords: ['APELAÇÃO', 'APELACAO', 'RECURSO INOMINADO', 'CONTRARRAZÕES'],
    prioridade: 2
  },
  {
    id: 'cumprimento',
    categoria: 'cumprimento',
    titulo: 'Fase de Pagamento (Execução)',
    texto: 'Olá, [Nome]! O processo [CNJ] entrou em fase de Cumprimento de Sentença. Este é o momento em que o tribunal busca a satisfação do crédito ou cumprimento da ordem judicial decidida. Estamos acompanhando os prazos para garantir a efetividade da vitória.',
    quandoUsar: 'Usar ao detectar início de execução ou cumprimento de sentença.',
    keywords: ['CUMPRIMENTO DE SENTENÇA', 'EXECUÇÃO DE SENTENÇA', 'FASE DE CUMPRIMENTO', 'CUMPRIMENTO PROVISÓRIO'],
    prioridade: 3
  },
  {
    id: 'contestacao',
    categoria: 'contestacao',
    titulo: 'Apresentação de Defesa',
    texto: 'Olá, [Nome]! A outra parte apresentou a contestação (defesa) no processo [CNJ]. Nossos advogados já estão analisando cada ponto alegado para elaborar a nossa réplica, onde rebateremos os argumentos trazidos por eles.',
    quandoUsar: 'Usar quando o réu protocolar a contestação.',
    keywords: ['CONTESTAÇÃO APRESENTADA', 'JUNTADA DE CONTESTAÇÃO'],
    prioridade: 3
  },
  {
    id: 'conclusos',
    categoria: 'conclusos',
    titulo: 'Aguardando Decisão (Conclusos)',
    texto: 'Oi, [Nome]! O seu processo [CNJ] teve uma atualização técnica: ele foi enviado para a mesa do juiz (conclusos). Isso significa que o processo está na fila para que o magistrado profira uma decisão ou despacho. Estamos monitorando diariamente esse retorno.',
    quandoUsar: 'Usar quando o andamento indicar "Conclusos para despacho/decisão".',
    keywords: ['CONCLUSOS PARA DESPACHO', 'CONCLUSOS PARA DECISÃO', 'CONCLUSOS PARA SENTENÇA'],
    prioridade: 4
  },
  {
    id: 'peticao_juntada',
    categoria: 'peticao_juntada',
    titulo: 'Protocolo de Petição',
    texto: 'Olá, [Nome]! Houve a juntada de uma nova petição no seu processo [CNJ]. Este documento foi protocolado para impulsionar o andamento ou atender a uma determinação do juiz. Aguardamos agora a próxima manifestação do tribunal.',
    quandoUsar: 'Usar quando houver juntada de petição recente sem outras prioridades na janela.',
    keywords: ['PETIÇÃO', 'PETICAO', 'JUNTADA DE PETIÇÃO', 'JUNTADA DE PETICAO', 'PETIÇÃO JUNTADA', 'DOCUMENTO JUNTADO'],
    prioridade: 4
  },
  {
    id: 'citacao',
    categoria: 'citacao',
    titulo: 'Citação do Réu',
    texto: 'Olá, [Nome]! O processo [CNJ] avançou para a fase de citação. O tribunal está notificando oficialmente a outra parte sobre a existência da ação. Este é um passo fundamental para que o processo saia da fase inicial.',
    quandoUsar: 'Usar quando houver expedição de mandado ou carta de citação.',
    keywords: ['CITAÇÃO', 'MANDADO', 'EXPEDIÇÃO DE MANDADO', 'INTIMAÇÃO DO RÉU'],
    prioridade: 5
  },
  {
    id: 'rotina_pos_retorno',
    categoria: 'rotina_pos_retorno',
    titulo: 'Manutenção de Monitoramento',
    texto: 'Olá, [Nome]! Desde nossa última conversa em [Data], o seu processo [CNJ] teve apenas movimentações internas de cartório (atos ordinatórios). Não houve nenhuma decisão nova do juiz que mude o status atual. Seguimos em vigilância constante e qualquer novidade relevante avisaremos imediatamente!',
    quandoUsar: 'Ideal para quando o cliente pergunta e SÓ houve burocracia de cartório desde o último contato.',
    keywords: [],
    prioridade: 6
  },
  {
    id: 'rotina',
    categoria: 'rotina',
    titulo: 'Andamento de Rotina',
    texto: 'Olá, [Nome]! Houve um novo andamento técnico no seu processo [CNJ]. Trata-se de uma atualização de rotina do tribunal (movimentação de cartório). O processo segue seu curso normal e nossa equipe jurídica está acompanhando o fluxo.',
    quandoUsar: 'Usar para andamentos genéricos sem impacto de mérito.',
    keywords: ['ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'DISPONIBILIZAÇÃO', 'PUBLICAÇÃO', 'REMESSA', 'RECEBIMENTO'],
    prioridade: 6
  }
];
