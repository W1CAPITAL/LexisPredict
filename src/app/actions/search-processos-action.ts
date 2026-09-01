"use server";

/**
 * Busca processos da empresa por CNJ/protocolo/cliente no banco inteiro
 * (não na amostra de 300 da tabela).
 */

function digitsOnly(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

function normalizeCnjDisplay(digits: string): string {
  // 20 dígitos NNNNNNN-DD.AAAA.J.TR.OOOO
  if (digits.length !== 20) return digits;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

export async function searchCompanyProcessosAction(query: string): Promise<{
  ok: boolean;
  cases: any[];
  error?: string;
}> {
  try {
    const q = String(query || "").trim();
    if (!q || q.length < 3) return { ok: true, cases: [] };

    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    // toLegalCase não é exportado — reusa getStoredCasesPage pattern via select + map local
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return { ok: false, cases: [], error: "sem empresa" };
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, cases: [], error: "admin" };

    const empresaId = String(ctx.empresa_id);
    const dig = digitsOnly(q);
    const found = new Map<string, any>();

    // 1) Match exato protocolo_ref (como digitado)
    {
      const { data } = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("protocolo_ref", q)
        .limit(20);
      for (const row of data || []) found.set(String(row.id), row);
    }

    // 2) CNJ formatado padrão se 20 dígitos
    if (dig.length === 20) {
      const fmt = normalizeCnjDisplay(dig);
      const { data } = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("protocolo_ref", fmt)
        .limit(20);
      for (const row of data || []) found.set(String(row.id), row);
    }

    // 3) ilike no protocolo_ref (parcial)
    {
      const { data } = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .ilike("protocolo_ref", `%${q}%`)
        .limit(40);
      for (const row of data || []) found.set(String(row.id), row);
    }

    // 4) Se tem dígitos, busca por sequência de dígitos no protocolo (variações 000 vs 00)
    if (dig.length >= 8) {
      // últimos 12–15 dígitos ajudam a achar com zeros à esquerda diferentes
      const tail = dig.slice(-12);
      const { data } = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .ilike("protocolo_ref", `%${tail.slice(0, 4)}%${tail.slice(-4)}%`)
        .limit(80);
      for (const row of data || []) {
        const pDig = digitsOnly(row.protocolo_ref || "");
        if (pDig.includes(dig) || dig.includes(pDig) || pDig.endsWith(tail) || dig.endsWith(pDig.slice(-12))) {
          found.set(String(row.id), row);
        }
      }
    }

    // 5) Cliente / advogado (texto)
    if (dig.length < 10) {
      const { data } = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .or(`dados->>cliente.ilike.%${q}%,dados->>CLIENTE.ilike.%${q}%`)
        .limit(30);
      for (const row of data || []) found.set(String(row.id), row);
    }

    // Map para shape de lista (compatível com LegalCase mínimo)
    const { processarCaso } = await import("@/lib/case-logic");
    const cases: any[] = [];
    for (const row of found.values()) {
      const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
      try {
        const base = {
          id: row.id,
          protocolo: row.protocolo_ref || dados.protocolo,
          protocolo_ref: row.protocolo_ref,
          cliente: dados.cliente || dados.CLIENTE || "",
          advogado: dados.advogado || dados.ADVOGADO || "",
          escritorio: dados.escritorio || "",
          tribunal: dados.tribunal || dados.TRIBUNAL || "",
          status: row.status,
          situacao: dados.situacao || row.status_interno,
          statusManual: dados.statusManual,
          ultimoRetorno: row.ultimo_retorno || dados.ultimoRetorno,
          created_by: row.created_by,
          atendido_por: row.atendido_por,
          dados,
          ...dados,
        };
        const processed = processarCaso(base as any);
        cases.push({ ...processed, id: row.id, protocolo: base.protocolo, created_by: row.created_by });
      } catch {
        cases.push({
          id: row.id,
          protocolo: row.protocolo_ref,
          cliente: dados.cliente || "",
          status: row.status || "Sem Prazo",
          created_by: row.created_by,
        });
      }
    }

    return { ok: true, cases };
  } catch (e: any) {
    console.error("[searchCompanyProcessosAction]", e?.message);
    return { ok: false, cases: [], error: e?.message };
  }
}
