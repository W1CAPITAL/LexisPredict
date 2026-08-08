/**
 * Conciliação de extrato CSV — GRÁTIS (sem Open Finance).
 * Aceita CSV comum: data;valor;descricao ou data,valor,historico
 */

export type LinhaExtrato = {
  data: string; // YYYY-MM-DD
  valor: number;
  descricao: string;
  raw: string;
};

export type MatchConciliacao = {
  extrato: LinhaExtrato;
  receber_id?: string;
  cliente_nome?: string;
  confianca: 'alta' | 'media' | 'baixa' | 'nenhuma';
  motivo: string;
};

function normDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function parseValor(s: string): number | null {
  let t = s.trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  if (!t) return null;
  // 1.234,56 → 1234.56
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseExtratoCsv(text: string): LinhaExtrato[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const out: LinhaExtrato[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    if (i === 0 && /data|date|valor|amount/i.test(cols.join(' '))) continue;
    // try: data, valor, desc
    let data: string | null = null;
    let valor: number | null = null;
    let desc = '';
    for (const c of cols) {
      if (!data) {
        const d = normDate(c);
        if (d) {
          data = d;
          continue;
        }
      }
      if (valor == null) {
        const v = parseValor(c);
        if (v != null && Math.abs(v) > 0) {
          valor = Math.abs(v);
          continue;
        }
      }
      if (c) desc = desc ? `${desc} ${c}` : c;
    }
    if (data && valor != null) {
      out.push({ data, valor, descricao: desc || '—', raw: lines[i] });
    }
  }
  return out;
}

export function conciliarExtratoComReceber(
  extrato: LinhaExtrato[],
  receber: Array<{
    id: string;
    valor?: number | null;
    vencimento?: string | null;
    cliente_nome?: string | null;
    status?: string | null;
  }>
): MatchConciliacao[] {
  const abertos = receber.filter((r) => r.status !== 'pago' && r.status !== 'cancelado');
  const used = new Set<string>();
  const matches: MatchConciliacao[] = [];

  for (const ex of extrato) {
    let best: MatchConciliacao = {
      extrato: ex,
      confianca: 'nenhuma',
      motivo: 'Sem título com valor próximo',
    };
    for (const r of abertos) {
      if (used.has(r.id)) continue;
      const rv = Number(r.valor || 0);
      if (Math.abs(rv - ex.valor) > 0.009) continue;
      const venc = (r.vencimento || '').slice(0, 10);
      let confianca: MatchConciliacao['confianca'] = 'media';
      let motivo = 'Mesmo valor';
      if (venc && venc === ex.data) {
        confianca = 'alta';
        motivo = 'Mesmo valor e mesma data do vencimento';
      } else if (venc) {
        const dd = Math.abs(
          (new Date(ex.data + 'T12:00:00').getTime() - new Date(venc + 'T12:00:00').getTime()) /
            86400000
        );
        if (dd <= 3) {
          confianca = 'alta';
          motivo = 'Mesmo valor e data até 3 dias do vencimento';
        } else if (dd <= 10) {
          confianca = 'media';
          motivo = 'Mesmo valor; data próxima do vencimento';
        } else {
          confianca = 'baixa';
          motivo = 'Mesmo valor; datas distantes — conferir manualmente';
        }
      }
      if (
        confianca === 'alta' ||
        (confianca === 'media' && best.confianca !== 'alta') ||
        best.confianca === 'nenhuma'
      ) {
        best = {
          extrato: ex,
          receber_id: r.id,
          cliente_nome: r.cliente_nome || undefined,
          confianca,
          motivo,
        };
      }
    }
    if (best.receber_id && (best.confianca === 'alta' || best.confianca === 'media')) {
      used.add(best.receber_id);
    }
    matches.push(best);
  }
  return matches;
}
