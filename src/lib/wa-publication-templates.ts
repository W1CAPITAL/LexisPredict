/**
 * Modelos de comunicação processual, vinculados à natureza do evento.
 * Não são permutações aleatórias para evadir os controles do WhatsApp.
 * Os valores são extraídos de dados judiciais analisados e precisam de opt-in.
 */
export type PublicationEvent = 'baixa'|'transito'|'extincao'|'arquivamento'|'encerramento';
export type PublicationMerit = 'procedente'|'parcial'|'improcedente'|'sem_merito';
import {clientGreeting,CLIENT_NOTICE_CLOSING,CLIENT_NOTICE_OPT_OUT} from './wa-client-notice';

export const PUBLICATION_EVENT_LABELS:Record<PublicationEvent,string>={
  baixa:'Baixa definitiva',
  transito:'Trânsito em julgado',
  extincao:'Extinção do processo',
  arquivamento:'Arquivamento definitivo',
  encerramento:'Encerramento processual',
};
export const PUBLICATION_MERIT_LABELS:Record<PublicationMerit,string>={
  procedente:'A decisão registrada julgou o pedido procedente.',
  parcial:'A decisão registrada julgou o pedido parcialmente procedente.',
  improcedente:'A decisão registrada julgou o pedido improcedente.',
  sem_merito:'O registro indica extinção sem análise do mérito; não se trata de procedência ou improcedência do pedido.',
};
export const PUBLICATION_EVENT_TEXT:Record<PublicationEvent,(date:string,source:string)=>string>={
  baixa:(date,source)=>`Consta baixa definitiva em ${date}, segundo o registro de ${source}. Essa informação diz respeito à movimentação do processo.`,
  transito:(date,source)=>`Em ${date}, o ${source} registra trânsito em julgado. Esse registro indica o encerramento da possibilidade de recurso da decisão ali indicada, sujeito à conferência dos autos.`,
  extincao:(date,source)=>`Há registro de extinção do processo em ${date}, conforme o ${source}. Estamos comunicando o andamento identificado, sem antecipar providências ainda não confirmadas.`,
  arquivamento:(date,source)=>`O ${source} registra arquivamento definitivo em ${date}. A informação não comprova por si só quitação ou pagamento de valores.`,
  encerramento:(date,source)=>`Foi registrado encerramento processual em ${date}, conforme o ${source}. A situação interna da carteira será conferida separadamente desse registro judicial.`,
};

export function buildPublicationMessage(input:{
  firstName:string;cnj:string;date:string;source:'DJEN'|'DataJud';
  kind:PublicationEvent;verdict:PublicationMerit;
}):string {
  const {firstName,cnj,date,source,kind,verdict}=input;
  return [
    clientGreeting(firstName),
    `Passando para atualizar você sobre o processo nº ${cnj}. ${PUBLICATION_EVENT_TEXT[kind](date,source)}`,
    PUBLICATION_MERIT_LABELS[verdict],
    'Esse registro, por si só, não significa que já exista algum valor liberado para receber.',
    CLIENT_NOTICE_CLOSING,
    CLIENT_NOTICE_OPT_OUT,
  ].join('\n\n');
}

/** Exemplos fictícios exibidos na interface mesmo quando não há contatos elegíveis. */
export const PUBLICATION_TEMPLATE_PREVIEWS:(()=>Array<{kind:PublicationEvent;title:string;verdict:PublicationMerit;message:string}>)=()=>(
  ([
    ['baixa','procedente'],
    ['transito','parcial'],
    ['extincao','sem_merito'],
    ['arquivamento','improcedente'],
    ['encerramento','procedente'],
  ] as const).map(([kind,verdict])=>({
    kind,title:PUBLICATION_EVENT_LABELS[kind],verdict,
    message:buildPublicationMessage({
      firstName:'{primeiro_nome}',cnj:'{numero_cnj}',date:'{data_evento}',source:'DataJud',kind,verdict,
    })
  }))
);
