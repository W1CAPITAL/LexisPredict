/**
 * Extrai dicas de cálculo a partir do texto da sentença / DJEN.
 * Heurística — o usuário confirma os campos antes de calcular.
 */

export type DicaCalculo = {
  protocolo?: string;
  valores: { label: string; valor: number; raw: string }[];
  jurosMensalPct?: number;
  honorariosPct?: number;
  indice?: string;
  correçãoDesde?: string; // texto livre
  jurosDesde?: string;
  resumo: string[];
};

function parseBRMoney(s: string): number | null {
  const m = s.replace(/\s/g, '').match(/R\$\s*([\d.]+,\d{2}|[\d.]+)/i) ||
    s.match(/([\d.]+,\d{2})/);
  if (!m) return null;
  const raw = m[1].replace(/\./g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseSentencaParaCalculo(texto: string): DicaCalculo {
  const t = String(texto || '');
  const U = t.toUpperCase();
  const resumo: string[] = [];
  const valores: DicaCalculo['valores'] = [];

  // CNJ
  const cnj = t.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  if (cnj) resumo.push(`Processo: ${cnj[0]}`);

  // Valores R$
  const moneyRe = /R\$\s*[\d.]+,\d{2}/gi;
  const found = t.match(moneyRe) || [];
  const seen = new Set<number>();
  for (const raw of found) {
    const v = parseBRMoney(raw);
    if (v == null || v < 50 || seen.has(v)) continue;
    seen.add(v);
    let label = 'Valor encontrado';
    const idx = t.indexOf(raw);
    const ctx = t.slice(Math.max(0, idx - 40), idx + raw.length + 20).toLowerCase();
    if (/tarif/.test(ctx)) label = 'Tarifa';
    else if (/seguro/.test(ctx)) label = 'Seguro';
    else if (/parcela/.test(ctx)) label = 'Parcela';
    else if (/honor/.test(ctx)) label = 'Honorários (ref.)';
    valores.push({ label, valor: v, raw });
  }

  let jurosMensalPct: number | undefined;
  if (/1\s*%\s*ao\s*m[eê]s|juros\s*de\s*mora\s*de\s*1\s*%|1%\s*a\.?\s*m/i.test(t)) {
    jurosMensalPct = 1;
    resumo.push('Juros de mora: 1% ao mês (texto da decisão)');
  } else if (/0,5\s*%\s*ao\s*m[eê]s/i.test(t)) {
    jurosMensalPct = 0.5;
    resumo.push('Juros de mora: 0,5% ao mês');
  }

  let honorariosPct: number | undefined;
  const hon = t.match(/honor[aá]rios[^\d%]{0,40}(\d{1,2})\s*%/i) ||
    t.match(/arbitro\s+em\s+(\d{1,2})\s*%/i);
  if (hon) {
    honorariosPct = Number(hon[1]);
    resumo.push(`Honorários: ${honorariosPct}% sobre a condenação atualizada`);
  }

  let indice: string | undefined;
  if (/tabela\s+pr[aá]tica\s+do\s+tjsp|tjsp/i.test(t)) {
    indice = 'TJSP';
    resumo.push('Correção: Tabela Prática TJSP (aprox. no Lexis)');
  } else if (/ipca/i.test(t)) indice = 'IPCA';
  else if (/igp-?m/i.test(t)) indice = 'IGPM';
  else if (/inpc/i.test(t)) indice = 'INPC';

  if (/desde\s+os\s+desembolsos|desde\s+o\s+desembolso/i.test(t)) {
    resumo.push('Correção desde o desembolso (data do pagamento da tarifa/seguro)');
  }
  if (/a\s+partir\s+da\s+cita[cç][aã]o|desde\s+a\s+cita[cç][aã]o/i.test(t)) {
    resumo.push('Juros a partir da citação');
  }
  if (/lei\s*n[ºo°.\s]*14\.?905/i.test(t)) {
    resumo.push('Após Lei 14.905/24: índice oficial (art. 406 CC) — no Lexis use juros 1% até a data da lei e confira o restante');
  }
  if (/julgo\s*procedente|procedente\s+os\s+pedidos/i.test(U)) {
    resumo.push('Sentença com pedidos procedentes (devolução)');
  }

  return {
    protocolo: cnj?.[0],
    valores: valores.slice(0, 8),
    jurosMensalPct,
    honorariosPct,
    indice,
    resumo,
  };
}
