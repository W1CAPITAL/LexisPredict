/**
 * Detecção BA + match restrito ao cliente da fila (não a carteira inteira).
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

export function textoIndicaBuscaApreensao(raw: string | null | undefined): {
  hit: boolean;
  motivo: string | null;
} {
  const upper = normalizeName(String(raw || ''));
  if (!upper) return { hit: false, motivo: null };
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /BUSCA\s+E\s+APREENSAO/, label: 'BUSCA E APREENSÃO' },
    { re: /MANDADO\s+DE\s+BUSCA\s+E\s+APREENSAO/, label: 'MANDADO DE BUSCA E APREENSÃO' },
    { re: /CUMPRA[\-\s]?SE\s+O\s+MANDADO\s+DE\s+BUSCA/, label: 'CUMPRA-SE MANDADO DE BUSCA' },
    { re: /APREENSAO\s+DE\s+VEICULO/, label: 'APREENSÃO DE VEÍCULO' },
    { re: /APREENSAO\s+DO\s+VEICULO/, label: 'APREENSÃO DO VEÍCULO' },
  ];
  for (const p of patterns) {
    if (p.re.test(upper)) return { hit: true, motivo: p.label };
  }
  return { hit: false, motivo: null };
}

export function nomeApareceNoTexto(texto: string, nome: string): boolean {
  const t = normalizeName(texto);
  const n = normalizeName(nome);
  if (!t || !n || n.length < 6) return false;
  if (t.includes(n)) return true;
  const tokens = n.split(' ').filter((w) => w.length >= 3);
  if (tokens.length < 2) return t.includes(n);
  let ok = 0;
  for (const tok of tokens) if (t.includes(tok)) ok++;
  return ok >= Math.min(2, tokens.length) && ok >= Math.ceil(tokens.length * 0.6);
}

/** OAB no texto (ex.: OAB/SP 123456 ou 123.456) */
export function oabApareceNoTexto(texto: string, oab: string): boolean {
  const t = normalizeName(texto);
  const digits = String(oab || '').replace(/\D/g, '');
  if (digits.length < 4) return false;
  if (t.includes(digits)) return true;
  // com pontuação comum
  const pretty = digits.replace(/(\d)(?=(\d{3})+$)/g, '$1.');
  return t.includes(normalizeName(pretty));
}
