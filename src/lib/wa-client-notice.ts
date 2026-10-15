/** Client-facing copy. Judicial facts stay literal; tone does not change eligibility. */
import {conditionalTerminalMention,type TerminalEvidence} from './judicial-terminal-evidence';
export function clientFirstName(value: string): string {
  const first = String(value || '').trim().split(/\s+/)[0] || '';
  if (!first || /^cliente$/i.test(first)) return '';
  if (first.startsWith('{')) return first;
  return first === first.toLocaleUpperCase('pt-BR') || first === first.toLocaleLowerCase('pt-BR')
    ? first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1).toLocaleLowerCase('pt-BR')
    : first;
}

export function clientGreeting(firstName: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const name = clientFirstName(firstName);
  return `${greeting}${name ? ', ' + name : ''}! Como vai? Aqui é do Setor Processual.`;
}

export const CLIENT_NOTICE_CLOSING =
  'Seguimos acompanhando as movimentações do seu processo e avisaremos quando houver uma nova atualização. Se tiver alguma dúvida, pode nos chamar por aqui, tudo bem?';
export const CLIENT_NOTICE_OPT_OUT =
  'Se preferir não receber esses avisos pelo WhatsApp, é só responder SAIR.';

/** Trecho fiel do teor oficial, sem substituir publicações longas por texto vago.
 * Cortar apenas o volume; nunca resumir como decisão ou promessa jurídica.
 */
export function officialNoticeExcerpt(text:string,max=850):{excerpt:string;shortened:boolean}{
  const original=String(text||'').replace(/\r/g,' ').replace(/[\t\n]+/g,' ')
    .replace(/\s+/g,' ').trim();
  if(original.length<=max)return {excerpt:original,shortened:false};
  // Cabeçalhos de DJEN podem conter apenas tribunal, advogado e distribuição.
  // Procura o início do ato comunicado para que o trecho tenha utilidade.
  const body=original.slice(100);
  const match=/(?:\b(?:intima[cç][aã]o|intime-se|fica\s+(?:intimad[oa]|a\s+parte)|determino|decido|senten[cç]a|despacho|cite-se|defiro|indefiro|homologo|considerando|para\s+que|manifeste-se|prazo\s+de)\b)/i.exec(body);
  const actionAt=match?match.index+100:0;
  const prefix=actionAt>260?original.slice(0,Math.min(135,Math.floor(max/5))).trim()+' […] ':''; 
  const available=max-prefix.length;
  const section=original.slice(actionAt,actionAt+available+1);
  const cut=section.slice(0,available);
  const end=cut.lastIndexOf(' ');
  const excerpt=prefix+(end>available*.65?cut.slice(0,end):cut).trim()+'…';
  return {excerpt,shortened:true};
}

export function buildClientMovementMessage(input: {
  firstName: string; cnj: string; date: string; detail: string; source?: 'DJEN'|'DataJud'; now?: Date;
  confirmedTerminal?:TerminalEvidence|null;
}): string {
  const detail = input.detail.trim();
  const normalized = detail.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Explain the uncertainty only for a terminal record, without inventing
  // judgment, reason, payment, review already done or a next-contact date.
  const terminal = /^(extincao\b|extint[oa]\b|baixa definitiva\b|arquivamento definitivo\b|encerramento\b|transito em julgado\b)/.test(normalized);
  const conclusos = normalized.match(/^conclusos? para (despacho|decisao|julgamento|sentenca)$/);
  const conditionalCosts = conditionalTerminalMention(detail) && /(?:recolh|recolha|providencie)[\s\S]{0,180}(?:custas|taxa|pagamento)|(?:custas|taxa)[\s\S]{0,180}(?:recolh|pagamento)/.test(normalized);
  const conditionalClause = normalized.match(/sob\s+(?:pena|cominacao)[^.;\n]{0,180}/)?.[0] || '';
  const consequence = /extin/.test(conditionalClause) ? 'extinção' : /cancelamento/.test(conditionalClause) ? 'cancelamento da distribuição' : 'arquivamento';
  const proofNotice = /\bintim[oa]\s+as\s+partes|\bintimem[-\s]se\s+as\s+partes/.test(normalized) && /(?:inform|manifest|especific)[\s\S]{0,220}(?:produzir|apresentar)[\s\S]{0,80}provas/.test(normalized);
  const joinedPetition = /^(?:juntada(?: de)?|peticao juntada)\b/.test(normalized) && /peticao|documento/.test(normalized);
  const expiredTerm = /^(?:decorrido prazo|decurso de prazo)\b/.test(normalized);
  const update = conclusos
    ? `Referente ao seu processo nº ${input.cnj}, no dia ${input.date} ele foi encaminhado ao juiz para ${conclusos[1] === 'despacho' ? 'análise e despacho' : conclusos[1] === 'decisao' ? 'decisão' : 'julgamento'}.`
    : conditionalCosts
      ? `Referente ao seu processo nº ${input.cnj}, a atualização de ${input.date} trata do recolhimento de custas. O texto prevê a possibilidade de ${consequence} se a determinação não for atendida; isso não significa que o processo já foi encerrado.`
      : proofNotice
        ? `Referente ao seu processo nº ${input.cnj}, a atualização de ${input.date} é uma intimação para que as partes informem se pretendem apresentar outras provas no processo.`
        : joinedPetition
          ? `Referente ao seu processo nº ${input.cnj}, em ${input.date} foi registrada a inclusão de ${/peticao/.test(normalized)?'uma petição':'documentos'} no processo.`
          : expiredTerm
            ? `Referente ao seu processo nº ${input.cnj}, em ${input.date} foi registrado o término de um prazo processual.`
            : `Passando para atualizar você sobre o processo nº ${input.cnj}. Em ${input.date}, foi registrada a seguinte ${input.source==='DJEN'?'publicação no Diário da Justiça':'movimentação processual'}:`;
  const excerpt=officialNoticeExcerpt(detail);
  const includeLiteralExcerpt=!conclusos&&!conditionalCosts&&!proofNotice&&!joinedPetition&&!expiredTerm;
  const sourceLiteral=includeLiteralExcerpt
    ? `*Trecho do registro oficial:* “${excerpt.excerpt}”${excerpt.shortened?'\\nO texto foi abreviado por tamanho, sem alterar o conteúdo do trecho. O teor integral pode ser consultado no tribunal/Diário da Justiça.':''}`
    : `*Registro oficial:* “${excerpt.excerpt}”${excerpt.shortened?'\\nTrecho abreviado; consulte o teor completo na fonte oficial.':''}`;
  if(input.confirmedTerminal){
    const labels:Record<TerminalEvidence,string>={
      extincao:'extinção ou cancelamento da distribuição',
      transito:'trânsito em julgado',
      baixa:'baixa definitiva',
      arquivamento:'arquivamento definitivo',
    };
    return [clientGreeting(input.firstName,input.now),
      `Sobre seu processo nº ${input.cnj}, há um registro de ${labels[input.confirmedTerminal]} em ${input.date}, conforme ${input.source}.`,
      `*Trecho do registro oficial:* “${excerpt.excerpt}”${excerpt.shortened?' (trecho abreviado; o teor integral está na fonte oficial)':''}`,
      'Esse registro não comprova, por si só, pagamento, decisão favorável ou a situação de outros procedimentos. Se quiser esclarecer os efeitos no seu caso, nossa equipe pode conferir.',
      CLIENT_NOTICE_OPT_OUT].join('\n\n');
  }
  return [
    clientGreeting(input.firstName, input.now),
    update,
    sourceLiteral,
    ...(terminal ? ['Esse registro não demonstra sozinho pagamento, resultado favorável ou encerramento definitivo de outros incidentes.'] : []),
    CLIENT_NOTICE_CLOSING,
    CLIENT_NOTICE_OPT_OUT,
  ].join('\n\n');
}
