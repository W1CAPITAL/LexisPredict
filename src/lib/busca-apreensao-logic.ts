/**
 * Lógica pura — detecção de Busca e Apreensão em texto DJEN + match de nomes.
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
    { re: /BUSCA\s+E\s+APREENSAO\s+DE\s+BEM/, label: 'BUSCA E APREENSÃO DE BEM' },
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
  for (const tok of tokens) {
    if (t.includes(tok)) ok++;
  }
  return ok >= Math.min(2, tokens.length) && ok >= Math.ceil(tokens.length * 0.6);
}

export type MatchTipo = 'cliente' | 'advogado_banca' | 'advogado_processo' | 'titular';

export interface MatchResult {
  tipo: MatchTipo;
  nome: string;
  protocolo?: string | null;
}

export function cruzarPublicacaoComCarteira(
  texto: string,
  opts: {
    clientes: Array<{ nome: string; protocolo?: string }>;
    advogadosBanca: string[];
    advogadosProcesso: Array<{ nome: string; protocolo?: string }>;
  }
): MatchResult[] {
  const hits: MatchResult[] = [];
  const seen = new Set<string>();
  const push = (m: MatchResult) => {
    const k = `${m.tipo}|${normalizeName(m.nome)}|${m.protocolo || ''}`;
    if (seen.has(k)) return;
    seen.add(k);
    hits.push(m);
  };

  for (const c of opts.clientes) {
    if (c.nome && nomeApareceNoTexto(texto, c.nome)) {
      push({ tipo: 'cliente', nome: c.nome, protocolo: c.protocolo || null });
    }
  }
  for (const a of opts.advogadosBanca) {
    if (a && nomeApareceNoTexto(texto, a)) {
      push({ tipo: 'advogado_banca', nome: a });
    }
  }
  for (const a of opts.advogadosProcesso) {
    if (a.nome && nomeApareceNoTexto(texto, a.nome)) {
      push({ tipo: 'advogado_processo', nome: a.nome, protocolo: a.protocolo || null });
    }
  }
  return hits;
}
