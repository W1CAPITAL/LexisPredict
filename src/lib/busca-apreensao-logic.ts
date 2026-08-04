/**
 * Detecção BA + match centrado no CLIENTE e no CNJ da carteira.
 * Advogado/OAB: só reforço opcional na busca DJEN, nunca critério obrigatório de hit.
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

export function digitsOnly(s: string): string {
  return String(s || '').replace(/\D/g, '');
}

/** CNJ 20 dígitos iguais (ignora máscara) */
export function mesmoCnj(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digitsOnly(String(a || ''));
  const db = digitsOnly(String(b || ''));
  if (da.length < 15 || db.length < 15) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
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

/** OAB no texto — auxiliar, NÃO obrigatório para hit */
export function oabApareceNoTexto(texto: string, oab: string): boolean {
  const t = normalizeName(texto);
  const digits = String(oab || '').replace(/\D/g, '');
  if (digits.length < 4) return false;
  if (t.includes(digits)) return true;
  const pretty = digits.replace(/(\d)(?=(\d{3})+$)/g, '$1.');
  return t.includes(normalizeName(pretty));
}

/**
 * Decide se publicação BA do DJEN pertence ao cliente da fila.
 * Prioridade:
 * 1) CNJ da publicação = algum protocolo da carteira do usuário
 * 2) Nome do cliente no teor
 * Advogado/OAB só como sinal extra (não bloqueia).
 */
export function publicacaoBateComCarteira(opts: {
  texto: string;
  processoDjen: string | null;
  protocolosCarteira: string[];
  clienteNome: string;
}): { ok: boolean; motivoMatch: string } {
  const { texto, processoDjen, protocolosCarteira, clienteNome } = opts;

  for (const p of protocolosCarteira || []) {
    if (mesmoCnj(processoDjen, p)) {
      return { ok: true, motivoMatch: `CNJ carteira ${p}` };
    }
    // CNJ da carteira citado no teor
    const dig = digitsOnly(p);
    if (dig.length >= 15 && digitsOnly(texto).includes(dig)) {
      return { ok: true, motivoMatch: `CNJ no teor ${p}` };
    }
  }

  if (nomeApareceNoTexto(texto, clienteNome)) {
    return { ok: true, motivoMatch: 'Nome do cliente no teor' };
  }

  // Se a API já filtrou por nomeParte e há só 1 processo na carteira, aceita BA
  if ((protocolosCarteira || []).length === 1 && textoIndicaBuscaApreensao(texto).hit) {
    return { ok: true, motivoMatch: 'Único CNJ da carteira + teor BA' };
  }

  return { ok: false, motivoMatch: 'Sem vínculo cliente/CNJ' };
}
