/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * CATÁLOGO DE SCRIPTS DE GABINETE v1.1
 */

export interface ScriptTemplate {
  id: string;
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
  keywords: string[];
}

export const SCRIPT_CATALOG: ScriptTemplate[] = [
  {
    id: 'rotina_pos_retorno',
    categoria: 'rotina_pos_retorno',
    titulo: 'Manutenção de Monitoramento',
    texto: 'Olá, [Nome]! Desde nossa última conversa em [Data], o seu processo [CNJ] teve apenas movimentações internas de cartório (atos ordinatórios). Não houve nenhuma decisão nova do juiz que mude o status atual. Seguimos em vigilância constante e qualquer novidade relevante avisaremos imediatamente!',
    quandoUsar: 'Ideal para quando o cliente pergunta e só houve burocracia de cartório desde o último contato.',
    keywords: []
  },
  {
    id: 'baixa_definitiva',
    categoria: 'baixa_definitiva',
    titulo: 'Processo Finalizado (Baixa)',
    texto: 'Olá, [Nome]! Temos uma ótima notícia: o tribunal oficializou a Baixa Definitiva (Trânsito em Julgado) do processo [CNJ]. Isso significa que o caso foi encerrado no sistema judicial e não cabem mais recursos. Nossa equipe agora segue com os ritos internos de arquivamento.',
    quandoUsar: 'Usar quando identificar Trânsito em Julgado ou Baixa Definitiva.',
    keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE', 'CANCELADA A DISTRIBUIÇÃO', 'EXTINÇÃO DO PROCESSO']
  },
  {
    id: 'busca_apreensao',
    categoria: 'busca_apreensao',
    titulo: 'Alerta de Busca e Apreensão',
    texto: 'URGENTE: Sr(a). [Nome], identificamos um novo andamento de Busca e Apreensão no seu processo [CNJ]. Nossa equipe jurídica já está em prontidão para as medidas de defesa. É fundamental que mantenha o veículo em local seguro e aguarde nossas orientações imediatas.',
    quandoUsar: 'Prioridade Máxima. Usar ao detectar Mandado de Busca ou Liminar de Posse.',
    keywords: ['BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'APREENSÃO DO VEÍCULO', 'LIMINAR DEFERIDA', 'REINTEGRAÇÃO DE POSSE']
  },
  {
    id: 'cumprimento',
    categoria: 'cumprimento',
    titulo: 'Fase de Pagamento (Execução)',
    texto: 'Olá, [Nome]! O processo [CNJ] entrou em fase de Cumprimento de Sentença. Este é o momento em que o tribunal busca a satisfação do crédito ou cumprimento da ordem judicial decidida. Estamos acompanhando os prazos para garantir a efetividade da vitória.',
    quandoUsar: 'Usar ao detectar início de execução ou cumprimento de sentença.',
    keywords: ['CUMPRIMENTO DE SENTENÇA', 'EXECUÇÃO DE SENTENÇA', 'FASE DE CUMPRIMENTO', 'CUMPRIMENTO PROVISÓRIO']
  },
  {
    id: 'sentenca_improcedente',
    categoria: 'sentenca_improcedente',
    titulo: 'Sentença Desfavorável (Análise)',
    texto: 'Olá, [Nome]! Informamos que o juiz proferiu uma sentença improcedente no processo [CNJ]. Nossa equipe jurídica já está realizando a leitura técnica dos fundamentos da decisão para preparar o recurso cabível e buscar a reforma da sentença em instância superior.',
    quandoUsar: 'Usar quando houver improcedência total ou parcial desfavorável.',
    keywords: ['IMPROCEDENTE', 'IMPROCEDÊNCIA', 'NEGADO PROVIMENTO']
  },
  {
    id: 'conclusos',
    categoria: 'conclusos',
    titulo: 'Aguardando Decisão (Conclusos)',
    texto: 'Oi, [Nome]! O seu processo [CNJ] teve uma atualização técnica: ele foi enviado para a mesa do juiz (conclusos). Isso significa que o processo está na fila para que o magistrado profira uma decisão ou sentença. Estamos monitorando diariamente esse retorno.',
    quandoUsar: 'Usar quando o andamento indicar "Conclusos para despacho/decisão".',
    keywords: ['CONCLUSOS PARA DESPACHO', 'CONCLUSOS PARA DECISÃO', 'CONCLUSOS PARA SENTENÇA']
  },
  {
    id: 'decurso',
    categoria: 'decurso',
    titulo: 'Decurso de Prazo',
    texto: 'Olá, [Nome]! O prazo para a parte contrária se manifestar no processo [CNJ] encerrou (decurso). Agora, o processo seguirá para a próxima etapa judicial. Estamos peticionando para que o juiz dê andamento ao feito diante da inércia da outra parte.',
    quandoUsar: 'Usar quando houver decurso de prazo da parte contrária.',
    keywords: ['DECURSO DE PRAZO', 'DECORRIDO O PRAZO', 'PRAZO TRANSCORRIDO']
  },
  {
    id: 'juntada',
    categoria: 'juntada',
    titulo: 'Documentação Protocolada',
    texto: 'Olá, [Nome]! Acabamos de realizar a juntada de novos documentos/petição no seu processo [CNJ]. Esta medida visa reforçar nossos argumentos perante o juízo. Agora aguardamos a análise do magistrado sobre esta nova peça.',
    quandoUsar: 'Usar após protocolos de petições ou documentos.',
    keywords: ['JUNTADA DE PETIÇÃO', 'PETIÇÃO JUNTADA', 'DOCUMENTO JUNTADO']
  },
  {
    id: 'citacao',
    categoria: 'citacao',
    titulo: 'Citação do Réu',
    texto: 'Olá, [Nome]! O processo [CNJ] avançou para a fase de citação. O tribunal está notificando oficialmente a outra parte sobre a existência da ação. Este é um passo fundamental para que o processo saia da fase inicial.',
    quandoUsar: 'Usar quando houver expedição de mandado ou carta de citação.',
    keywords: ['CITAÇÃO', 'MANDADO', 'EXPEDIÇÃO DE MANDADO', 'INTIMAÇÃO DO RÉU']
  },
  {
    id: 'contestacao',
    categoria: 'contestacao',
    titulo: 'Apresentação de Defesa',
    texto: 'Olá, [Nome]! A outra parte apresentou a contestação (defesa) no processo [CNJ]. Nossos advogados já estão analisando cada ponto alegado para elaborar a nossa réplica, onde rebateremos os argumentos trazidos por eles.',
    quandoUsar: 'Usar quando o réu protocolar a contestação.',
    keywords: ['CONTESTAÇÃO APRESENTADA', 'JUNTADA DE CONTESTAÇÃO']
  },
  {
    id: 'rotina',
    categoria: 'rotina',
    titulo: 'Andamento de Rotina',
    texto: 'Olá, [Nome]! Houve um novo andamento técnico no seu processo [CNJ]. Trata-se de uma atualização de rotina do tribunal (movimentação de cartório). O processo segue seu curso normal e nossa equipe jurídica está acompanhando o fluxo.',
    quandoUsar: 'Usar para andamentos genéricos sem impacto de mérito.',
    keywords: ['ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'DISPONIBILIZAÇÃO', 'PUBLICAÇÃO', 'REMESSA', 'RECEBIMENTO']
  }
];
