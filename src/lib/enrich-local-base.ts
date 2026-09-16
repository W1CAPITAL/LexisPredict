/** Normalização e cruzamento gerador ↔ base local (DETRAN/CSV no PC). */

export function onlyDigits(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function normName(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type EnrichHit = {
  matched: boolean;
  match_by?: "cpf" | "nome";
  nome?: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  extra?: string;
};

export type EnrichQuery = { cpf?: string; nome?: string };

/** Monta Sets a partir da lista do gerador (poucas dezenas/centenas). */
export function buildQueryIndex(items: EnrichQuery[]) {
  const cpfs = new Set<string>();
  const nomes = new Set<string>();
  for (const it of items) {
    const d = onlyDigits(it.cpf);
    if (d.length === 11) cpfs.add(d);
    const n = normName(it.nome);
    if (n.length >= 8) nomes.add(n);
  }
  return { cpfs, nomes };
}

export function matchRow(
  row: Record<string, string>,
  map: { cpf?: string; nome?: string; telefone?: string; email?: string },
  index: { cpfs: Set<string>; nomes: Set<string> }
): EnrichHit {
  const cpfVal = onlyDigits(map.cpf ? row[map.cpf] : "");
  const nomeVal = normName(map.nome ? row[map.nome] : "");
  const tel = map.telefone ? String(row[map.telefone] || "").trim() : "";
  const email = map.email ? String(row[map.email] || "").trim() : "";

  if (cpfVal.length === 11 && index.cpfs.has(cpfVal)) {
    return { matched: true, match_by: "cpf", nome: nomeVal, cpf: cpfVal, telefone: tel, email };
  }
  if (nomeVal.length >= 8 && index.nomes.has(nomeVal)) {
    return { matched: true, match_by: "nome", nome: nomeVal, cpf: cpfVal || undefined, telefone: tel, email };
  }
  return { matched: false };
}
