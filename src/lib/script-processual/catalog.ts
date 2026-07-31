/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * CATÁLOGO DE SCRIPTS DE GABINETE v7.0 - PROTOCOLO DE FIDELIDADE DE MÉRITO
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
    id: 'baixa_cancelamento',
    categoria: 'baixa',
    titulo: 'Encerramento por Falha Técnica/Custas',
    texto: 'Olá! Passando para atualizar sobre o desfecho do seu processo ([CNJ]). O tribunal oficializou a baixa definitiva do caso, mas infelizmente o juiz determinou o encerramento sem análise do mérito devido a uma falha técnica processual (referente ao não recolhimento de taxas judiciárias/preparo ou ausência de pressupostos). Isso significa que o processo foi cancelado na raiz. Nossa equipe jurídica está à disposição para explicar as consequências desta baixa definitiva.',
    quandoUsar: 'Prioridade Máxima. Usar quando o processo for morto por falha de custas, deserto ou cancelamento.',
    keywords: ['CANCELAMENTO DA DISTRIBUIÇÃO', 'AUSÊNCIA DE PRESSUPOSTOS', 'DESERTO', 'NÃO CONHECIDO', 'RECURSO NÃO CONHECIDO', 'FALTA DE PREPARO', 'RECOLHIMENTO DA TAXA'],
    prioridade: 0
  },
  {
    id: 'baixa_derrota_honorarios',
    categoria: 'baixa',
    titulo: 'Encerramento: Sentença de Improcedência',
    texto: 'Olá! Informamos que o seu processo ([CNJ]) atingiu a etapa final com a baixa definitiva. Contudo, é importante destacar que a decisão final foi de IMPROCEDÊNCIA (derrota), e o tribunal inclusive majorou os honorários devidos à parte contrária para 15% do valor da causa. O caso está encerrado e nossa equipe está pronta para orientar sobre o passivo gerado por esta decisão.',
    quandoUsar: 'Usar quando houver improcedência confirmada e majoração de honorários.',
    keywords: ['IMPROCEDENTE', 'IMPROCEDÊNCIA', 'MAJORADOS', 'MAJORAÇÃO', 'HONORÁRIOS EM 15%'],
    prioridade: 0
  },
  {
    id: 'baixa_definitiva',
    categoria: 'baixa',
    titulo: 'Processo Finalizado (Baixa)',
    texto: 'Olá! Informamos que o tribunal oficializou o encerramento do processo [CNJ] através da Baixa Definitiva. Isso indica que o caso atingiu sua etapa final no sistema judicial após o trânsito em julgado. Nossa equipe segue agora com os ritos internos de arquivamento.',
    quandoUsar: 'Usar APENAS quando não houver indícios de derrota ou falha técnica no histórico recente.',
    keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE'],
    prioridade: 1
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
