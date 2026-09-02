"use server";

/**
 * Busca processos da empresa por CNJ/protocolo/cliente no banco inteiro.
 * Prioriza correspondências exatas e também pesquisa nas colunas relacionais
 * e no JSON `dados`, para não perder registros antigos/inconsistentes.
 */

function digitsOnly(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

function normalizeCnjDisplay(digits: string): string {
  if (digits.length !== 20) return digits;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function safeOr(parts: string[]): string {
  return parts.filter(Boolean).join(",");
}

export async function searchCompanyProcessosAction(query: string): Promise<{
  ok: boolean;
  cases: any[];
  error?: string;
}> {
  try {
    const q = String(query || "").trim();
    if (!q || q.length < 2) return { ok: true, cases: [] };

    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const { processarCaso } = await import("@/lib/case-logic");

    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return { ok: false, cases: [], error: "sem empresa" };

    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, cases: [], error: "admin" };

    const empresaId = String(ctx.empresa_id);
    const dig = digitsOnly(q);
    const found = new Map<string, any>();

    // Correspondência exata no protocolo.
    const exact = await admin
      .from("processos")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("protocolo_ref", q)
      .limit(50);
    for (const row of exact.data || []) found.set(String(row.id), row);

    if (dig.length === 20) {
      const fmt = normalizeCnjDisplay(dig);
      const fmtRows = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("protocolo_ref", fmt)
        .limit(50);
      for (const row of fmtRows.data || []) found.set(String(row.id), row);
    }

    // Busca ampla por protocolo.
    const proto = await admin
      .from("processos")
      .select("*")
      .eq("empresa_id", empresaId)
      .ilike("protocolo_ref", `%${q}%`)
      .limit(100);
    for (const row of proto.data || []) found.set(String(row.id), row);

    if (dig.length >= 8) {
      const tail = dig.slice(-12);
      const byTail = await admin
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .ilike("protocolo_ref", `%${tail.slice(0, 4)}%${tail.slice(-4)}%`)
        .limit(200);

      for (const row of byTail.data || []) {
        const pDig = digitsOnly(row.protocolo_ref || row.dados?.protocolo || "");
        if (
          pDig.includes(dig) ||
          dig.includes(pDig) ||
          (tail && pDig.endsWith(tail))
        ) {
          found.set(String(row.id), row);
        }
      }
    }

    // Cliente/advogado: pesquisa tanto colunas relacionais quanto JSON.
    // A versão anterior pesquisava apenas `dados->>cliente`, o que fazia
    // alguns clientes existentes desaparecerem da busca.
    const textColumns = [
      `cliente.ilike.%${q}%`,
      `advogado.ilike.%${q}%`,
      `escritorio.ilike.%${q}%`,
      `telefone.ilike.%${q}%`,
      `dados->>cliente.ilike.%${q}%`,
      `dados->>CLIENTE.ilike.%${q}%`,
      `dados->>advogado.ilike.%${q}%`,
      `dados->>ADVOGADO.ilike.%${q}%`,
      `dados->>escritorio.ilike.%${q}%`,
      `dados->>ESCRITORIO.ilike.%${q}%`,
      `dados->>telefone.ilike.%${q}%`,
      `dados->>TELEFONE.ilike.%${q}%`,
    ];

    const textRows = await admin
      .from("processos")
      .select("*")
      .eq("empresa_id", empresaId)
      .or(safeOr(textColumns))
      .limit(200);

    for (const row of textRows.data || []) found.set(String(row.id), row);

    const cases: any[] = [];
    for (const row of found.values()) {
      const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
      const base = {
        id: row.id,
        db_id: row.id,
        protocolo: row.protocolo_ref || dados.protocolo,
        protocolo_ref: row.protocolo_ref,
        cliente:
          row.cliente ||
          dados.cliente ||
          dados.CLIENTE ||
          "",
        advogado:
          row.advogado ||
          dados.advogado ||
          dados.ADVOGADO ||
          "",
        escritorio:
          row.escritorio ||
          dados.escritorio ||
          dados.ESCRITORIO ||
          "",
        tribunal:
          row.tribunal ||
          dados.tribunal ||
          dados.TRIBUNAL ||
          "",
        telefone:
          row.telefone ||
          dados.telefone ||
          dados.TELEFONE ||
          "",
        status: row.status || dados.status,
        situacao: dados.situacao || row.status_interno || row.status,
        statusManual: dados.statusManual,
        ultimoRetorno: row.ultimo_retorno || dados.ultimoRetorno || dados.ultimo_retorno,
        proximoPrazo: row.proximo_retorno || dados.proximoPrazo || dados.proximo_retorno,
        created_by: row.created_by,
        atendido_por: row.atendido_por || dados.atendido_por,
        dados,
        ...dados,
      };
      try {
        const processed = processarCaso(base as any);
        cases.push({
          ...processed,
          id: row.id,
          protocolo: base.protocolo,
          created_by: row.created_by,
          atendido_por: base.atendido_por,
        });
      } catch {
        cases.push({
          ...base,
          status: row.status || base.status || "Sem Prazo",
        });
      }
    }

    // Exato/mais relevante primeiro.
    const qNorm = q.toLocaleLowerCase();
    cases.sort((a, b) => {
      const score = (c: any) => {
        const cliente = String(c.cliente || "").toLocaleLowerCase();
        const protocolo = String(c.protocolo || "").toLocaleLowerCase();
        let n = 0;
        if (cliente === qNorm) n += 1000;
        if (protocolo === qNorm) n += 900;
        if (cliente.startsWith(qNorm)) n += 200;
        if (protocolo.startsWith(qNorm)) n += 150;
        return n;
      };
      return score(b) - score(a);
    });

    return { ok: true, cases };
  } catch (e: any) {
    console.error("[searchCompanyProcessosAction]", e?.message || e);
    return { ok: false, cases: [], error: e?.message || String(e) };
  }
}
