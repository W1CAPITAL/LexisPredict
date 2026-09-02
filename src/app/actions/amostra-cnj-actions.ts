"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { COURT_ALIASES } from "@/lib/datajud";
import { extrairHitEstatistico, formatCnj } from "@/lib/amostra-cnj-estatistica";

const DATAJUD_PUBLIC_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_API_KEY = (process.env.DATAJUD_API_KEY || "").trim() || DATAJUD_PUBLIC_KEY;

const DEFAULT_ALIASES = ["tjsp", "tjrj", "tjmg", "tjpr", "tjrs", "tjsc", "tjes", "tjba"];

function aliasValido(a: string) {
  const set = new Set(Object.values(COURT_ALIASES));
  return set.has(a);
}

async function datajudSearch(alias: string, searchAfter: any[] | null, size = 80) {
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
  const body: Record<string, unknown> = {
    size,
    _source: [
      "numeroProcesso",
      "tribunal",
      "classe",
      "assuntos",
      "movimentos.nome",
      "movimentos.codigo",
      "movimentos.dataHora",
    ],
    query: {
      bool: {
        should: [
          { match_phrase: { "movimentos.nome": "sem resolução do mérito" } },
          { match_phrase: { "movimentos.nome": "sem resolucao do merito" } },
          { match_phrase: { "movimentos.nome": "extinção sem resolução" } },
          { match_phrase: { "movimentos.nome": "extincao sem resolucao" } },
          { match_phrase: { "movimentos.nome": "art. 485" } },
        ],
        minimum_should_match: 1,
      },
    },
    sort: [{ "numeroProcesso.keyword": "asc" }, { numeroProcesso: "asc" }],
  };
  if (searchAfter?.length) body.search_after = searchAfter;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 22000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

export async function resumoAmostraCnjAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { total: 0, veiculo: 0, porTipo: [] as { tipo: string; n: number }[] };
  const admin = await getSupabaseAdmin();
  const { count } = await admin.from("amostra_estatistica_cnj").select("cnj", { count: "exact", head: true });
  const { count: veiculo } = await admin
    .from("amostra_estatistica_cnj")
    .select("cnj", { count: "exact", head: true })
    .eq("flag_veiculo_ou_bancario", true);
  return { total: count || 0, veiculo: veiculo || 0 };
}

export async function coletarLoteExtincaoAction(input?: { aliases?: string[]; alvo?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, message: "Sessão expirada", inseridos: 0, vistos: 0 };
  const admin = await getSupabaseAdmin();
  const aliases = (input?.aliases?.length ? input.aliases : DEFAULT_ALIASES).filter(aliasValido);
  const alvo = Math.min(10000, Math.max(100, input?.alvo || 10000));
  const started = Date.now();
  let inseridos = 0;
  let vistos = 0;
  let pulados = 0;
  const erros: string[] = [];

  for (const alias of aliases) {
    if (inseridos >= alvo || Date.now() - started > 48000) break;
    const { data: cur } = await admin
      .from("amostra_estatistica_cursor")
      .select("search_after")
      .eq("alias", alias)
      .maybeSingle();
    let searchAfter: any[] | null = (cur?.search_after as any[]) || null;

    for (let page = 0; page < 30; page++) {
      if (inseridos >= alvo || Date.now() - started > 48000) break;
      const { ok, status, json } = await datajudSearch(alias, searchAfter, 80);
      if (!ok) {
        erros.push(`${alias}: HTTP ${status}`);
        break;
      }
      const hits = json?.hits?.hits || [];
      if (!hits.length) break;
      vistos += hits.length;
      const last = hits[hits.length - 1];
      searchAfter = last?.sort || null;

      const rows = [];
      for (const h of hits) {
        const row = extrairHitEstatistico(h);
        if (!row) continue;
        rows.push({
          ...row,
          empresa_id: ctx.empresa_id,
        });
      }
      if (rows.length) {
        const { data, error } = await admin
          .from("amostra_estatistica_cnj")
          .upsert(rows, { onConflict: "cnj", ignoreDuplicates: true })
          .select("cnj");
        if (error) {
          erros.push(`${alias}: ${error.message}`);
        } else {
          const n = data?.length || 0;
          inseridos += n;
          pulados += rows.length - n;
        }
      }
      await admin.from("amostra_estatistica_cursor").upsert({
        alias,
        search_after: searchAfter,
        updated_at: new Date().toISOString(),
      });
      if (hits.length < 80) break;
    }
  }

  return {
    success: true,
    inseridos,
    vistos,
    pulados,
    alvo,
    erros,
    message: inseridos
      ? `Lote: ${inseridos} CNJs novos (sem nome). Repetidos ignorados: ${pulados}.`
      : erros[0] || "Nenhum CNJ novo neste ciclo. Rode o SQL ou tente de novo (cursor avançou).",
  };
}

export async function listarAmostraCnjAction(limit = 80) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from("amostra_estatistica_cnj")
    .select("cnj, tribunal, classe_nome, assunto_nome, data_baixa, tipo_encerramento, flag_veiculo_ou_bancario, amostra_em")
    .order("amostra_em", { ascending: false })
    .limit(Math.min(200, limit));
  if (error) return [];
  return (data || []).map((r) => ({ ...r, cnj_fmt: formatCnj(r.cnj) }));
}

export async function exportarAmostraCnjCsvAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, csv: "" };
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("amostra_estatistica_cnj")
    .select("cnj, tribunal, classe_codigo, classe_nome, assunto_nome, data_baixa, tipo_encerramento, flag_veiculo_ou_bancario, amostra_em")
    .order("amostra_em", { ascending: false })
    .limit(20000);
  const cols = [
    "cnj",
    "tribunal",
    "classe_codigo",
    "classe_nome",
    "assunto_nome",
    "data_baixa",
    "tipo_encerramento",
    "flag_veiculo_ou_bancario",
    "amostra_em",
  ];
  const lines = [cols.join(";")];
  for (const r of data || []) {
    lines.push(cols.map((c) => String((r as any)[c] ?? "").replace(/;/g, ",")).join(";"));
  }
  return { success: true, csv: lines.join("\n") };
}
