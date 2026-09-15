/**
 * Extrai CPF válido de teor DJEN / PJe (comum em MG e outros tribunais).
 * Fora da carteira Lexis — só texto público da publicação.
 */
import { cpfValido } from "@/lib/cpf-cnpj";

function digitsOnly(s: string): string { return String(s || "").replace(/\D/g, ""); }

/** Só o número rotulado ou formatado; valida ambos os dígitos verificadores. */
export function extractCpfFromDjenText(texto: string | null | undefined): string {
  const t = String(texto || "");
  const labeled = /\bCPF(?:\s*\/\s*MF)?\s*(?:n[.º°o]*\s*)?[:\-]?\s*(\d{3}\.?\d{3}\.?\d{3}[\-\/]?\d{2})(?!\d)/gi;
  const formatted = /(?<!\d)(\d{3}\.\d{3}\.\d{3}-\d{2})(?!\d)/g;
  for (const regex of [labeled, formatted]) {
    for (const match of t.matchAll(regex)) {
      const d = digitsOnly(match[1]);
      if (cpfValido(d)) return d;
    }
  }
  return "";
}

export function formatCpfMasked(digits: string): string {
  const d = digitsOnly(digits);
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Lista de TJs usuais no gerador (DJEN siglaTribunal). Vazio = todos. */
export const TRIBUNAIS_DJEN = [
  { id: "", label: "Todos os tribunais" },
  { id: "TJSP", label: "TJSP" },
  { id: "TJMG", label: "TJMG" },
  { id: "TJRJ", label: "TJRJ" },
  { id: "TJPR", label: "TJPR" },
  { id: "TJRS", label: "TJRS" },
  { id: "TJBA", label: "TJBA" },
  { id: "TJGO", label: "TJGO" },
  { id: "TJSC", label: "TJSC" },
  { id: "TJDF", label: "TJDF" },
  { id: "TJPE", label: "TJPE" },
  { id: "TJCE", label: "TJCE" },
  { id: "TJMT", label: "TJMT" },
  { id: "TJMS", label: "TJMS" },
  { id: "TJES", label: "TJES" },
  { id: "TJPA", label: "TJPA" },
  { id: "TJMA", label: "TJMA" },
  { id: "TJPB", label: "TJPB" },
  { id: "TJRN", label: "TJRN" },
  { id: "TJAL", label: "TJAL" },
  { id: "TJSE", label: "TJSE" },
  { id: "TJPI", label: "TJPI" },
  { id: "TJRO", label: "TJRO" },
  { id: "TJTO", label: "TJTO" },
  { id: "TJAC", label: "TJAC" },
  { id: "TJAP", label: "TJAP" },
  { id: "TJAM", label: "TJAM" },
  { id: "TJRR", label: "TJRR" },
] as const;
