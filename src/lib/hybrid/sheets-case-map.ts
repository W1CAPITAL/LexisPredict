/**
 * Converte linhas da planilha (Apps Script list) → LegalCase mínimo
 * para /cases e /processos no modo híbrido.
 */

import type { LegalCase } from "@/lib/case-logic";
import { processarCaso } from "@/lib/case-logic";

function g(row: any, ...keys: string[]): string {
  if (!row || typeof row !== "object") return "";
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  // case-insensitive
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase()] = v;
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function sheetRowToLegalCase(row: any, idx = 0): LegalCase | null {
  const protocolo = g(
    row,
    "Protocolo",
    "protocolo",
    "protocolo_ref",
    "cnj",
    "CNJ",
    "Processo"
  );
  if (!protocolo) return null;

  const cliente = g(row, "Cliente", "cliente", "nome", "Nome");
  const ultimo = g(
    row,
    "UltimoRetorno",
    "ultimoRetorno",
    "ultimo_retorno",
    "RETORNO",
    "Retorno"
  );
  const proximo = g(
    row,
    "ProximoRetorno",
    "proximoRetorno",
    "proximo_retorno",
    "PROXIMO RETORNO",
    "Prazo"
  );
  const createdBy = g(row, "CreatedBy", "created_by", "Responsavel", "responsavel");
  const atendido = g(row, "AtendidoPor", "atendido_por", "atendidoPor");
  const status = g(row, "Status", "status", "Situacao", "situacao");
  const obs = g(row, "Observacao", "observacao", "Observacoes", "obs");
  const mov = g(row, "ultimo_movimento", "UltimoMovimento", "andamento", "Andamento");
  const djen = g(row, "DJEN_Resumo", "djen_resumo", "DJEN");
  const enc = g(row, "DatajudEncerrado", "datajud_encerrado_tribunal");
  const empresaId = g(row, "EmpresaId", "empresa_id", "empresaId");

  const base = {
    id: `sheets-${protocolo.replace(/\D/g, "") || idx}`,
    protocolo,
    cliente: cliente || "—",
    advogado: g(row, "Advogado", "advogado") || "",
    escritorio: g(row, "Escritorio", "escritorio") || "",
    telefone: g(row, "Telefone", "telefone") || "",
    tribunal: g(row, "Tribunal", "tribunal") || "",
    situacao: status || "EM ANDAMENTO",
    status: status || "EM ANDAMENTO",
    statusManual: status || "",
    ultimoRetorno: ultimo || "",
    proximoPrazo: proximo || "",
    observacao: obs || "",
    created_by: createdBy || undefined,
    atendido_por: atendido || undefined,
    datajud_ultimo_nome: mov || undefined,
    djen_ultimo_resumo: djen || undefined,
    datajud_encerrado_tribunal:
      enc === true ||
      enc === "true" ||
      enc === "TRUE" ||
      enc === "1" ||
      enc === "sim",
    empresa_id: empresaId || undefined,
    risco: "medio" as const,
    linkConsulta: "",
  };

  try {
    return processarCaso(base as any);
  } catch {
    return base as unknown as LegalCase;
  }
}

export function sheetRowsToLegalCases(rows: any[]): LegalCase[] {
  const out: LegalCase[] = [];
  const seen = new Set<string>();
  (rows || []).forEach((row, i) => {
    const c = sheetRowToLegalCase(row, i);
    if (!c) return;
    const key = String(c.protocolo || "").replace(/\D/g, "");
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    out.push(c);
  });
  return out;
}
