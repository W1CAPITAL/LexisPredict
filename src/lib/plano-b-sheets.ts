/**
 * Plano B — carteira em Google Sheets / CSV.
 * NÃO substitui Supabase por padrão. Só entra se o operador ativar.
 * Inspirado no SyncCRM (aliases de coluna), sem OAuth obrigatório:
 * use "Publicar na web" → CSV ou link export?format=csv.
 */

export type PlanoBRow = {
  protocolo: string;
  cliente: string;
  advogado: string;
  escritorio: string;
  tribunal: string;
  status: string;
  situacao: string;
  ultimoRetorno: string;
  proximoRetorno: string;
  criado_por: string;
  observacoes: string;
  raw: Record<string, string>;
};

const ALIASES: Record<keyof Omit<PlanoBRow, "raw">, string[]> = {
  protocolo: ["protocolo", "processo", "cnj", "numero", "nº processo", "numero processo", "proc", "protocolo_ref"],
  cliente: ["cliente", "nome", "parte", "autor", "requerente", "beneficiario", "beneficiário"],
  advogado: ["advogado", "responsavel", "responsável", "analista", "operador", "atendente"],
  escritorio: ["escritorio", "escritório", "empresa", "parceiro", "unidade"],
  tribunal: ["tribunal", "tj", "comarca", "orgao", "órgão"],
  status: ["status", "situacao_prazo", "situacao", "situação", "fase", "estado"],
  situacao: ["situacao_gabinete", "situacao", "situação", "gabinete", "situacao_prazo"],
  ultimoRetorno: ["ultimo_retorno", "último retorno", "ultimo retorno", "retorno", "atendido_em"],
  proximoRetorno: ["proximo_retorno", "próximo retorno", "proximo retorno", "proximo_retorno", "prazo", "proximo prazo"],
  criado_por: ["criado_por", "criado por", "dono", "owner", "created_by", "assistente", "responsavel carteira"],
  observacoes: ["observacoes", "observações", "obs", "notas", "comentario"],
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

/** CSV simples com suporte a aspas */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  const src = text.replace(/^\uFEFF/, "");
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
      else if (c === ",") {
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
  const headers = lines[0].map((h) => h.trim());
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
    out.push({
      protocolo,
      cliente: pick(headers, row, ALIASES.cliente),
      advogado: pick(headers, row, ALIASES.advogado),
      escritorio: pick(headers, row, ALIASES.escritorio),
      tribunal: pick(headers, row, ALIASES.tribunal),
      status: pick(headers, row, ALIASES.status) || "Sem Prazo",
      situacao: pick(headers, row, ALIASES.situacao),
      ultimoRetorno: pick(headers, row, ALIASES.ultimoRetorno),
      proximoRetorno: pick(headers, row, ALIASES.proximoRetorno),
      criado_por: pick(headers, row, ALIASES.criado_por),
      observacoes: pick(headers, row, ALIASES.observacoes),
      raw,
    });
  }
  return out;
}

/**
 * Aceita:
 * - CSV cru
 * - URL docs.google.com/.../export?format=csv
 * - URL docs.google.com/.../pub?output=csv
 */
export function normalizeSheetsCsvUrl(input: string): string {
  const u = String(input || "").trim();
  if (!u) return "";
  if (u.includes("docs.google.com/spreadsheets")) {
    const idMatch = u.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = u.match(/[?&#]gid=([0-9]+)/);
    const id = idMatch?.[1];
    const gid = gidMatch?.[1] || "0";
    if (id) {
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
  }
  return u;
}

export async function fetchPlanoBFromUrl(url: string): Promise<{
  ok: boolean;
  rows: PlanoBRow[];
  error?: string;
  headers?: string[];
}> {
  try {
    const finalUrl = normalizeSheetsCsvUrl(url);
    if (!finalUrl) return { ok: false, rows: [], error: "URL vazia" };
    const res = await fetch(finalUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "text/csv,text/plain,*/*" },
    });
    if (!res.ok) {
      return {
        ok: false,
        rows: [],
        error: `HTTP ${res.status} — planilha precisa estar publicada (CSV) ou link export público`,
      };
    }
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      return {
        ok: false,
        rows: [],
        error: "Resposta HTML (planilha privada). Use Arquivo → Compartilhar → Publicar na web → CSV.",
      };
    }
    const { headers, rows } = parseCsv(text);
    const mapped = mapRowsToPlanoB(headers, rows);
    return { ok: true, rows: mapped, headers };
  } catch (e: any) {
    return { ok: false, rows: [], error: e?.message || String(e) };
  }
}

export function planoBToCsv(rows: PlanoBRow[]): string {
  const head = [
    "protocolo",
    "cliente",
    "advogado",
    "escritorio",
    "tribunal",
    "status",
    "situacao",
    "ultimo_retorno",
    "proximo_retorno",
    "criado_por",
    "observacoes",
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
        r.protocolo,
        r.cliente,
        r.advogado,
        r.escritorio,
        r.tribunal,
        r.status,
        r.situacao,
        r.ultimoRetorno,
        r.proximoRetorno,
        r.criado_por,
        r.observacoes,
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}
