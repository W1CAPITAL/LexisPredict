/**
 * Plano B — carteira em Google Sheets / CSV / XLSX local.
 * Link "qualquer pessoa com o link" funciona via endpoint gviz (não /export).
 */

export type PlanoBRow = {
  protocolo: string;
  cliente: string;
  telefone: string;
  advogado: string;
  escritorio: string;
  tribunal: string;
  status: string;
  situacao: string;
  ultimoRetorno: string;
  proximoRetorno: string;
  criado_por: string;
  observacoes: string;
  andamento: string;
  evento_tipo: string;
  raw: Record<string, string>;
};

const ALIASES: Record<keyof Omit<PlanoBRow, "raw">, string[]> = {
  protocolo: [
    "protocolo", "processo", "cnj", "numero", "nº processo", "numero processo",
    "proc", "protocolo_ref", "n processo",
  ],
  cliente: ["cliente", "nome", "parte", "autor", "requerente", "beneficiario", "beneficiário"],
  telefone: ["telefone", "fone", "celular", "whatsapp", "tel", "phone"],
  advogado: ["advogado", "responsavel", "responsável", "analista", "operador", "atendente"],
  escritorio: ["escritorio", "escritório", "empresa", "parceiro", "unidade"],
  tribunal: ["tribunal", "tj", "comarca", "orgao", "órgão"],
  status: ["status", "situacao_prazo", "situação prazo", "fase", "estado"],
  situacao: ["situacao_gabinete", "situacao", "situação", "gabinete", "situacao_prazo"],
  ultimoRetorno: [
    "ultimo_retorno", "último retorno", "ultimo retorno", "retorno", "atendido_em", "data retorno",
  ],
  proximoRetorno: [
    "proximo_retorno", "próximo retorno", "proximo retorno", "prazo", "proximo prazo", "proximo_prazo",
  ],
  criado_por: [
    "criado_por", "criado por", "dono", "owner", "created_by", "assistente", "responsavel carteira",
  ],
  observacoes: ["observacoes", "observações", "obs", "notas", "comentario", "comentário"],
  andamento: ["andamento", "movimento", "movimentacao", "movimentação", "ultimo andamento"],
  evento_tipo: ["evento_tipo", "evento tipo", "tipo evento", "evento"],
};

function normHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function pick(headers: string[], row: string[], keys: string[]): string {
  const nh = headers.map(normHeader);
  for (const k of keys) {
    const nk = normHeader(k);
    const i = nh.findIndex((h) => h === nk || h.includes(nk) || nk.includes(h));
    if (i >= 0 && row[i] != null && String(row[i]).trim()) return String(row[i]).trim();
  }
  return "";
}

function detectDelimiter(sample: string): "," | ";" {
  const first = sample.split(/\r?\n/).find((l) => l.trim()) || "";
  const semi = (first.match(/;/g) || []).length;
  const comma = (first.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const src = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(src);
  const lines: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) {
        cur.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && src[i + 1] === "\n") i++;
        cur.push(cell);
        cell = "";
        if (cur.some((x) => x.trim())) lines.push(cur);
        cur = [];
      } else cell += c;
    }
  }
  if (cell.length || cur.length) {
    cur.push(cell);
    if (cur.some((x) => x.trim())) lines.push(cur);
  }
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1);
  return { headers, rows };
}

export function mapRowsToPlanoB(headers: string[], rows: string[][]): PlanoBRow[] {
  const out: PlanoBRow[] = [];
  for (const row of rows) {
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      raw[h] = row[i] ?? "";
    });
    const protocolo = pick(headers, row, ALIASES.protocolo);
    if (!protocolo) continue;
    const statusPrazo = pick(headers, row, ["situacao_prazo", "situação prazo"]);
    out.push({
      protocolo,
      cliente: pick(headers, row, ALIASES.cliente),
      telefone: pick(headers, row, ALIASES.telefone),
      advogado: pick(headers, row, ALIASES.advogado),
      escritorio: pick(headers, row, ALIASES.escritorio),
      tribunal: pick(headers, row, ALIASES.tribunal),
      status: pick(headers, row, ALIASES.status) || statusPrazo || "Sem Prazo",
      situacao: pick(headers, row, ALIASES.situacao) || statusPrazo,
      ultimoRetorno: pick(headers, row, ALIASES.ultimoRetorno),
      proximoRetorno: pick(headers, row, ALIASES.proximoRetorno),
      criado_por: pick(headers, row, ALIASES.criado_por),
      observacoes: pick(headers, row, ALIASES.observacoes),
      andamento: pick(headers, row, ALIASES.andamento),
      evento_tipo: pick(headers, row, ALIASES.evento_tipo),
      raw,
    });
  }
  return out;
}

function extractSheetId(input: string): string | null {
  const m = String(input || "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] || null;
}

function extractGid(input: string): string | null {
  const m = String(input || "").match(/[?&#]gid=([0-9]+)/);
  return m?.[1] || null;
}

/**
 * Candidatas de URL. gviz funciona com "qualquer pessoa com o link".
 * /export?format=csv costuma dar HTTP 400 nesses casos.
 */
export function buildSheetsFetchCandidates(input: string): string[] {
  const u = String(input || "").trim();
  if (!u) return [];
  if (!u.includes("docs.google.com/spreadsheets") && !u.includes("google.com")) {
    return [u];
  }
  const id = extractSheetId(u);
  if (!id) return [u];
  const gid = extractGid(u) || "86725201"; // aba Processos do relatório Lexis
  const out: string[] = [];
  // gid explícito (link que já funcionou) primeiro
  out.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
  out.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=Processos`);
  out.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=processos`);
  out.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0`);
  out.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid || "0"}`);
  out.push(`https://docs.google.com/spreadsheets/d/${id}/pub?output=csv`);
  return out;
}

export function normalizeSheetsCsvUrl(input: string): string {
  return buildSheetsFetchCandidates(input)[0] || "";
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim().slice(0, 80).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head>");
}

function looksLikeCsvWithProtocolo(text: string): boolean {
  const head = text.slice(0, 800).toLowerCase();
  return (
    head.includes("protocolo") ||
    head.includes("cliente") ||
    head.includes("processo") ||
    head.includes("cnj")
  );
}

export async function fetchPlanoBFromUrl(url: string): Promise<{
  ok: boolean;
  rows: PlanoBRow[];
  error?: string;
  headers?: string[];
  usedUrl?: string;
}> {
  try {
    const candidates = buildSheetsFetchCandidates(url);
    if (!candidates.length) return { ok: false, rows: [], error: "URL vazia" };

    let lastErr = "";
    for (const finalUrl of candidates) {
      try {
        const res = await fetch(finalUrl, {
          cache: "no-store",
          redirect: "follow",
          headers: {
            Accept: "text/csv,text/plain,*/*",
            "User-Agent": "LexisPredict-PlanoB/1.0",
          },
        });
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          continue;
        }
        const text = await res.text();
        if (looksLikeHtml(text)) {
          lastErr = "Resposta HTML (sem acesso CSV nesta URL)";
          continue;
        }
        if (!looksLikeCsvWithProtocolo(text) && !text.includes(",")) {
          lastErr = "Conteúdo sem colunas de processo";
          continue;
        }
        const { headers, rows } = parseCsv(text);
        const mapped = mapRowsToPlanoB(headers, rows);
        if (!mapped.length) {
          lastErr = `Aba sem Protocolo (${headers.slice(0, 4).join(", ") || "vazio"})`;
          continue;
        }
        return { ok: true, rows: mapped, headers, usedUrl: finalUrl };
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }
    return {
      ok: false,
      rows: [],
      error:
        lastErr ||
        'Não foi possível ler a planilha. Mantenha "Qualquer pessoa com o link" e a aba Processos — ou use Upload XLSX.',
    };
  } catch (e: any) {
    return { ok: false, rows: [], error: e?.message || String(e) };
  }
}

export function mapMatrixToPlanoB(aoa: string[][]): PlanoBRow[] {
  if (!aoa.length) return [];
  const headers = aoa[0].map((h) => String(h ?? "").trim());
  const rows = aoa.slice(1).map((r) => r.map((c) => String(c ?? "")));
  return mapRowsToPlanoB(headers, rows);
}

export function planoBToCsv(rows: PlanoBRow[]): string {
  const head = [
    "protocolo", "cliente", "telefone", "advogado", "escritorio", "tribunal",
    "status", "situacao", "ultimo_retorno", "proximo_retorno", "criado_por",
    "observacoes", "andamento", "evento_tipo",
  ];
  const esc = (v: string) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.protocolo, r.cliente, r.telefone, r.advogado, r.escritorio, r.tribunal,
        r.status, r.situacao, r.ultimoRetorno, r.proximoRetorno, r.criado_por,
        r.observacoes, r.andamento, r.evento_tipo,
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function computePlanoBKpis(rows: PlanoBRow[]) {
  const total = rows.length;
  const byStatus: Record<string, number> = {};
  let vencidos = 0;
  let arquivados = 0;
  let semTel = 0;
  for (const r of rows) {
    const st = (r.status || "Sem Prazo").trim() || "Sem Prazo";
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (/vencido|crítico|critico/i.test(st)) vencidos++;
    if (/arquiv|encerr/i.test(st) || /encerr/i.test(r.situacao || "")) arquivados++;
    if (!r.telefone?.trim()) semTel++;
  }
  return { total, byStatus, vencidos, arquivados, semTel, ativos: total - arquivados };
}
