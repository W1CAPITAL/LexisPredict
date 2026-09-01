/**
 * Partes editáveis para peças (procuração, substabelecimento, revogação, habilitação).
 * Tudo é texto livre — chips só sugerem, nunca travam o valor.
 */

export type PartePessoa = {
  nome: string;
  nacionalidade: string;
  estado_civil: string;
  /** Alias usado em alguns PDFs */
  estadoCivil?: string;
  profissao: string;
  rg: string;
  cpf: string;
  endereco: string;
  email: string;
  telefone?: string;
  /** Parágrafo de qualificação completo (se preenchido, sobrescreve a montagem) */
  qualificacao?: string;
  genero?: string;
};

export type AdvogadoEditavel = {
  id?: string;
  nome: string;
  nacionalidade: string;
  estado_civil: string;
  estadoCivil?: string;
  oab: string;
  oab_uf?: string;
  endereco: string;
  email?: string;
  telefone?: string;
  qualificacao?: string;
  genero?: string;
};

export type BancaLocal = {
  nome_escritorio: string;
  endereco: string;
  cidade: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  observacao?: string;
};

const LS_BANCA = "lexis_banca_local_v1";
const LS_ADVS = "lexis_advogados_local_v1";

export const SUGESTOES_ESTADO_CIVIL = [
  "solteiro",
  "solteira",
  "solteiro(a)",
  "casado",
  "casada",
  "casado(a)",
  "divorciado",
  "divorciada",
  "divorciado(a)",
  "viúvo",
  "viúva",
  "viúvo(a)",
  "união estável",
  "em união estável",
];

export const SUGESTOES_NACIONALIDADE = [
  "brasileiro",
  "brasileira",
  "brasileiro(a)",
  "português",
  "portuguesa",
];

export const SUGESTOES_PROFISSAO = [
  "autônomo",
  "autônoma",
  "autônomo(a)",
  "empresário",
  "empresária",
  "advogado",
  "advogada",
  "advogado(a)",
  "do lar",
  "aposentado",
  "aposentada",
];

export function emptyCliente(): PartePessoa {
  return {
    nome: "",
    nacionalidade: "",
    estado_civil: "",
    profissao: "",
    rg: "",
    cpf: "",
    endereco: "",
    email: "",
    telefone: "",
    qualificacao: "",
  };
}

export function emptyAdvogado(): AdvogadoEditavel {
  return {
    nome: "",
    nacionalidade: "",
    estado_civil: "",
    oab: "",
    oab_uf: "",
    endereco: "",
    email: "",
    qualificacao: "",
  };
}

export function emptyBanca(): BancaLocal {
  return {
    nome_escritorio: "",
    endereco: "",
    cidade: "",
    email: "",
    telefone: "",
    cnpj: "",
  };
}

export function loadBancaLocal(): BancaLocal {
  if (typeof window === "undefined") return emptyBanca();
  try {
    const raw = localStorage.getItem(LS_BANCA);
    if (!raw) return emptyBanca();
    return { ...emptyBanca(), ...JSON.parse(raw) };
  } catch {
    return emptyBanca();
  }
}

export function saveBancaLocal(b: BancaLocal) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_BANCA, JSON.stringify(b));
  } catch {
    /* */
  }
}

export function loadAdvogadosLocal(): AdvogadoEditavel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_ADVS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAdvogadosLocal(list: AdvogadoEditavel[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_ADVS, JSON.stringify(list));
  } catch {
    /* */
  }
}

/** Monta parágrafo de qualificação do cliente com o texto digitado (sem forçar gênero). */
export function qualificarCliente(c: PartePessoa): string {
  const livre = String(c.qualificacao || "").trim();
  if (livre) return livre;

  const nome = String(c.nome || "").trim();
  const nac = String(c.nacionalidade || "").trim();
  const ec = String(c.estado_civil || c.estadoCivil || "").trim();
  const prof = String(c.profissao || "").trim();
  const rg = String(c.rg || "").trim();
  const cpf = String(c.cpf || "").trim();
  const end = String(c.endereco || "").trim();
  const email = String(c.email || "").trim();

  const parts: string[] = [];
  if (nome) parts.push(nome.toUpperCase());
  if (nac) parts.push(nac);
  if (ec) parts.push(ec);
  if (prof) parts.push(prof);
  let s = parts.join(", ");
  if (rg) s += `${s ? ", " : ""}portador do RG sob nº ${rg}`;
  if (cpf) s += `${s ? " e " : ""}inscrito no CPF sob nº ${cpf}`;
  if (end) s += `${s ? ", " : ""}residente e domiciliado(a) à ${end}`;
  if (email) s += `${s ? ", " : ""}com endereço eletrônico: ${email}`;
  return s;
}

export function qualificarAdvogado(a: AdvogadoEditavel): string {
  const livre = String(a.qualificacao || "").trim();
  if (livre) return livre;

  const nome = String(a.nome || "").trim();
  const nac = String(a.nacionalidade || "").trim();
  const ec = String(a.estado_civil || a.estadoCivil || "").trim();
  const oab = String(a.oab || "").trim();
  const uf = String(a.oab_uf || "").trim();
  const end = String(a.endereco || "").trim();

  const parts: string[] = [];
  if (nome) parts.push(nome.toUpperCase());
  if (nac) parts.push(nac);
  if (ec) parts.push(ec);
  parts.push("advogado(a)");
  if (oab) parts.push(uf ? `inscrito(a) na OAB/${uf} ${oab}` : `inscrito(a) na OAB ${oab}`);
  if (end) parts.push(`com endereço profissional em ${end}`);
  return parts.join(", ");
}

/** Mapeia resultado de extração sem normalizar gênero. */
export function mapearExtracaoParaCliente(raw: any): PartePessoa {
  const o = raw?.outorgante || raw?.cliente || raw || {};
  return {
    nome: String(o.nome || "").trim(),
    nacionalidade: String(o.nacionalidade || "").trim(),
    estado_civil: String(o.estado_civil || o.estadoCivil || "").trim(),
    estadoCivil: String(o.estado_civil || o.estadoCivil || "").trim(),
    profissao: String(o.profissao || "").trim(),
    rg: String(o.rg || "").trim(),
    cpf: String(o.cpf || "").trim(),
    endereco: String(o.endereco || "").trim(),
    email: String(o.email || "").trim(),
    telefone: String(o.telefone || "").trim(),
    qualificacao: String(o.qualificacao || "").trim(),
    genero: String(o.genero || "").trim(),
  };
}

export function mapearExtracaoParaAdvogado(raw: any): AdvogadoEditavel {
  const o = raw || {};
  return {
    nome: String(o.nome || "").trim(),
    nacionalidade: String(o.nacionalidade || "").trim(),
    estado_civil: String(o.estado_civil || o.estadoCivil || "").trim(),
    estadoCivil: String(o.estado_civil || o.estadoCivil || "").trim(),
    oab: String(o.oab || o.oab_numero || "").trim(),
    oab_uf: String(o.oab_uf || o.uf || "").trim(),
    endereco: String(o.endereco || "").trim(),
    email: String(o.email || "").trim(),
    qualificacao: String(o.qualificacao || "").trim(),
    genero: String(o.genero || "").trim(),
  };
}

/** NÃO use para forçar "casado" — mantido só se algum legado chamar; devolve o valor cru. */
export function flexionarGeneroLivre(texto: string, _genero?: string): string {
  return String(texto || "").trim();
}
