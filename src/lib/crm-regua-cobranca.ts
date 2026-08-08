/**
 * Régua de cobrança GRATUITA — só lógica de datas (D-3, D0, D+3, D+7).
 * Não usa WhatsApp API nem gateway pago: gera itens para a equipe agir
 * (ligar, mensagem manual, marcar pago no CRM).
 */

export type ReguaCanal = 'interno' | 'whatsapp_manual' | 'email_manual' | 'ligacao';

export type ReguaItem = {
  receber_id: string;
  cliente_nome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  diaRelativo: number; // negativo = antes do vencimento
  etapa: 'D-3' | 'D0' | 'D+3' | 'D+7' | 'critico';
  acaoSugerida: string;
  canalSugerido: ReguaCanal;
  prioridade: number; // maior = mais urgente
};

function parseDay(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(from: Date, to: Date): number {
  const ms = startDay(to).getTime() - startDay(from).getTime();
  return Math.round(ms / 86400000);
}

function startDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function classificarRegua(
  rows: Array<{
    id: string;
    cliente_nome?: string | null;
    descricao?: string | null;
    valor?: number | null;
    vencimento?: string | null;
    status?: string | null;
  }>,
  hoje = new Date()
): ReguaItem[] {
  const out: ReguaItem[] = [];
  for (const r of rows) {
    if (!r.vencimento) continue;
    const st = String(r.status || '');
    if (st === 'pago' || st === 'cancelado') continue;
    const venc = parseDay(String(r.vencimento));
    if (!venc) continue;
    const d = diffDays(venc, hoje); // positivo = atrasado
    let etapa: ReguaItem['etapa'];
    let acao: string;
    let canal: ReguaCanal;
    let prioridade: number;
    if (d < -3) continue; // ainda longe
    if (d >= -3 && d < 0) {
      etapa = 'D-3';
      acao = 'Lembrete amigável: vencimento em breve. Confirmar forma de pagamento.';
      canal = 'whatsapp_manual';
      prioridade = 40;
    } else if (d === 0) {
      etapa = 'D0';
      acao = 'Vence hoje. Cobrar confirmação de pagamento no mesmo dia.';
      canal = 'ligacao';
      prioridade = 70;
    } else if (d >= 1 && d <= 3) {
      etapa = 'D+3';
      acao = 'Em atraso leve. Reforçar cobrança e oferecer 2ª via / PIX.';
      canal = 'whatsapp_manual';
      prioridade = 85;
    } else if (d >= 4 && d <= 7) {
      etapa = 'D+7';
      acao = 'Atraso de uma semana. Escalar para supervisor; propor acordo simples.';
      canal = 'ligacao';
      prioridade = 95;
    } else {
      etapa = 'critico';
      acao = 'Inadimplência prolongada. Revisar contrato e próxima via (negociação / suspender serviço).';
      canal = 'interno';
      prioridade = 100;
    }
    out.push({
      receber_id: r.id,
      cliente_nome: r.cliente_nome || '—',
      descricao: r.descricao || 'Parcela',
      valor: Number(r.valor || 0),
      vencimento: String(r.vencimento).slice(0, 10),
      status: st || 'pendente',
      diaRelativo: d,
      etapa,
      acaoSugerida: acao,
      canalSugerido: canal,
      prioridade,
    });
  }
  out.sort((a, b) => b.prioridade - a.prioridade || a.vencimento.localeCompare(b.vencimento));
  return out;
}

/** Agente ESCOPO FECHADO (grátis): próxima ação em texto, sem API externa. */
export function sugerirProximaAcaoAgente(item: ReguaItem): string {
  const v = item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return [
    `[Agente cobrança · ${item.etapa}]`,
    `Cliente: ${item.cliente_nome}`,
    `Valor: ${v} · Venc.: ${item.vencimento} (${item.diaRelativo >= 0 ? '+' : ''}${item.diaRelativo}d)`,
    `Canal sugerido: ${item.canalSugerido}`,
    `Ação: ${item.acaoSugerida}`,
    'Registrar no CRM o contato e o resultado. Marcar pago somente com comprovação.',
  ].join('\n');
}
