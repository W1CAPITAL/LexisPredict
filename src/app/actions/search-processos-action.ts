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

export async function searchCompanyProcessosAction(query: string): Promise<{
  ok: boolean;
  cases: any[];
  error?: string;
}> {
  try {
    const q = String(query || "").trim().slice(0, 120);
    if (!q || q.length < 2) return { ok: true, cases: [] };

    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const { processarCaso } = await import("@/lib/case-logic");

    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) return { ok: false, cases: [], error: "sem sessão ou empresa" };

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
          (pDig.length > 0 && pDig.includes(dig)) ||
          (pDig.length > 0 && dig.includes(pDig)) ||
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
      "cliente", "advogado", "escritorio", "telefone",
      "dados->>cliente", "dados->>CLIENTE",
      "dados->>advogado", "dados->>ADVOGADO",
      "dados->>escritorio", "dados->>ESCRITORIO",
      "dados->>telefone", "dados->>TELEFONE",
    ];
    // Pesquisa direta no banco, sem depender das páginas carregadas na interface.
    // Um telefone salvo como (11) 99999-9999 também corresponde a 11999999999.
    const phonePattern = dig.length >= 8 && dig.length <= 15
      ? dig.split("").join("%")
      : null;
    const requests = textColumns.flatMap((column) => {
      const patterns = [`%${q}%`];
      if (phonePattern && column.toLowerCase().includes("telefone")) {
        patterns.push(`%${phonePattern}%`);
      }
      return patterns.map((pattern) =>
        admin.from("processos").select("*")
          .eq("empresa_id", empresaId)
          .ilike(column, pattern)
          .limit(400)
      );
    });
    const textResults = await Promise.all(requests);
    for (const result of textResults) {
      for (const row of result.data || []) found.set(String(row.id), row);
    }
    // Não mascarar erro de banco como "nenhum processo encontrado".
    if (found.size === 0 && textResults.every((result) => !!result.error)) {
      return { ok: false, cases: [], error: "A pesquisa no banco falhou. Tente novamente." };
    }

    const cases: any[] = [];
    for (const row of found.values()) {
      const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
      const base = {
        ...dados, // o JSON legado é fallback; colunas SQL atualizadas sempre prevalecem
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
        if (dig.length >= 8 && String(c.telefone || "").replace(/\D/g, "").includes(dig)) n += 175;
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
