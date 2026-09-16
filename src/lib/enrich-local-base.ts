/** Normalização e cruzamento gerador ↔ bases locais (DETRAN SPT_USERS / Credilink). */

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
};

export type EnrichQuery = { cpf?: string; nome?: string };

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

/** Preferência de colunas conforme amostras reais. */
export function pickColumns(headers: string[]) {
  const H = headers.map((h) => h.trim());
  const lower = H.map((h) => h.toLowerCase());
  const find = (...preds: ((h: string) => boolean)[]) => {
    for (const p of preds) {
      const i = lower.findIndex(p);
      if (i >= 0) return H[i];
    }
    return "";
  };

  // DETRAN: CPF_NUMBER | Credilink: CPF
  const cpf = find(
    (h) => h === "cpf_number",
    (h) => h === "cpf",
    (h) => h.includes("cpf")
  );
  // DETRAN: NAME | Credilink: NOME
  const nome = find(
    (h) => h === "name",
    (h) => h === "nome",
    (h) => h.includes("nome") && !h.includes("mae") && !h.includes("pai") && !h.includes("social")
  );
  // DETRAN: TELEPHONE_MOBILE > TELEPHONE > TELEPHONE_MOBILE2
  const telefone = find(
    (h) => h === "telephone_mobile",
    (h) => h === "telephone_mobile2",
    (h) => h === "telephone",
    (h) => h.includes("mobile"),
    (h) => h.includes("celular"),
    (h) => h.includes("whats"),
    (h) => h.includes("telefone") || h.includes("telephone") || h === "tel"
  );
  // EMAIL / EMAIL_OPTIONAL
  const email = find(
    (h) => h === "email",
    (h) => h === "email_optional",
    (h) => h.includes("email") || h.includes("e-mail")
  );

  return { cpf, nome, telefone, email };
}

export function matchRow(
  row: Record<string, string>,
  map: { cpf?: string; nome?: string; telefone?: string; email?: string },
  index: { cpfs: Set<string>; nomes: Set<string> }
): EnrichHit {
  const cpfVal = onlyDigits(map.cpf ? row[map.cpf] : "");
  const nomeVal = normName(map.nome ? row[map.nome] : "");
  const telRaw = map.telefone ? String(row[map.telefone] || "").trim() : "";
  const email = map.email ? String(row[map.email] || "").trim() : "";

  if (cpfVal.length === 11 && index.cpfs.has(cpfVal)) {
    return { matched: true, match_by: "cpf", nome: nomeVal, cpf: cpfVal, telefone: telRaw, email };
  }
  if (nomeVal.length >= 8 && index.nomes.has(nomeVal)) {
    return {
      matched: true,
      match_by: "nome",
      nome: nomeVal,
      cpf: cpfVal.length === 11 ? cpfVal : undefined,
      telefone: telRaw,
      email,
    };
  }
  return { matched: false };
}
