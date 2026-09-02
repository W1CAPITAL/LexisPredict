/**
 * Linhas da planilha Processos (cabeçalho W1/export) → LegalCase
 * Colunas oficiais do CSV:
 * Protocolo,Cliente,Status,Situacao,UltimoRetorno,ProximoRetorno,Advogado,Escritorio,
 * Tribunal,Telefone,CreatedBy,AtendidoPor,Observacao,DatajudEncerrado,EmpresaId,
 * isBaixaTribunal,ultimo_movimento,fase,valor_causa,updated_at,Assistente,Distribuicao,
 * Produtos,Data_Movimentacao,Andamento,Evento_Tipo,Novo_Andamento,Busca_Apreensao,
 * Cumprimento,DJEN_Resumo,Dias_Sem_Retorno,Procedente,Improcedente
 */

import type { LegalCase } from "@/lib/case-logic";
import { processarCaso } from "@/lib/case-logic";

function g(row: any, ...keys: string[]): string {
  if (!row || typeof row !== "object") return "";
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[String(k).toLowerCase()] = v;
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function truthy(v: string): boolean {
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "sim" || s === "yes" || s === "x";
}

export function sheetRowToLegalCase(row: any, idx = 0): LegalCase | null {
  const protocolo = g(row, "Protocolo", "protocolo", "protocolo_ref", "cnj", "CNJ", "Processo");
  if (!protocolo) return null;

  const ultimo = g(row, "UltimoRetorno", "ultimoRetorno", "ultimo_retorno", "RETORNO", "Retorno");
  const proximo = g(
    row,
    "ProximoRetorno",
    "proximoRetorno",
    "proximo_retorno",
    "PROXIMO RETORNO",
    "Prazo",
    "proximo_prazo"
  );
  const createdBy = g(row, "CreatedBy", "created_by", "Responsavel", "responsavel");
  const atendido = g(row, "AtendidoPor", "atendido_por", "atendidoPor");
  const status = g(row, "Status", "status");
  const situacao = g(row, "Situacao", "situacao") || status;
  const mov = g(row, "ultimo_movimento", "UltimoMovimento", "Andamento", "andamento", "Data_Movimentacao");
  const djen = g(row, "DJEN_Resumo", "djen_resumo", "DJEN");
  const enc = g(row, "DatajudEncerrado", "datajud_encerrado_tribunal", "isBaixaTribunal");
  const cump = g(row, "Cumprimento", "em_cumprimento_sentenca");
  const ba = g(row, "Busca_Apreensao", "busca_apreensao");
  const proc = g(row, "Procedente", "procedente");
  const improc = g(row, "Improcedente", "improcedente");

  const base: any = {
    id: `sheets-${protocolo.replace(/\D/g, "") || idx}`,
    protocolo,
    cliente: g(row, "Cliente", "cliente", "nome") || "—",
    advogado: g(row, "Advogado", "advogado") || "",
    escritorio: g(row, "Escritorio", "escritorio") || "",
    telefone: g(row, "Telefone", "telefone") || "",
    tribunal: g(row, "Tribunal", "tribunal") || "",
    situacao: situacao || "EM ANDAMENTO",
    status: status || situacao || "EM ANDAMENTO",
    statusManual: status || "",
    ultimoRetorno: ultimo || "",
    proximoPrazo: proximo || "",
    observacao: g(row, "Observacao", "observacao", "Observacoes") || "",
    created_by: createdBy || undefined,
    atendido_por: atendido || undefined,
    datajud_ultimo_nome: mov || undefined,
    ultimaMovimentacao: mov || undefined,
    djen_ultimo_resumo: djen || undefined,
    datajud_encerrado_tribunal: truthy(enc),
    em_cumprimento_sentenca: truthy(cump),
    indicio_busca_apreensao: truthy(ba),
    produtos: g(row, "Produtos", "produtos") || undefined,
    dataDistribuicao: g(row, "Distribuicao", "distribuicao") || undefined,
    atendente: g(row, "Assistente", "assistente") || undefined,
    empresa_id: g(row, "EmpresaId", "empresa_id") || undefined,
    risco: "medio",
    linkConsulta: "",
  };
  if (truthy(proc)) base.parecerIA = "Procedente (planilha)";
  if (truthy(improc)) base.parecerIA = "Improcedente (planilha)";

  try {
    return processarCaso(base);
  } catch {
    return base as LegalCase;
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

/** Cabeçalho canônico da planilha (export W1) */
export const SHEETS_PROCESSOS_HEADERS = [
  "Protocolo",
  "Cliente",
  "Status",
  "Situacao",
  "UltimoRetorno",
  "ProximoRetorno",
  "Advogado",
  "Escritorio",
  "Tribunal",
  "Telefone",
  "CreatedBy",
  "AtendidoPor",
  "Observacao",
  "DatajudEncerrado",
  "EmpresaId",
  "isBaixaTribunal",
  "ultimo_movimento",
  "fase",
  "valor_causa",
  "updated_at",
  "Assistente",
  "Distribuicao",
  "Produtos",
  "Data_Movimentacao",
  "Andamento",
  "Evento_Tipo",
  "Novo_Andamento",
  "Busca_Apreensao",
  "Cumprimento",
  "DJEN_Resumo",
  "Dias_Sem_Retorno",
  "Procedente",
  "Improcedente",
] as const;
