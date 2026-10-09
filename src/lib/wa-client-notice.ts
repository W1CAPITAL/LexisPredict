/** Client-facing copy. Judicial facts stay literal; tone does not change eligibility. */
import {conditionalTerminalMention} from './judicial-terminal-evidence';
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

export function buildClientMovementMessage(input: {
  firstName: string; cnj: string; date: string; detail: string; now?: Date;
}): string {
  const detail = input.detail.trim();
  const normalized = detail.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Explain the uncertainty only for a terminal record, without inventing
  // judgment, reason, payment, review already done or a next-contact date.
  const terminal = /^(extincao\b|extint[oa]\b|baixa definitiva\b|arquivamento definitivo\b|encerramento\b|transito em julgado\b)/.test(normalized);
  const conclusos = normalized.match(/^conclusos? para (despacho|decisao|julgamento|sentenca)$/);
  const conditionalCosts = conditionalTerminalMention(detail) && /(?:recolh|recolha|providencie)[\s\S]{0,180}(?:custas|taxa|pagamento)|(?:custas|taxa)[\s\S]{0,180}(?:recolh|pagamento)/.test(normalized);
  const excerpt = detail.length > 650 ? detail.slice(0,650).trim() + '…' : detail;
  const update = conclusos
    ? `Referente ao seu processo nº ${input.cnj}, no dia ${input.date} ele foi encaminhado ao juiz para ${conclusos[1] === 'despacho' ? 'análise e despacho' : conclusos[1] === 'decisao' ? 'decisão' : 'julgamento'}.`
    : conditionalCosts
      ? `Referente ao seu processo nº ${input.cnj}, houve uma publicação em ${input.date} sobre o recolhimento de custas. O texto prevê uma possível extinção ou cancelamento se a determinação não for atendida; isso não significa que o processo já foi encerrado.`
      : `Passando para atualizar você sobre o processo nº ${input.cnj}. O registro de ${input.date} informa:\n“${excerpt}”`;
  return [
    clientGreeting(input.firstName, input.now),
    update,
    ...(terminal ? ['Para explicar o motivo desse registro e os próximos passos, é preciso conferir os detalhes do processo.'] : []),
    CLIENT_NOTICE_CLOSING,
    CLIENT_NOTICE_OPT_OUT,
  ].join('\n\n');
}
