/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * CATÁLOGO DE SCRIPTS DE GABINETE v2.0 - FOCO EM CX E BLINDAGEM DE BACK-OFFICE
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
    categoria: 'baixa',
    titulo: 'Processo Finalizado (Baixa)',
    texto: 'Olá, [Nome]! Informamos que o tribunal oficializou o encerramento do processo [CNJ] através da Baixa Definitiva (Trânsito em Julgado). Isso indica que o caso atingiu sua etapa final no sistema judicial e não cabem mais recursos. Nossa equipe segue agora com os ritos internos de arquivamento.',
    quandoUsar: 'Usar quando identificar Trânsito em Julgado ou Baixa Definitiva.',
    keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE', 'CANCELADA A DISTRIBUIÇÃO', 'EXTINÇÃO DO PROCESSO'],
    prioridade: 0
  },
  {
    id: 'sentenca_procedente',
    categoria: 'sentenca',
    titulo: 'Vitória: Pedido Julgado Procedente',
    texto: 'Olá, [Nome]! Temos uma atualização vitoriosa: o juiz proferiu sentença julgando PROCEDENTE o pedido no processo [CNJ]. O magistrado acolheu nossa tese e decidiu favoravelmente à sua demanda. Nossos advogados estão realizando a leitura técnica completa da decisão para os próximos passos.',
    quandoUsar: 'Usar quando houver procedência total dos pedidos.',
    keywords: ['JULGADO PROCEDENTE', 'JULGADA PROCEDENTE', 'PEDIDO ACOLHIDO', 'SENTENÇA DE PROCEDÊNCIA'],
    prioridade: 0
  },
  {
    id: 'sentenca_parcial',
    categoria: 'sentenca',
    titulo: 'Vitória Parcial: Pedido Acolhido',
    texto: 'Olá, [Nome]! Informamos que houve a prolação de sentença PARCIALMENTE PROCEDENTE no processo [CNJ]. Isso significa que o juiz acolheu parte fundamental dos nossos pedidos. Nossa equipe jurídica está analisando os fundamentos para verificar a necessidade de recurso ou se seguiremos para a fase de execução.',
    quandoUsar: 'Usar quando houver procedência parcial.',
    keywords: ['PARCIALMENTE PROCEDENTE', 'PROCEDENTE EM PARTE'],
    prioridade: 0
  },
  {
    id: 'busca_apreensao',
    categoria: 'ba',
    titulo: 'Alerta de Busca e Apreensão',
    texto: 'URGENTE: Sr(a). [Nome], identificamos um novo andamento de Busca e Apreensão no seu processo [CNJ]. Nossa equipe jurídica já está em prontidão para as medidas de defesa. É fundamental que mantenha o veículo em local seguro e aguarde nossas orientações imediatas.',
    quandoUsar: 'Prioridade Máxima. Usar ao detectar Mandado de Busca ou ritos de apreensão.',
    keywords: ['BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'APREENSÃO', 'APREENSAO', 'REINTEGRAÇÃO DE POSSE'],
    prioridade: 1
  },
  {
    id: 'liminar_deferida',
    categoria: 'liminar',
    titulo: 'Liminar Deferida pelo Juiz',
    texto: 'Olá, [Nome]! Temos uma atualização positiva: o juiz DEFERIU o pedido de liminar (tutela) no processo [CNJ]. Esta é uma vitória estratégica inicial que resguarda seus direitos logo no começo da ação. Nossa equipe jurídica está analisando os detalhes da decisão para orientar os próximos passos.',
    quandoUsar: 'Usar quando houver deferimento/concessão explícita de liminar ou tutela.',
    keywords: ['LIMINAR DEFERIDA', 'TUTELA DEFERIDA', 'TUTELA CONCEDIDA', 'DEFERIDA A TUTELA', 'CONCEDIDA A ANTECIPAÇÃO', 'DEFERIDA A MEDIDA', 'DEFERIDA A ANTECIPACAO'],
    prioridade: 1
  },
  {
    id: 'liminar_indeferida',
    categoria: 'liminar',
    titulo: 'Liminar Indeferida (Análise)',
    texto: 'Olá, [Nome]! Informamos que o pedido de liminar no processo [CNJ] foi indeferido nesta etapa inicial. Ressaltamos que esta é uma decisão interlocutória e não encerra o caso. Nossos advogados estão analisando os fundamentos para verificar a viabilidade de recurso ou outras estratégias de defesa.',
    quandoUsar: 'Usar quando houver indeferimento ou negativa explícita de liminar ou tutela.',
    keywords: ['LIMINAR INDEFERIDA', 'TUTELA INDEFERIDA', 'INDEFERIDA A TUTELA', 'NEGADA A ANTECIPAÇÃO', 'INDEFERIDA A MEDIDA', 'INDEFERIDA A ANTECIPACAO'],
    prioridade: 1
  },
  {
    id: 'acordao',
    categoria: 'recurso',
    titulo: 'Julgamento de 2º Grau (Acórdão)',
    texto: 'Olá, [Nome]! Informamos que houve o julgamento do recurso pelo tribunal de segunda instância no processo [CNJ], com a prolação do Acórdão. Trata-se da decisão proferida pelos Desembargadores. Nossos advogados estão realizando a leitura técnica completa para verificar o impacto no seu caso.',
    quandoUsar: 'Usar quando houver julgamento colegiado (Acórdão) em 2ª instância.',
    keywords: ['ACÓRDÃO', 'ACORDAO', 'JULGAMENTO COLEGIADO', 'PUBLICADO O ACÓRDÃO'],
    prioridade: 1
  },
  {
    id: 'audiencia_designada',
    categoria: 'audiencia',
    titulo: 'Audiência Designada pelo Juízo',
    texto: 'Olá, [Nome]! Informamos que o tribunal designou uma data para audiência no processo [CNJ]. Trata-se de uma etapa do rito processual para tentativa de conciliação ou instrução. Nossa equipe jurídica entrará em contato em breve para passar as instruções, o link de acesso e realizar o preparo necessário.',
    quandoUsar: 'Usar quando houver designação de audiência ou sessão de conciliação.',
    keywords: ['AUDIÊNCIA DESIGNADA', 'AUDIENCIA DESIGNADA', 'CEJUSC', 'SESSÃO DE CONCILIAÇÃO', 'CONCILIACAO', 'INSTRUÇÃO E JULGAMENTO'],
    prioridade: 1
  },
  {
    id: 'acordo_homologado',
    categoria: 'acordo',
    titulo: 'Acordo Homologado Judicialmente',
    texto: 'Oi, [Nome]! Temos uma atualização importante: o juiz homologou oficialmente o acordo firmado no processo [CNJ]. Com a homologação judicial, os termos pactuados passam a ter força de sentença. Estamos conferindo o despacho para garantir o cumprimento das obrigações acordadas.',
    quandoUsar: 'Usar quando houver homologação de acordo ou termo de composição.',
    keywords: ['ACORDO', 'HOMOLOGAÇÃO DE ACORDO', 'HOMOLOGACAO DE ACORDO', 'MINUTA DE ACORDO', 'TERMO DE ACORDO'],
    prioridade: 1
  },
  {
    id: 'alvara_mle',
    categoria: 'alvara',
    titulo: 'Expedição de Alvará / MLE',
    texto: 'Olá, [Nome]! Identificamos a expedição de Alvará Judicial (ou MLE) no processo [CNJ]. Este documento autoriza o levantamento de valores depositados em juízo. Nossa equipe está acompanhando a liberação para garantir que os valores sejam processados conforme os ritos de pagamento.',
    quandoUsar: 'Usar quando houver expedição de alvará de levantamento ou mandado de pagamento.',
    keywords: ['ALVARÁ', 'ALVARA', 'MLE', 'MANDADO DE LEVANTAMENTO', 'GUIA DE LEVANTAMENTO'],
    prioridade: 1
  },
  {
    id: 'deposito_judicial',
    categoria: 'financeiro',
    titulo: 'Guia de Depósito Judicial',
    texto: 'Olá, [Nome]! Identificamos um andamento referente a Depósito Judicial no processo [CNJ]. Trata-se de um procedimento para consignação de valores em conta vinculada ao juízo. Nossa equipe confirmará se houve a abertura de conta ou necessidade de emissão de guia e retornaremos com as instruções.',
    quandoUsar: 'Usar quando houver menção a depósito ou conta judicial.',
    keywords: ['DEPÓSITO JUDICIAL', 'DEPOSITO JUDICIAL', 'CONTA JUDICIAL', 'COMPROVANTE DE DEPÓSITO'],
    prioridade: 1
  },
  {
    id: 'deposito_revogado',
    categoria: 'financeiro',
    titulo: 'Revogação de Depósito Judicial',
    texto: 'Olá, [Nome]! Identificamos um andamento de Revogação de Depósito no processo [CNJ]. Isso indica que as autorizações para depósitos em conta judicial podem ter sido cessadas pelo juízo. Nossa equipe jurídica está confirmando o efeito prático disso nos seus pagamentos e retornará com a orientação segura.',
    quandoUsar: 'Usar quando houver revogação ou cancelamento de depósitos judiciais.',
    keywords: ['REVOGAÇÃO DE DEPÓSITO', 'REVOGACAO DE DEPOSITO', 'REVOGADO O DEPÓSITO', 'REVOGADA A CONTA'],
    prioridade: 1
  },
  {
    id: 'liminar_e_jg',
    categoria: 'liminar_jg',
    titulo: 'Liminar e Justiça Gratuita Analisadas',
    texto: 'Olá, [Nome]! O juiz realizou a análise dos nossos pedidos iniciais no processo [CNJ], tratando tanto da liminar quanto do pedido de Justiça Gratuita. Nossa equipe jurídica já está analisando o teor detalhado desta decisão para definir as providências de gabinete. Seguimos acompanhando de perto.',
    quandoUsar: 'Usar quando houver movimentos de Liminar e Justiça Gratuita na mesma janela.',
    keywords: ['LIMINAR', 'ASSISTÊNCIA JUDICIÁRIA', 'JUSTIÇA GRATUITA', 'GRATUIDADE', 'GRATUIDADE DA JUSTIÇA'],
    prioridade: 1
  },
  {
    id: 'liminar_analisada',
    categoria: 'liminar',
    titulo: 'Análise de Liminar',
    texto: 'Olá, [Nome]! Houve uma atualização importante: o juiz apreciou o pedido de liminar no seu processo [CNJ]. Nossos advogados estão realizando a leitura técnica da decisão para verificar os termos decididos e as providências necessárias. Entraremos em contato com o parecer completo.',
    quandoUsar: 'Usar quando houver análise de Liminar/Tutela sem deferimento/indeferimento explícito.',
    keywords: ['LIMINAR', 'TUTELA', 'ANTECIPAÇÃO DE TUTELA'],
    prioridade: 1
  },
  {
    id: 'justica_gratuita',
    categoria: 'liminar',
    titulo: 'Justiça Gratuita Apreciada',
    texto: 'Oi, [Nome]! O pedido de Justiça Gratuita (Gratuidade) do processo [CNJ] foi analisado pelo juízo. Esta é uma etapa importante para a continuidade da ação. Nossa equipe está conferindo o despacho para garantir que tudo esteja regularizado conforme as regras de custas.',
    quandoUsar: 'Usar quando houver menção à gratuidade da justiça.',
    keywords: ['ASSISTÊNCIA JUDICIÁRIA', 'JUSTIÇA GRATUITA', 'GRATUIDADE', 'GRATUIDADE DA JUSTIÇA'],
    prioridade: 1
  },
  {
    id: 'outras_decisoes',
    categoria: 'decisao',
    titulo: 'Nova Decisão Prolatada',
    texto: 'Olá, [Nome]! O juízo proferiu uma nova decisão nos autos do processo [CNJ]. Nossa equipe jurídica já foi notificada e está analisando o teor técnico do despacho para dar andamento às providências de gabinete necessárias. Retornaremos com o parecer em breve.',
    quandoUsar: 'Usar para movimentos genéricos de decisão ou decisões interlocutórias.',
    keywords: ['OUTRAS DECISÕES', 'OUTRAS DECISOES', 'OUTRA DECISÃO', 'OUTRA DECISAO', 'DECISÃO INTERLOCUTÓRIA', 'DECISAO INTERLOCUTORIA'],
    prioridade: 1
  },
  {
    id: 'jg_indeferida',
    categoria: 'financeiro',
    titulo: 'Justiça Gratuita Indeferida',
    texto: 'Olá, [Nome]! O juiz indeferiu o pedido de Justiça Gratuita no processo [CNJ]. Isso pode gerar a necessidade de recolhimento de custas processuais. Nossa equipe jurídica está analisando a decisão para confirmar os valores e prazos, e retornaremos com a orientação sobre a guia de pagamento.',
    quandoUsar: 'Usar quando a gratuidade for negada, podendo gerar custas.',
    keywords: ['INDEFERIDA A GRATUIDADE', 'INDEFERIMENTO DA JUSTIÇA GRATUITA', 'JUSTIÇA GRATUITA INDEFERIDA', 'INDEFERIDA A ASSISTÊNCIA'],
    prioridade: 2
  },
  {
    id: 'sentenca_improcedente',
    categoria: 'sentenca',
    titulo: 'Sentença Desfavorável (Análise)',
    texto: 'Olá, [Nome]! Informamos que o juiz proferiu uma sentença improcedente no processo [CNJ]. Nossa equipe jurídica já está realizando a leitura técnica dos fundamentos da decisão para preparar o recurso cabível e buscar a reforma desta sentença no tribunal.',
    quandoUsar: 'Usar quando houver improcedência total ou parcial desfavorável.',
    keywords: ['IMPROCEDENTE', 'IMPROCEDÊNCIA', 'IMPROCEDENCIA', 'NEGADO PROVIMENTO'],
    prioridade: 2
  },
  {
    id: 'pericia',
    categoria: 'pericia',
    titulo: 'Andamento de Perícia Técnica',
    texto: 'Olá, [Nome]! O processo [CNJ] avançou para a fase de perícia. O juiz nomeou um perito ou houve a juntada do laudo técnico aos autos. Esta etapa é fundamental para a produção de provas especializadas. Estamos acompanhando os prazos para manifestação técnica.',
    quandoUsar: 'Usar quando houver perícia, perito ou laudo pericial.',
    keywords: ['PERÍCIA', 'PERITO', 'LAUDO PERICIAL', 'HONORÁRIOS PERICIAIS'],
    prioridade: 2
  },
  {
    id: 'penhora_bloqueio',
    categoria: 'financeiro',
    titulo: 'Fase de Penhora ou Bloqueio',
    texto: 'Olá, [Nome]! Identificamos um andamento de penhora ou tentativa de bloqueio judicial no processo [CNJ]. Trata-se de um rito para garantir a execução do crédito. Nossa banca jurídica já está analisando as medidas de defesa necessárias para resguardar seus direitos.',
    quandoUsar: 'Usar quando houver penhora, SISBAJUD ou bloqueios judiciais.',
    keywords: ['PENHORA', 'SISBAJUD', 'BLOQUEIO JUDICIAL', 'PENHORA NO ROSTO DOS AUTOS'],
    prioridade: 2
  },
  {
    id: 'apelacao',
    categoria: 'recurso',
    titulo: 'Recurso de Apelação Protocolado',
    texto: 'Olá, [Nome]! Informamos que houve o protocolo do Recurso de Apelação no processo [CNJ]. Este procedimento visa levar o caso para reapreciação pelos desembargadores no tribunal de segunda instância. Seguimos monitorando o prazo de remessa.',
    quandoUsar: 'Usar quando houver interposição de recurso ou apelação.',
    keywords: ['APELAÇÃO', 'APELACAO', 'RECURSO DE APELAÇÃO', 'RAZÕES DE APELAÇÃO'],
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
    titulo: 'Apresentação de Defesa (Réu)',
    texto: 'Olá, [Nome]! A outra parte apresentou a contestação (defesa) no processo [CNJ]. Nossos advogados já estão analisando cada ponto alegado para elaborar a nossa réplica, onde rebateremos os argumentos trazidos por eles.',
    quandoUsar: 'Usar quando o réu protocolar a contestação.',
    keywords: ['CONTESTAÇÃO', 'CONTESTACAO', 'CONTESTAÇÃO APRESENTADA', 'JUNTADA DE CONTESTAÇÃO'],
    prioridade: 3
  },
  {
    id: 'replica',
    categoria: 'replica',
    titulo: 'Apresentação de Réplica',
    texto: 'Oi, [Nome]! Estamos na fase de Réplica no processo [CNJ]. Nossa equipe está redigindo a manifestação para rebater os argumentos trazidos pela defesa da outra parte. É uma etapa importante para reafirmar nossos pedidos perante o juiz.',
    quandoUsar: 'Usar quando houver intimação para réplica ou réplica apresentada.',
    keywords: ['RÉPLICA', 'REPLICA', 'INTIMAÇÃO PARA RÉPLICA', 'MANIFESTAÇÃO SOBRE A CONTESTAÇÃO'],
    prioridade: 3
  },
  {
    id: 'peticao_juntada',
    categoria: 'peticao_juntada',
    titulo: 'Protocolo de Petição',
    texto: 'Olá, [Nome]! Houve a juntada de uma nova petição no seu processo [CNJ]. Este documento foi protocolado para impulsionar o andamento ou atender a uma determinação do juiz. Aguardamos agora a próxima manifestação do tribunal.',
    quandoUsar: 'Usar quando houver juntada de petição recente.',
    keywords: ['PETIÇÃO', 'PETICAO', 'JUNTADA DE PETIÇÃO', 'JUNTADA DE PETICAO', 'PETIÇÃO JUNTADA', 'DOCUMENTO JUNTADO'],
    prioridade: 4
  },
  {
    id: 'decurso_prazo',
    categoria: 'prazo',
    titulo: 'Certificação de Prazos',
    texto: 'Olá, [Nome]! Passando para atualizar o status do seu processo ([CNJ]). Tivemos movimentações recentes de rotina no cartório, incluindo a certificação de prazos processuais e publicações do tribunal ([DataMov]). Isso faz parte do fluxo normal da ação. Nossa equipe segue acompanhando de perto e, assim que tivermos uma nova decisão do juiz, avisaremos você.',
    quandoUsar: 'Usar quando houver decurso de prazo ou certificação burocrática recente.',
    keywords: ['DECURSO DE PRAZO', 'DECORRIDO O PRAZO', 'PRAZO DECORRIDO'],
    prioridade: 4
  },
  {
    id: 'conclusos',
    categoria: 'conclusos',
    titulo: 'Aguardando Decisão (Conclusos)',
    texto: 'Oi, [Nome]! O seu processo [CNJ] teve uma atualização técnica: ele foi enviado para a mesa do juiz (conclusos). Isso significa que o processo está na fila para que o magistrado profira uma decisão ou despacho. Estamos monitorando diariamente esse retorno.',
    quandoUsar: 'Usar quando o andamento indicar "Conclusos para despacho/decisão".',
    keywords: ['CONCLUSOS', 'CONCLUSÃO', 'CONCLUSAO', 'CONCLUSOS PARA DESPACHO', 'CONCLUSOS PARA DECISÃO', 'CONCLUSOS PARA SENTENÇA'],
    prioridade: 4
  },
  {
    id: 'saneamento_provas',
    categoria: 'instrucao',
    titulo: 'Fase de Provas (Saneamento)',
    texto: 'Olá, [Nome]! O juiz iniciou a fase de saneamento no processo [CNJ], solicitando que as partes indiquem as provas que desejam produzir. É um momento de organização do processo antes do julgamento. Estamos cuidando de toda a parte técnica necessária.',
    quandoUsar: 'Usar em ritos de saneamento ou especificação de provas.',
    keywords: ['SANEAMENTO', 'ESPECIFICAÇÃO DE PROVAS', 'ESPECIFICACAO DE PROVAS'],
    prioridade: 4
  },
  {
    id: 'citacao',
    categoria: 'citacao',
    titulo: 'Citação do Réu',
    texto: 'Olá, [Nome]! O processo [CNJ] avançou para a fase de citação. O tribunal está notificando oficialmente a outra parte sobre a existência da ação. Este é um passo fundamental para que o processo saia da fase inicial.',
    quandoUsar: 'Usar quando houver expedição de mandado ou carta de citação.',
    keywords: ['CITAÇÃO', 'CITACAO', 'MANDADO DE CITAÇÃO', 'CARTA DE CITAÇÃO', 'EXPEDIÇÃO DE MANDADO'],
    prioridade: 5
  },
  {
    id: 'rotina_pos_retorno',
    categoria: 'rotina',
    titulo: 'Manutenção de Monitoramento',
    texto: 'Olá, [Nome]! Desde nossa última conversa em [Data], o seu processo [CNJ] teve apenas movimentações internas de cartório. Não houve nenhuma decisão nova do juiz que mude o status atual, o que é comum no fluxo judicial. Seguimos em vigilância constante!',
    quandoUsar: 'Ideal para quando o cliente pergunta e SÓ houve burocracia de cartório desde o último contato.',
    keywords: [],
    prioridade: 6
  },
  {
    id: 'rotina',
    categoria: 'rotina',
    titulo: 'Andamento de Rotina',
    texto: 'Olá, [Nome]! Houve um novo andamento técnico no seu processo [CNJ]. Trata-se de uma atualização de rotina do tribunal (movimentação de cartório), sem mudança prática no seu caso neste momento. O processo segue seu curso normal e nossa equipe jurídica está acompanhando o fluxo.',
    quandoUsar: 'Usar para andamentos genéricos sem impacto de mérito.',
    keywords: ['ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'DISPONIBILIZAÇÃO', 'PUBLICAÇÃO', 'REMESSA', 'RECEBIMENTO'],
    prioridade: 6
  }
];
