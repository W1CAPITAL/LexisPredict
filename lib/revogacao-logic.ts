/**
 * Revogação + substabelecimento — match, UF, elegibilidade, leitura DJEN.
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

export function nomesCorrespondem(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(' ').filter((w) => w.length >= 3);
  const tb = nb.split(' ').filter((w) => w.length >= 3);
  if (ta.length < 2 || tb.length < 2) return false;
  const setB = new Set(tb);
  let hit = 0;
  for (const t of ta) if (setB.has(t)) hit++;
  return hit >= Math.min(2, Math.ceil(Math.min(ta.length, tb.length) * 0.6));
}

export function ufFromProtocolo(protocolo: string, tribunal?: string): string | null {
  const dig = String(protocolo || '').replace(/\D/g, '');
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
  return tjm ? tjm[1] : null;
}

export function processoElegivelRevogacao(c: {
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  evento_tipo?: string | null;
  status?: string | null;
}): { ok: boolean; motivo: string } {
  if (c.datajud_encerrado_tribunal) return { ok: false, motivo: 'Encerrado no tribunal (DataJud)' };
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
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function extrairAdvogadosDoTexto(texto: string): string[] {
  const t = String(texto || '');
  const found: string[] = [];
  const patterns = [
    /Dr\.?\s*([A-ZÁÉÍÓÚÂÊÔÃÕ][A-Za-zÀ-ú\s'.]{4,50})/g,
    /Dra\.?\s*([A-ZÁÉÍÓÚÂÊÔÃÕ][A-Za-zÀ-ú\s'.]{4,50})/g,
    /advogad[oa]\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][A-Za-zÀ-ú\s'.]{4,50})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(t)) !== null) {
      const n = (m[1] || '').trim();
      if (n.length >= 5 && !/INTIMACAO|PUBLICACAO|PROCESSO/.test(normalizeName(n))) {
        found.push(n.replace(/\s+/g, ' ').slice(0, 60));
      }
    }
  }
  return Array.from(new Set(found)).slice(0, 8);
}

export function avaliarViabilidadeSubstabelecimento(opts: {
  textos: string[];
  encerradoFlag?: boolean;
  cumprimentoFlag?: boolean;
}): {
  viavel: boolean;
  nivel: 'recomendado' | 'possivel_com_ressalva' | 'nao_recomendado' | 'indefinido';
  motivo: string;
} {
  const blob = normalizeName(opts.textos.join(' '));
  if (opts.encerradoFlag || /TRANSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVAMENTO DEFINITIVO/.test(blob)) {
    return {
      viavel: false,
      nivel: 'nao_recomendado',
      motivo:
        'Indícios de trânsito/baixa/arquivamento: substabelecimento costuma ser inócuo; use só se houver pendência residual de intimação.',
    };
  }
  if (opts.cumprimentoFlag || /CUMPRIMENTO DE SENTENCA|EXECUCAO DE SENTENCA/.test(blob)) {
    return {
      viavel: true,
      nivel: 'possivel_com_ressalva',
      motivo:
        'Fase de cumprimento/execução: possível, confira se o patrono atual ainda figura nas intimações.',
    };
  }
  if (/SENTENCA|ACORDAO|RECURSO|APELACAO|AGRAVO|INSTRUCAO|SANEADOR|CITACAO|INTIMACAO/.test(blob)) {
    return {
      viavel: true,
      nivel: 'recomendado',
      motivo: 'Movimentação ativa típica — substabelecimento sem reserva usualmente adequado.',
    };
  }
  if (!blob.trim()) {
    return {
      viavel: true,
      nivel: 'indefinido',
      motivo: 'Sem teor DJEN suficiente; elegibilidade baseada na carteira/DataJud.',
    };
  }
  return {
    viavel: true,
    nivel: 'possivel_com_ressalva',
    motivo: 'Teor sem bloqueio claro; valide o último advogado intimado no tribunal antes de protocolar.',
  };
}


/** Extrai CPF (11 digitos) de teor DJEN/decisao */
export function extrairCpfDoTexto(texto: string): string | null {
  const t = String(texto || '');
  // formatos 000.000.000-00 ou so digitos com contexto CPF
  const m1 = t.match(/CPF[:\s\/]*([\d]{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  if (m1) {
    const d = m1[1].replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  const m2 = t.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
  if (m2) return m2[1];
  const m3 = t.match(/\b(\d{11})\b/);
  if (m3 && /CPF/i.test(t)) {
    const d = m3[1];
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return null;
}
