/**
 * Saneamento de dados DataJud / CNJ.
 * Inspirado em: lcpassuncao/cleanjud (Hackathon CNJ Inova — saneamento DATAJUD)
 *
 * Uso: antes de gravar andamento/movimento vindo da API.
 */

export type MovimentoSujo = {
  codigo?: string | number | null;
  nome?: string | null;
  dataHora?: string | null;
  complemento?: string | null;
  [k: string]: unknown;
};

export type MovimentoLimpo = {
  codigo: string;
  nome: string;
  dataHora: string | null;
  complemento: string;
  hash: string;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

/** Valida e normaliza número CNJ (20 dígitos). */
export function normalizarCnj(raw: string): { ok: boolean; cnj: string; erro?: string } {
  const d = onlyDigits(String(raw || ""));
  if (d.length !== 20) {
    return { ok: false, cnj: d, erro: "CNJ deve ter 20 dígitos" };
  }
  // Formato NNNNNNN-DD.AAAA.J.TR.OOOO
  const cnj = `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
  return { ok: true, cnj };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `m${Math.abs(h)}`;
}

export function limparMovimento(m: MovimentoSujo): MovimentoLimpo | null {
  const nome = String(m.nome || "").replace(/\s+/g, " ").trim();
  if (!nome || nome.length < 3) return null;
  // Remove lixo comum de OCR / HTML
  const complemento = String(m.complemento || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const codigo = String(m.codigo ?? "").trim() || "0";
  const dataHora = m.dataHora ? String(m.dataHora) : null;
  const hash = simpleHash(`${codigo}|${nome}|${dataHora}|${complemento}`);
  return { codigo, nome, dataHora, complemento, hash };
}

export function dedupeMovimentos(list: MovimentoLimpo[]): MovimentoLimpo[] {
  const seen = new Set<string>();
  const out: MovimentoLimpo[] = [];
  for (const m of list) {
    if (seen.has(m.hash)) continue;
    seen.add(m.hash);
    out.push(m);
  }
  return out;
}

/** Pipeline: valida CNJ + limpa + dedupe. */
export function sanearLoteDatajud(
  cnjRaw: string,
  movimentos: MovimentoSujo[]
): {
  ok: boolean;
  cnj?: string;
  movimentos: MovimentoLimpo[];
  erro?: string;
  removidos: number;
} {
  const n = normalizarCnj(cnjRaw);
  if (!n.ok) return { ok: false, movimentos: [], erro: n.erro, removidos: 0 };
  const limpos = movimentos.map(limparMovimento).filter(Boolean) as MovimentoLimpo[];
  const unique = dedupeMovimentos(limpos);
  return {
    ok: true,
    cnj: n.cnj,
    movimentos: unique,
    removidos: movimentos.length - unique.length,
  };
}
