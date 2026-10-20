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
    const {resolveSituacaoFromRow,resolveStatusManualFromRow}=await import("@/lib/resolve-situacao");

    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) return { ok: false, cases: [], error: "sem sessão ou empresa" };

    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, cases: [], error: "admin" };

    const empresaId = String(ctx.empresa_id);
    const dig = digitsOnly(q);
    // Busca por CNJ, cliente, telefone ou advogado em UMA chamada ao Postgres,
    // evitando 12-20 SELECTs e processamento repetido do JSON completo.
    const {data:matches,error:searchError}=await admin.rpc("buscar_carteira_empresa_rapido",{
      p_empresa:empresaId,p_query:q,p_limit:100
    });
    if(searchError) {
      console.error("[searchCompanyProcessosAction] RPC",searchError);
      return {ok:false,cases:[],error:"Falha ao consultar a carteira: "+searchError.message};
    }
    const found = new Map<string,any>();
    for(const row of matches||[])found.set(String(row.id),row);

    const cases: any[] = [];
    for (const row of found.values()) {
      const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
      const atualSituacao=resolveSituacaoFromRow(row,dados);
      const atualStatusManual=resolveStatusManualFromRow(row,dados,atualSituacao);
      // A busca SQL retorna JSON legado completo. Exibir a versão tipada
      // sem permitir que d.status_interno e d.situacao antigos reabram ou
      // encerrem o processo visualmente por engano.
      const dadosNormalizados={
        ...dados,
        situacao:atualSituacao,
        status_interno:atualSituacao,
        status:row.status??dados.status,
        statusManual:atualStatusManual,
        proximoPrazo:row.proximo_retorno??"",
        proximo_retorno:row.proximo_retorno??null,
        ultimoRetorno:row.ultimo_retorno??"",
        ultimo_retorno:row.ultimo_retorno??null,
      };
      const base = {
        ...dadosNormalizados,
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
        situacao: atualSituacao,
        statusManual: atualStatusManual,
        status_interno: row.status_interno || dados.status_interno,
        ultimoRetorno: row.ultimo_retorno ?? dados.ultimoRetorno ?? dados.ultimo_retorno ?? null,
        proximoPrazo: row.proximo_retorno ?? null,
        created_by: row.created_by,
        atendido_por: row.atendido_por || dados.atendido_por,
        dados:dadosNormalizados,
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
