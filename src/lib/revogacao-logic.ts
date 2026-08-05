/**
 * Lógica de revogação de poderes + substabelecimento.
 * Match de advogado na carteira, UF via CNJ/tribunal, elegibilidade do processo.
 */

export function normalizeName(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match flexível: nome completo ou tokens principais */
export function nomesCorrespondem(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(' ').filter((w) => w.length >= 3);
  const tb = nb.split(' ').filter((w) => w.length >= 3);
  if (ta.length < 2 || tb.length < 2) return false;
  const setB = new Set(tb);
  let hit = 0;
  for (const t of ta) if (setB.has(t)) hit++;
  return hit >= Math.min(2, Math.ceil(Math.min(ta.length, tb.length) * 0.6));
}

/** Extrai UF aproximada do CNJ (20 dígitos) ou do campo tribunal */
export function ufFromProtocolo(protocolo: string, tribunal?: string): string | null {
  const dig = String(protocolo || '').replace(/\D/g, '');
  // CNJ: NNNNNNN DD AAAA J TR OOOO — TR em posições 13-14 (1-based 14-15)
  if (dig.length >= 16) {
    const tr = dig.slice(13, 15);
    const map: Record<string, string> = {
      '01': 'RJ', '02': 'SP', '03': 'RJ', '04': 'AM', '05': 'BA', '06': 'CE',
      '07': 'DF', '08': 'ES', '09': 'GO', '10': 'MA', '11': 'MT', '12': 'MS',
      '13': 'MG', '14': 'PA', '15': 'PB', '16': 'PR', '17': 'PE', '18': 'PI',
      '19': 'RN', '20': 'RS', '21': 'RJ', '22': 'RO', '23': 'RR', '24': 'SC',
      '25': 'SE', '26': 'SP', '27': 'TO',
    };
    if (map[tr]) return map[tr];
  }
  const t = String(tribunal || '').toUpperCase();
  const m = t.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (m) return m[1];
  const tjm = t.match(/TJ([A-Z]{2})/);
  if (tjm) return tjm[1];
  return null;
}

export function processoElegivelRevogacao(c: {
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  evento_tipo?: string | null;
  status?: string | null;
}): { ok: boolean; motivo: string } {
  if (c.datajud_encerrado_tribunal) {
    return { ok: false, motivo: 'Encerrado no tribunal (DataJud)' };
  }
  if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') {
    return { ok: false, motivo: 'Em cumprimento de sentença' };
  }
  const st = String(c.status || '').toUpperCase();
  if (/ENCERRAD|ARQUIVAD|BAIXA DEFINIT|TRANSITO/.test(st)) {
    return { ok: false, motivo: `Status interno: ${c.status}` };
  }
  if (c.evento_tipo === 'transito_ou_baixa' || c.evento_tipo === 'transito_baixa') {
    return { ok: false, motivo: 'Trânsito/baixa' };
  }
  return { ok: true, motivo: 'Ativo — elegível para revogação/substabelecimento' };
}

export function oabLabel(adv: any, preferUf?: string): { completa: string; curta: string } {
  const oabs = adv?.oabs || {};
  let uf = preferUf || adv?.uf || 'SP';
  let num = '';
  if (typeof oabs === 'object' && oabs) {
    if (preferUf && oabs[preferUf]) {
      uf = preferUf;
      num = String(oabs[preferUf]);
    } else {
      const keys = Object.keys(oabs);
      if (keys.length) {
        uf = keys[0];
        num = String(oabs[keys[0]]);
      }
    }
  }
  if (!num && (adv?.oab || adv?.numero_oab)) {
    num = String(adv.oab || adv.numero_oab).replace(/\D/g, '');
  }
  const curta = num ? `OAB/${uf} ${num}` : `OAB/${uf}`;
  return { completa: curta, curta };
}

export function dataExtenso(d = new Date()): string {
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
