/** Classificação agregada — nunca usa nome/telefone/CPF. */
export function soDigitosCnj(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 20);
}

export function formatCnj(digits: string): string {
  const d = soDigitosCnj(digits);
  if (d.length !== 20) return d;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

const EXTINTO_SEM_MERITO = [
  "sem resolucao do merito",
  "sem resolução do mérito",
  "extincao sem resolucao",
  "extinção sem resolução",
  "art. 485",
  "artigo 485",
  "nao resolucao do merito",
  "não resolução do mérito",
];

export function movimentoEhExtincaoSemMerito(nome?: string, codigo?: number | string): boolean {
  const n = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const c = Number(codigo);
  if (c === 385 || c === 220 || c === 246) {
    if (n.includes("merito") || n.includes("485") || n.includes("extinc")) return true;
  }
  return EXTINTO_SEM_MERITO.some((k) => {
    const kk = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return n.includes(kk);
  }) || (n.includes("extinto") && n.includes("sem") && n.includes("merito"));
}

export function flagVeiculoOuBancario(classeNome?: string, assuntoNome?: string): boolean {
  const t = `${classeNome || ""} ${assuntoNome || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const keys = [
    "busca e apreensao",
    "alienacao fiduciaria",
    "alienacao fiduciária",
    "revisional",
    "financiamento",
    "arrendamento mercantil",
    "consorcio",
    "veiculo",
    "automotor",
    "bancari",
    "cdc",
    "superendividamento",
  ];
  return keys.some((k) => t.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

export function extrairHitEstatistico(hit: any): {
  cnj: string;
  tribunal: string;
  classe_codigo: string;
  classe_nome: string;
  assunto_nome: string;
  data_baixa: string | null;
  tipo_encerramento: string;
  flag_veiculo_ou_bancario: boolean;
} | null {
  const src = hit?._source || hit || {};
  const cnj = soDigitosCnj(src.numeroProcesso || src.numero || "");
  if (cnj.length !== 20) return null;
  const movs = Array.isArray(src.movimentos) ? src.movimentos : [];
  const hitMov = [...movs].reverse().find((m: any) =>
    movimentoEhExtincaoSemMerito(m?.nome, m?.codigo)
  );
  if (!hitMov) return null;
  const classe = src.classe || {};
  const assuntos = Array.isArray(src.assuntos) ? src.assuntos : [];
  const assuntoNome = String(assuntos[0]?.nome || assuntos[0] || "").slice(0, 180);
  const data = String(hitMov.dataHora || hitMov.data || "").slice(0, 10) || null;
  return {
    cnj,
    tribunal: String(src.tribunal || "").slice(0, 20),
    classe_codigo: String(classe.codigo || ""),
    classe_nome: String(classe.nome || "").slice(0, 160),
    assunto_nome: assuntoNome,
    data_baixa: data && /^\d{4}-\d{2}/.test(data) ? data.slice(0, 10) : null,
    tipo_encerramento: "extincao_sem_resolucao_merito",
    flag_veiculo_ou_bancario: flagVeiculoOuBancario(classe.nome, assuntoNome),
  };
}
