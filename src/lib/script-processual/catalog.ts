/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * CATÁLOGO DE SCRIPTS DE GABINETE v12.0 - FIDELIDADE E PROTEÇÃO FINANCEIRA (ANTI-ALUCINAÇÃO)
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
    id: 'alerta_busca_apreensao',
    categoria: 'ba',
    titulo: 'ALERTA: Indício de Busca e Apreensão',
    texto: 'Olá, [CLIENTE]! Passando para te dar uma atualização importante. Identificamos um novo andamento no seu processo ([PROTOCOLO]) que indica um possível mandado de busca e apreensão. Nossa equipe jurídica já está em prontidão para as medidas de defesa necessárias. Por segurança, pedimos que mantenha o veículo resguardado e aguarde nosso contato com as orientações técnicas detalhadas ainda hoje.',
    quandoUsar: 'Prioridade Máxima. Usar quando houver flag de BA ou keywords de apreensão.',
    keywords: ['BUSCA E APREENSÃO', 'APREENSAO DO VEICULO', 'REINTEGRAÇÃO DE POSSE'],
    prioridade: 0
  },
  {
    id: 'baixa_reversao_derrota',
    categoria: 'baixa',
    titulo: 'Derrota em 2ª Instância: Reversão de Mérito (Com AJG)',
    texto: 'Olá, [CLIENTE]! Tudo bem? Passando para atualizar você sobre as últimas movimentações do seu processo ([PROTOCOLO]). Infelizmente, tivemos uma decisão desfavorável no Tribunal de Justiça. O Banco recorreu daquela vitória inicial e os Desembargadores acabaram reformando a sentença para julgar o pedido improcedente. Apesar dessa notícia, há um ponto de tranquilidade: como garantimos o seu benefício da Justiça Gratuita, você está blindado. Você não terá que pagar as custas do tribunal nem os honorários dos advogados do banco. A cobrança desses valores permanece suspensa por lei e você não deve nada. Nossa equipe segue analisando se cabe algum último recurso técnico.',
    quandoUsar: 'CRÍTICO. Usar quando o Tribunal reformar a sentença para improcedente.',
    keywords: ['REFORMA DA SENTENÇA', 'DAR PROVIMENTO AO RECURSO DO RÉU', 'AFASTAR O RECONHECIMENTO DA ABUSIVIDADE'],
    prioridade: 0
  },
  {
    id: 'possivel_baixa_tribunal',
    categoria: 'baixa',
    titulo: 'Possível Encerramento (Confirmação em Andamento)',
    texto: 'Olá, [CLIENTE]! Identificamos uma movimentação de encerramento (Baixa Definitiva / Trânsito em Julgado) no seu processo [PROTOCOLO] no sistema do Tribunal. Nossa equipe jurídica está realizando a conferência final dos autos para confirmar o desfecho completo e se há pendências. Em breve, retornaremos com o parecer conclusivo sobre o arquivamento definitivo do caso.',
    quandoUsar: 'Usar quando houver flag de baixa real ou trânsito em julgado.',
    keywords: ['BAIXA DEFINITIVA', 'TRÂNSITO EM JULGADO', 'ARQUIVADO DEFINITIVAMENTE'],
    prioridade: 0
  },
  {
    id: 'baixa_indeferimento',
    categoria: 'baixa',
    titulo: 'Encerramento: Indeferimento da Inicial (Sem Custos)',
    texto: 'Olá, [CLIENTE]! Tudo bem? Passando para atualizar você sobre a conclusão do processo nº [PROTOCOLO]. O processo atingiu sua fase final devido a uma decisão técnica de "indeferimento da petição inicial". Isso significa que o juiz extinguiu a ação logo no início por falta de algum requisito formal. Apesar disso, você pode ficar tranquilo: como garantimos a sua Gratuidade da Justiça, não há cobrança de custas nem honorários. Você não terá que desembolsar nenhum valor por conta desta decisão. O caso encontra-se agora arquivado.',
    quandoUsar: 'Usar quando a inicial for indeferida ou extinta sem mérito no início.',
    keywords: ['INDEFERIMENTO DA PETIÇÃO INICIAL', 'FALTA DE EMENDA', 'EXTINÇÃO SEM RESOLUÇÃO DO MÉRITO'],
    prioridade: 1
  },
  {
    id: 'sentenca_procedente',
    categoria: 'sentenca',
    titulo: 'Vitória: Pedido Julgado Procedente',
    texto: 'Olá! Temos uma atualização importante: o juiz proferiu sentença julgando PROCEDENTE o pedido no processo [PROTOCOLO]. O magistrado acolheu a tese apresentada e decidiu favoravelmente à sua demanda. Nossos advogados estão realizando a leitura técnica completa da decisão para os próximos passos.',
    quandoUsar: 'Usar quando houver procedência total dos pedidos.',
    keywords: ['JULGADO PROCEDENTE', 'PEDIDO ACOLHIDO', 'SENTENÇA DE PROCEDÊNCIA'],
    prioridade: 2
  },
  {
    id: 'sentenca_improcedente',
    categoria: 'sentenca',
    titulo: 'Derrota: Pedido Julgado Improcedente',
    texto: 'Olá, [CLIENTE]. Informamos que o juiz proferiu sentença julgando improcedente o seu pedido no processo [PROTOCOLO]. Trata-se de uma decisão de primeiro grau e nossa equipe jurídica já está analisando os fundamentos da sentença para preparar o recurso adequado. Seguiremos acompanhando o caso para buscar a reversão no Tribunal.',
    quandoUsar: 'Usar quando o juiz julgar os pedidos como improcedentes.',
    keywords: ['JULGADO IMPROCEDENTE', 'PEDIDO REJEITADO', 'SENTENÇA DE IMPROCEDÊNCIA'],
    prioridade: 2
  },
  {
    id: 'liminar_concedida',
    categoria: 'liminar',
    titulo: 'Vitória Inicial: Liminar Concedida',
    texto: 'Ótima notícia, [CLIENTE]! O juiz concedeu a liminar que solicitamos no seu processo [PROTOCOLO]. Essa decisão inicial já garante uma proteção importante para o seu direito enquanto o caso segue para o julgamento final. Estamos monitorando o cumprimento desta ordem pelo banco.',
    quandoUsar: 'Usar quando o juiz deferir pedido de tutela ou liminar.',
    keywords: ['TUTELA DEFERIDA', 'LIMINAR CONCEDIDA', 'ANTECIPAÇÃO DE TUTELA'],
    prioridade: 2
  },
  {
    id: 'cumprimento_sentenca',
    categoria: 'cumprimento',
    titulo: 'Fase de Pagamento: Cumprimento de Sentença',
    texto: 'Olá! Seu processo [PROTOCOLO] entrou na fase de "Cumprimento de Sentença". Isso significa que a discussão sobre quem tem razão acabou e agora estamos cobrando o pagamento dos valores devidos conforme a decisão do juiz. É a reta final para o recebimento.',
    quandoUsar: 'Usar quando iniciada a fase executiva ou cumprimento de sentença.',
    keywords: ['CUMPRIMENTO DE SENTENÇA', 'EXECUÇÃO', 'INÍCIO DA FASE EXECUTIVA'],
    prioridade: 3
  },
  {
    id: 'movimentacao_pos_retorno',
    categoria: 'rotina',
    titulo: 'Nova Movimentação Pós-Retorno',
    texto: 'Olá, [CLIENTE]! Desde nossa última conversa em [Data], surgiram novos andamentos técnicos no seu processo [PROTOCOLO]. Nossa equipe já identificou estas atualizações no sistema do Tribunal e elas estão em fase de triagem pelo nosso setor jurídico. Fique tranquilo, estamos acompanhando de perto.',
    quandoUsar: 'Usar quando houver flag de novo andamento relevante mas sem categoria definida.',
    keywords: [],
    prioridade: 5
  },
  {
    id: 'rotina',
    categoria: 'rotina',
    titulo: 'Andamento de Rotina',
    texto: 'Olá! Houve um novo andamento técnico no seu processo [PROTOCOLO]. Trata-se de uma atualização de rotina do tribunal (movimentação de cartório), sem mudança prática no seu caso neste momento. O processo segue seu curso normal.',
    quandoUsar: 'Usar para andamentos genéricos sem impacto de mérito.',
    keywords: ['ATO ORDINATÓRIO', 'MERO EXPEDIENTE', 'CERTIDÃO', 'PUBLICAÇÃO', 'REMESSA'],
    prioridade: 10
  }
];
