/**
 * Banca de advogados offline (localStorage) — LexisPredict Offline / EXE / Supabase caído.
 * Espelha cadastro para procurações, substabelecimento, revogação e peças.
 */
"use client";

export type AdvogadoBancaLocal = {
  id: string;
  nome: string;
  genero?: string;
  nacionalidade?: string;
  estado_civil?: string;
  cpf?: string | null;
  rg?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
  email_profissional?: string | null;
  telefone?: string | null;
  celular?: string | null;
  site?: string | null;
  observacao?: string | null;
  oabs?: Record<string, string>;
  ativo?: boolean;
  avatar_url?: string | null;
  empresa_id?: string | null;
};

const LS_KEY = "lexis_advogados_banca_offline_v1";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function listAdvogadosBancaLocal(): AdvogadoBancaLocal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((a) => a && a.ativo !== false && a.nome);
  } catch {
    return [];
  }
}

function writeAll(list: AdvogadoBancaLocal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function upsertAdvogadoBancaLocal(adv: Partial<AdvogadoBancaLocal> & { nome: string }): AdvogadoBancaLocal {
  const list = listAdvogadosBancaLocal();
  // also include inactive for update
  let full: AdvogadoBancaLocal[] = [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    full = raw ? JSON.parse(raw) : list;
    if (!Array.isArray(full)) full = list;
  } catch {
    full = list;
  }
  const id = adv.id || uid();
  const row: AdvogadoBancaLocal = {
    id,
    nome: String(adv.nome || "").trim(),
    genero: adv.genero || "M",
    nacionalidade: adv.nacionalidade || "",
    estado_civil: adv.estado_civil || (adv as any).estadoCivil || "",
    cpf: adv.cpf ?? null,
    rg: adv.rg ?? null,
    endereco: adv.endereco ?? null,
    cidade: adv.cidade ?? null,
    uf: adv.uf ?? null,
    cep: adv.cep ?? null,
    email: adv.email ?? null,
    email_profissional: adv.email_profissional ?? (adv as any).emailProfissional ?? null,
    telefone: adv.telefone ?? null,
    celular: adv.celular ?? null,
    site: adv.site ?? null,
    observacao: adv.observacao ?? null,
    oabs: adv.oabs || {},
    ativo: adv.ativo !== false,
    avatar_url: adv.avatar_url ?? null,
  };
  const idx = full.findIndex((a) => a.id === id);
  if (idx >= 0) full[idx] = { ...full[idx], ...row };
  else full.push(row);
  writeAll(full);
  return row;
}

export function desativarAdvogadoBancaLocal(id: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const full: AdvogadoBancaLocal[] = raw ? JSON.parse(raw) : [];
    writeAll(full.map((a) => (a.id === id ? { ...a, ativo: false } : a)));
  } catch {}
}

/** Junta remoto + local por id (local preenche se remoto vazio). */
export function mergeBancaRemotoLocal(remoto: any[], local: AdvogadoBancaLocal[]) {
  const map = new Map<string, any>();
  for (const a of local) if (a?.id) map.set(a.id, { ...a, ativo: true });
  for (const a of remoto || []) if (a?.id) map.set(a.id, { ...map.get(a.id), ...a, ativo: true });
  return Array.from(map.values()).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
}
