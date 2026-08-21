/**
 * KPIs e ranking de atendimento calculados no SERVIDOR sobre a carteira completa.
 * Não depende do array limitado da Fila/Dashboard (priority 350–400).
 *
 * Colunas usadas: protocolo_ref, ultimo_retorno, atendido_por, created_by, dados (só se necessário)
 */

import {
  casoAtendidoNestaSemana,
  isAtendidoHoje,
  pickUltimoRetorno,
  parseUltimoAtendimento,
  labelSemanaAtual,
  hojeBrasilYmd,
} from "@/lib/atendimento-semana";
import { startOfMonth, endOfMonth, isWithinInterval, startOfDay } from "date-fns";

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
  /** por auth id / nome normalizado */
  porUsuario: Record<string, { semana: number; hoje: number; mes: number; nome: string }>;
};

function nomeDeRow(row: any): string {
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  return String(
    row.atendido_por_nome ||
      d.atendido_por_nome ||
      d.ultimo_atendente ||
      d.advogado ||
      row.atendido_por ||
      row.created_by ||
      "—"
  )
    .trim()
    .toUpperCase();
}

function keyDeRow(row: any): string {
  return String(row.atendido_por || row.created_by || nomeDeRow(row) || "—")
    .trim()
    .toLowerCase();
}

function pickRetorno(row: any): string | null {
  // colunas de tabela ou dentro de dados
  if (row.ultimo_retorno) return String(row.ultimo_retorno);
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  return (
    d.ultimoRetorno ||
    d.ultimo_retorno ||
    d.ultimoAtendimento ||
    d.data_retorno ||
    null
  );
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

/**
 * Agrega a partir de rows leves (pode ser resultado de select parcial).
 */
export function aggregateKpiAtendimento(
  rows: any[],
  opts?: { ref?: Date; rankingLimit?: number }
): KpiAtendimentoServer {
  const ref = opts?.ref ?? new Date();
  const rankingLimit = opts?.rankingLimit ?? 5;
  let atendidosSemana = 0;
  let atendidosHoje = 0;
  let totalAtivos = 0;
  const porUsuario: KpiAtendimentoServer["porUsuario"] = {};

  for (const row of rows || []) {
    if (!isEncerrado(row)) totalAtivos += 1;
    const retorno = pickRetorno(row);
    const fakeCase = { ultimoRetorno: retorno, ultimo_retorno: retorno, ...row };
    const semana = casoAtendidoNestaSemana(fakeCase as any, ref);
    const hoje = isAtendidoHoje(retorno, ref);
    const mes = inMonth(retorno, ref);

    if (semana) atendidosSemana += 1;
    if (hoje) atendidosHoje += 1;

    if (!semana && !hoje && !mes) continue;
    // só conta no ranking quem tem atendimento no período
    if (!semana && !hoje && !mes) continue;

    const key = keyDeRow(row);
    const nome = nomeDeRow(row);
    if (!porUsuario[key]) {
      porUsuario[key] = { semana: 0, hoje: 0, mes: 0, nome };
    }
    if (semana) porUsuario[key].semana += 1;
    if (hoje) porUsuario[key].hoje += 1;
    if (mes) porUsuario[key].mes += 1;
    // preferir nome legível
    if (nome && nome !== "—" && porUsuario[key].nome.length < nome.length) {
      porUsuario[key].nome = nome;
    }
  }

  const ranking: RankAtendente[] = Object.entries(porUsuario)
    .map(([key, v]) => ({
      key,
      nome: v.nome,
      semana: v.semana,
      hoje: v.hoje,
      mes: v.mes,
    }))
    .filter((r) => r.semana > 0 || r.hoje > 0 || r.mes > 0)
    .sort((a, b) => b.semana - a.semana || b.mes - a.mes || b.hoje - a.hoje)
    .slice(0, rankingLimit);

  return {
    totalAtivos,
    totalLinhas: (rows || []).length,
    atendidosSemana,
    atendidosHoje,
    semanaLabel: labelSemanaAtual(ref),
    ranking,
    porUsuario,
  };
}
