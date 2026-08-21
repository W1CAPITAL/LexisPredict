"use server";

import {
  casoAtendidoNestaSemana,
  isAtendidoHoje,
  parseUltimoAtendimento,
  labelSemanaAtual,
} from "@/lib/atendimento-semana";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export type RankAtendente = {
  key: string;
  nome: string;
  semana: number;
  hoje: number;
  mes: number;
};

export type KpiAtendimentoServer = {
  totalAtivos: number;
  totalLinhas: number;
  atendidosSemana: number;
  atendidosHoje: number;
  semanaLabel: string;
  ranking: RankAtendente[];
};

function emptyKpi(): KpiAtendimentoServer {
  return {
    totalAtivos: 0,
    totalLinhas: 0,
    atendidosSemana: 0,
    atendidosHoje: 0,
    semanaLabel: labelSemanaAtual(),
    ranking: [],
  };
}

function pickRetorno(row: any): string | null {
  if (row.ultimo_retorno) return String(row.ultimo_retorno);
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  return d.ultimoRetorno || d.ultimo_retorno || d.ultimoAtendimento || null;
}

function userKey(row: any): string {
  return String(row.atendido_por || row.created_by || "")
    .trim()
    .toLowerCase();
}

function isEncerrado(row: any): boolean {
  const st = String(row.status || row?.dados?.status || "").toLowerCase();
  if (/encerr|baix|arquiv|cancel/.test(st)) return true;
  if (row.datajud_encerrado_tribunal === true) return true;
  return false;
}

function inMonth(raw: string | null, ref: Date): boolean {
  const d = parseUltimoAtendimento(raw);
  if (!d) return false;
  return isWithinInterval(d, { start: startOfMonth(ref), end: endOfMonth(ref) });
}

async function loadNameMap(client: any, empresaId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const { data } = await client
      .from("usuarios")
      .select("id, auth_user_id, nome, email")
      .eq("empresa_id", empresaId);
    for (const u of data || []) {
      const nome = String(u.nome || u.email || "").trim();
      if (!nome) continue;
      if (u.id) map[String(u.id).toLowerCase()] = nome;
      if (u.auth_user_id) map[String(u.auth_user_id).toLowerCase()] = nome;
    }
  } catch {
    /* */
  }
  return map;
}

/**
 * KPI + ranking da empresa INTEIRA.
 * Colunas leves; não usa export `supabase` (inexistente).
 */
export async function fetchKpiAtendimentoEmpresaAction(): Promise<KpiAtendimentoServer> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return emptyKpi();

    const client = await getSupabaseAdmin();
    if (!client) return emptyKpi();

    const empresaId = String(ctx.empresa_id);
    const nameById = await loadNameMap(client, empresaId);
    const ref = new Date();

    const COLS =
      "id, protocolo_ref, empresa_id, created_by, atendido_por, ultimo_retorno, status, datajud_encerrado_tribunal, dados";

    const pageSize = 1000;
    let offset = 0;
    let all: any[] = [];
    const HARD_MAX = 10000;

    while (all.length < HARD_MAX) {
      const { data, error } = await client
        .from("processos")
        .select(COLS)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("[fetchKpiAtendimentoEmpresaAction]", error.message);
        break;
      }
      const chunk = data || [];
      all = all.concat(chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
    }

    let atendidosSemana = 0;
    let atendidosHoje = 0;
    let totalAtivos = 0;
    const por: Record<string, RankAtendente> = {};

    for (const row of all) {
      if (!isEncerrado(row)) totalAtivos += 1;
      const retorno = pickRetorno(row);
      const fake = { ultimoRetorno: retorno, ultimo_retorno: retorno };
      const semana = casoAtendidoNestaSemana(fake as any, ref);
      const hoje = isAtendidoHoje(retorno, ref);
      const mes = inMonth(retorno, ref);

      if (semana) atendidosSemana += 1;
      if (hoje) atendidosHoje += 1;
      if (!semana && !hoje && !mes) continue;

      const key = userKey(row);
      if (!key) continue;

      const nome =
        nameById[key] ||
        String(row?.dados?.atendido_por_nome || "").trim() ||
        key.slice(0, 8) + "…";

      if (!por[key]) {
        por[key] = { key, nome: nome.toUpperCase(), semana: 0, hoje: 0, mes: 0 };
      }
      if (semana) por[key].semana += 1;
      if (hoje) por[key].hoje += 1;
      if (mes) por[key].mes += 1;
      if (nameById[key]) por[key].nome = nameById[key].toUpperCase();
    }

    const ranking = Object.values(por)
      .filter((r) => r.semana > 0 || r.hoje > 0 || r.mes > 0)
      .sort((a, b) => b.semana - a.semana || b.mes - a.mes || b.hoje - a.hoje)
      .slice(0, 5);

    return {
      totalAtivos,
      totalLinhas: all.length,
      atendidosSemana,
      atendidosHoje,
      semanaLabel: labelSemanaAtual(ref),
      ranking,
    };
  } catch (e: any) {
    console.error("[fetchKpiAtendimentoEmpresaAction]", e?.message);
    return emptyKpi();
  }
}
