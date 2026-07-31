/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * CATÁLOGO DE SCRIPTS DE GABINETE v9.0 - FIDELIDADE E PROTEÇÃO FINANCEIRA
 */

export interface ScriptTemplate {
  id: string;
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
  keywords: string[];
  prioridade: number; 
}

export const SCRIPT_CATALOG: ScriptTemplate[] = [
  {
    id: 'baixa_indeferimento',
    categoria: 'baixa',
    titulo: 'Encerramento: Indeferimento da Inicial (Sem Custos)',
    texto: 'Olá, [CLIENTE]! Tudo bem? Passando para atualizar você sobre a conclusão do processo nº [PROTOCOLO]. O processo atingiu sua fase final e foi oficialmente encerrado no tribunal. No entanto, o encerramento ocorreu devido a uma decisão técnica chamada "indeferimento da petição inicial". Isso significa que o juiz extinguiu a ação logo nos estágios iniciais por entender que faltou o preenchimento de algum requisito formal ou documental para dar seguimento ao caso, não chegando a julgar o mérito do seu pedido. Apesar desse desfecho, você pode ficar totalmente tranquilo em relação a qualquer custo. Como o juiz deferiu o seu pedido de Gratuidade da Justiça e o processo foi encerrado de forma antecipada (antes mesmo da defesa da parte contrária), não há cobrança de custas processuais nem de honorários de sucumbência. Você não terá que desembolsar absolutamente nenhum valor por conta desta decisão. O caso encontra-se agora arquivado de forma definitiva em nossos sistemas.',
    quandoUsar: 'Prioridade Máxima. Usar quando a inicial for indeferida ou extinta sem mérito logo no início.',
    keywords: ['INDEFERIMENTO DA PETIÇÃO INICIAL', 'INDEFERIDA A INICIAL', 'INDEFIRO A INICIAL', 'FALTA DE EMENDA', 'EXTINÇÃO SEM RESOLUÇÃO DO MÉRITO'],
    prioridade: 0
  },
  {
    id: 'baixa_cancelamento',
    categoria: 'baixa',
    titulo: 'Encerramento por Falha Técnica/Custas',
    texto: 'Olá! Passando para atualizar sobre o desfecho do seu processo ([CNJ]). O tribunal oficializou a baixa definitiva do caso, mas infelizmente o juiz determinou o encerramento sem análise do mérito devido a uma falha técnica processual (referente ao não recolhimento de taxas judiciárias/preparo ou ausência de pressupostos). Isso significa que o processo foi cancelado na raiz. Nossa equipe jurídica está à disposição para explicar as consequências desta baixa definitiva.',
    quandoUsar: 'Prioridade Máxima. Usar quando o processo for morto por falha de custas, deserto ou cancelamento.',
    keywords: ['CANCELAMENTO DA DISTRIBUIÇÃO', 'AUSÊNCIA DE PRESSUPOSTOS', 'DESERTO', 'NÃO CONHECIDO', 'RECURSO NÃO CONHECIDO', 'FALTA DE PREPARO', 'RECOLHIMENTO DA TAXA'],
    prioridade: 0
  },
  {
    id: 'baixa_derrota_jg',
    categoria: 'baixa',
    titulo: 'Encerramento: Improcedência (Cobrança Suspensa)',
    texto: 'Olá! Informamos que o processo ([CNJ]) foi encerrado com uma sentença de improcedência. Entretanto, como você possui o benefício da GRATUIDADE DE JUSTIÇA deferido, a cobrança de eventuais honorários à parte contrária fica SUSPENSA por lei. Você não precisa realizar nenhum pagamento agora. O caso está arquivado no tribunal e nossa equipe jurídica segue monitorando.',
    quandoUsar: 'Usar quando houver improcedência MAS o cliente tem Justiça Gratuita.',
    keywords: ['GRATUIDADE DA JUSTIÇA', 'ASSISTÊNCIA JUDICIÁRIA GRATUITA', 'JG DEFERIDA', 'GRATUIDADE DEFERIDA'],
    prioridade: 0
  },
  {
    id: 'baixa_derrota_honorarios',
    categoria: 'baixa',
    titulo: 'Encerramento: Sentença de Improcedência',
    texto: 'Olá! Informamos que o seu processo ([CNJ]) atingiu a etapa final com a baixa definitiva. Contudo, é importante destacar que a decisão final foi de IMPROCEDÊNCIA, e o tribunal fixou honorários sucumbenciais devidos à parte contrária conforme sentença. O caso está encerrado no momento e nossa equipe está pronta para orientar sobre os próximos passos e o impacto desta decisão.',
    quandoUsar: 'Usar quando houver improcedência confirmada.',
    keywords: ['IMPROCEDENTE', 'IMPROCEDÊNCIA', 'HONORÁRIOS SUCUMBENCIAIS'],
    prioridade: 1
  },
  {
    id: 'baixa_definitiva',
    categoria: 'baixa',
    titulo: 'Processo Finalizado (Baixa)',
    texto: 'Olá! Informamos que o tribunal oficializou o encerramento do processo [CNJ] através da Baixa Definitiva. Isso indica que o caso atingiu sua etapa final no sistema judicial após o trânsito em julgado. Nossa equipe segue agora com os ritos internos de arquivamento.',
    quandoUsar: 'Usar APENAS quando não houver indícios de derrota ou falha técnica no histórico recente.',
    keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE'],
    prioridade: 2
  },
  {
    id: 'sentenca_procedente',
    categoria: 'sentenca',
    titulo: 'Vitória: Pedido Julgado Procedente',
    texto: 'Olá! Temos uma atualização importante: o juiz proferiu sentença julgando PROCEDENTE o pedido no processo [CNJ]. O magistrado acolheu a tese apresentada e decidiu favoravelmente à sua demanda. Nossos advogados estão realizando a leitura técnica completa da decisão para os próximos passos.',
    quandoUsar: 'Usar quando houver procedência total dos pedidos.',
    keywords: ['JULGADO PROCEDENTE', 'JULGADA PROCEDENTE', 'PEDIDO ACOLHIDO', 'SENTENÇA DE PROCEDÊNCIA'],
    prioridade: 2
  },
  {
    id: 'sentenca_parcial',
    categoria: 'sentenca',
    titulo: 'Vitória Parcial: Pedido Acolhido',
    texto: 'Olá! Informamos que houve a prolação de sentença PARCIALMENTE PROCEDENTE no processo [CNJ]. Isso significa que o juiz acolheu parte fundamental dos pedidos. O jurídico está analisando os fundamentos para verificar a necessidade de recurso ou se seguiremos para a fase de execução.',
    quandoUsar: 'Usar quando houver procedência parcial.',
    keywords: ['PARCIALMENTE PROCEDENTE', 'PROCEDENTE EM PARTE'],
    prioridade: 2
  },
  {
    id: 'busca_apreensao',
    categoria: 'ba',
    titulo: 'Alerta de Busca e Apreensão',
    texto: 'URGENTE: identificamos um novo andamento de Busca e Apreensão no seu processo [CNJ]. O jurídico já está em prontidão para as medidas de defesa. É fundamental que mantenha o veículo em local seguro e aguarde nossas orientações imediatas.',
    quandoUsar: 'Prioridade Máxima. Usar ao detectar Mandado de Busca ou ritos de apreensão.',
    keywords: ['BUSCA E APREENSÃO', 'BUSCA E APREENSAO', 'APREENSÃO', 'APREENSAO', 'REINTEGRAÇÃO DE POSSE'],
    prioridade: 1
  },
  {
    id: 'audiencia_designada',
    categoria: 'audiencia',
    titulo: 'Audiência Designada pelo Juízo',
    texto: 'Olá! Informamos que o tribunal designou uma data para audiência no processo [CNJ]. Trata-se de uma etapa do rito processual para tentativa de conciliação ou instrução. Nossa equipe entrará em contato em breve para passar as instruções e o link de acesso.',
    quandoUsar: 'Usar quando houver designação de audiência.',
    keywords: ['AUDIÊNCIA', 'AUDIENCIA', 'CEJUSC', 'CONCILIAÇÃO'],
    prioridade: 3
  },
  {
    id: 'liminar_deferida',
    categoria: 'liminar',
    titulo: 'Liminar Deferida pelo Juiz',
    texto: 'Olá! Temos uma atualização positiva: o juiz DEFERIU o pedido de liminar (tutela) no processo [CNJ]. Esta é uma vitória estratégica inicial que resguarda seus direitos. O jurídico está analisando os detalhes para orientar os próximos passos.',
    quandoUsar: 'Usar quando houver deferimento de liminar ou tutela.',
    keywords: ['LIMINAR DEFERIDA', 'TUTELA DEFERIDA', 'TUTELA CONCEDIDA'],
    prioridade: 3
  },
  {
    id: 'rotina',
    categoria: 'rotina',
    titulo: 'Andamento de Rotina',
    texto: 'Olá! Houve um novo andamento técnico no seu processo [CNJ]. Trata-se de uma atualização de rotina do tribunal (movimentação de cartório), sem mudança prática no seu caso neste momento. O processo segue seu curso normal.',
    quandoUsar: 'Usar para andamentos genéricos sem impacto de mérito.',
    keywords: ['ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'PUBLICAÇÃO', 'REMESSA', 'RECEBIDO'],
    prioridade: 6
  }
];